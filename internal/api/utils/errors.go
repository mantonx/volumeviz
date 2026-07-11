package utils

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/mantonx/volumeviz/internal/api/models"
	"modernc.org/sqlite"
	sqlitelib "modernc.org/sqlite/lib"
)

// ErrorCode represents standard API error codes
type ErrorCode string

const (
	ErrorCodeBadRequest    ErrorCode = "bad_request"
	ErrorCodeUnauthorized  ErrorCode = "unauthorized"
	ErrorCodeForbidden     ErrorCode = "forbidden"
	ErrorCodeNotFound      ErrorCode = "not_found"
	ErrorCodeConflict      ErrorCode = "conflict"
	ErrorCodeRateLimited   ErrorCode = "rate_limited"
	ErrorCodeInternal      ErrorCode = "internal"
	ErrorCodeDatabaseError ErrorCode = "database_error"
)

// DatabaseErrorCode represents database-specific error codes
type DatabaseErrorCode string

const (
	DatabaseErrorCodeConnection      DatabaseErrorCode = "DATABASE_CONNECTION_ERROR"
	DatabaseErrorCodeTimeout         DatabaseErrorCode = "DATABASE_TIMEOUT"
	DatabaseErrorCodeConstraint      DatabaseErrorCode = "DATABASE_CONSTRAINT_VIOLATION"
	DatabaseErrorCodeNotFound        DatabaseErrorCode = "DATABASE_NOT_FOUND"
	DatabaseErrorCodeDuplicateKey    DatabaseErrorCode = "DATABASE_DUPLICATE_KEY"
	DatabaseErrorCodeSyntaxError     DatabaseErrorCode = "DATABASE_SYNTAX_ERROR"
	DatabaseErrorCodePermission      DatabaseErrorCode = "DATABASE_PERMISSION_DENIED"
	DatabaseErrorCodeLockTimeout     DatabaseErrorCode = "DATABASE_LOCK_TIMEOUT"
	DatabaseErrorCodeTableNotFound   DatabaseErrorCode = "DATABASE_TABLE_NOT_FOUND"
	DatabaseErrorCodeColumnNotFound  DatabaseErrorCode = "DATABASE_COLUMN_NOT_FOUND"
	DatabaseErrorCodeForeignKey      DatabaseErrorCode = "DATABASE_FOREIGN_KEY_VIOLATION"
	DatabaseErrorCodeCheckConstraint DatabaseErrorCode = "DATABASE_CHECK_CONSTRAINT_VIOLATION"
	DatabaseErrorCodeDeadlock        DatabaseErrorCode = "DATABASE_DEADLOCK"
	DatabaseErrorCodeUnavailable     DatabaseErrorCode = "DATABASE_UNAVAILABLE"
	DatabaseErrorCodeInternal        DatabaseErrorCode = "DATABASE_INTERNAL_ERROR"
)

// DatabaseError provides structured error information for database operations
type DatabaseError struct {
	Code           DatabaseErrorCode      `json:"code"`
	Message        string                 `json:"message"`
	Operation      string                 `json:"operation"`
	Table          string                 `json:"table,omitempty"`
	Constraint     string                 `json:"constraint,omitempty"`
	OriginalError  error                  `json:"-"`
	Details        map[string]interface{} `json:"details,omitempty"`
	RetryAfter     *time.Duration         `json:"retry_after,omitempty"`
	IsTemporary    bool                   `json:"is_temporary"`
	HTTPStatusCode int                    `json:"-"`
}

// Error implements the error interface
func (e *DatabaseError) Error() string {
	if e.Operation != "" {
		return e.Operation + ": " + e.Message
	}
	return e.Message
}

// Unwrap allows errors.Is and errors.As to work with the original error
func (e *DatabaseError) Unwrap() error {
	return e.OriginalError
}

// MapDatabaseError converts database driver errors into structured DatabaseError instances
func MapDatabaseError(err error, operation string) *DatabaseError {
	if err == nil {
		return nil
	}

	dbErr := &DatabaseError{
		Operation:     operation,
		OriginalError: err,
		Details:       make(map[string]interface{}),
	}

	// Handle context errors first
	if errors.Is(err, context.Canceled) {
		dbErr.Code = DatabaseErrorCodeTimeout
		dbErr.Message = "Database operation was canceled"
		dbErr.HTTPStatusCode = 408 // Request Timeout
		dbErr.IsTemporary = true
		return dbErr
	}

	if errors.Is(err, context.DeadlineExceeded) {
		dbErr.Code = DatabaseErrorCodeTimeout
		dbErr.Message = "Database operation timed out"
		dbErr.HTTPStatusCode = 408 // Request Timeout
		dbErr.IsTemporary = true
		retryAfter := time.Second * 5
		dbErr.RetryAfter = &retryAfter
		return dbErr
	}

	// Handle sql.ErrNoRows
	if errors.Is(err, sql.ErrNoRows) {
		dbErr.Code = DatabaseErrorCodeNotFound
		dbErr.Message = "Resource not found"
		dbErr.HTTPStatusCode = 404 // Not Found
		dbErr.IsTemporary = false
		return dbErr
	}

	// Handle PostgreSQL errors
	if pqErr, ok := err.(*pq.Error); ok {
		return mapPostgreSQLError(pqErr, dbErr)
	}

	// Handle SQLite errors
	if sqliteErr, ok := err.(*sqlite.Error); ok {
		return mapSQLiteError(sqliteErr, dbErr)
	}

	// Handle generic string-based error patterns
	return mapGenericDatabaseError(err, dbErr)
}

// mapPostgreSQLError handles PostgreSQL-specific error codes
func mapPostgreSQLError(pqErr *pq.Error, dbErr *DatabaseError) *DatabaseError {
	dbErr.Details["postgres_code"] = string(pqErr.Code)
	dbErr.Details["postgres_severity"] = pqErr.Severity

	if pqErr.Table != "" {
		dbErr.Table = pqErr.Table
	}
	if pqErr.Constraint != "" {
		dbErr.Constraint = pqErr.Constraint
	}

	switch pqErr.Code {
	case "23505": // unique_violation
		dbErr.Code = DatabaseErrorCodeDuplicateKey
		dbErr.Message = "Duplicate key value violates unique constraint"
		dbErr.HTTPStatusCode = 409 // Conflict

	case "23503": // foreign_key_violation
		dbErr.Code = DatabaseErrorCodeForeignKey
		dbErr.Message = "Foreign key constraint violation"
		dbErr.HTTPStatusCode = 409 // Conflict

	case "23514": // check_violation
		dbErr.Code = DatabaseErrorCodeCheckConstraint
		dbErr.Message = "Check constraint violation"
		dbErr.HTTPStatusCode = 400 // Bad Request

	case "42501": // insufficient_privilege
		dbErr.Code = DatabaseErrorCodePermission
		dbErr.Message = "Insufficient database privileges"
		dbErr.HTTPStatusCode = 403 // Forbidden

	case "42P01": // undefined_table
		dbErr.Code = DatabaseErrorCodeTableNotFound
		dbErr.Message = "Table does not exist"
		dbErr.HTTPStatusCode = 500 // Internal Server Error

	case "42703": // undefined_column
		dbErr.Code = DatabaseErrorCodeColumnNotFound
		dbErr.Message = "Column does not exist"
		dbErr.HTTPStatusCode = 500 // Internal Server Error

	case "42601": // syntax_error
		dbErr.Code = DatabaseErrorCodeSyntaxError
		dbErr.Message = "SQL syntax error"
		dbErr.HTTPStatusCode = 500 // Internal Server Error

	case "40001": // serialization_failure (deadlock)
		dbErr.Code = DatabaseErrorCodeDeadlock
		dbErr.Message = "Database deadlock detected"
		dbErr.HTTPStatusCode = 503 // Service Unavailable
		dbErr.IsTemporary = true
		retryAfter := time.Second * 2
		dbErr.RetryAfter = &retryAfter

	case "53300": // too_many_connections
		dbErr.Code = DatabaseErrorCodeUnavailable
		dbErr.Message = "Database connection pool exhausted"
		dbErr.HTTPStatusCode = 503 // Service Unavailable
		dbErr.IsTemporary = true
		retryAfter := time.Second * 10
		dbErr.RetryAfter = &retryAfter

	default:
		// Check if it's a connection error
		if strings.Contains(pqErr.Code.Name(), "connection") {
			dbErr.Code = DatabaseErrorCodeConnection
			dbErr.Message = "Database connection error"
			dbErr.HTTPStatusCode = 503 // Service Unavailable
			dbErr.IsTemporary = true
		} else {
			dbErr.Code = DatabaseErrorCodeInternal
			dbErr.Message = "Database error: " + pqErr.Message
			dbErr.HTTPStatusCode = 500 // Internal Server Error
		}
	}

	return dbErr
}

// mapSQLiteError handles SQLite-specific error codes
func mapSQLiteError(sqliteErr *sqlite.Error, dbErr *DatabaseError) *DatabaseError {
	dbErr.Details["sqlite_code"] = int(sqliteErr.Code())

	switch sqliteErr.Code() {
	case sqlitelib.SQLITE_CONSTRAINT_UNIQUE:
		dbErr.Code = DatabaseErrorCodeDuplicateKey
		dbErr.Message = "Unique constraint violation"
		dbErr.HTTPStatusCode = 409 // Conflict

	case sqlitelib.SQLITE_CONSTRAINT_FOREIGNKEY:
		dbErr.Code = DatabaseErrorCodeForeignKey
		dbErr.Message = "Foreign key constraint violation"
		dbErr.HTTPStatusCode = 409 // Conflict

	case sqlitelib.SQLITE_CONSTRAINT_CHECK:
		dbErr.Code = DatabaseErrorCodeCheckConstraint
		dbErr.Message = "Check constraint violation"
		dbErr.HTTPStatusCode = 400 // Bad Request

	case sqlitelib.SQLITE_AUTH:
		dbErr.Code = DatabaseErrorCodePermission
		dbErr.Message = "SQLite authorization denied"
		dbErr.HTTPStatusCode = 403 // Forbidden

	case sqlitelib.SQLITE_NOTFOUND:
		dbErr.Code = DatabaseErrorCodeNotFound
		dbErr.Message = "Resource not found"
		dbErr.HTTPStatusCode = 404 // Not Found

	case sqlitelib.SQLITE_BUSY:
		dbErr.Code = DatabaseErrorCodeLockTimeout
		dbErr.Message = "Database is locked"
		dbErr.HTTPStatusCode = 503 // Service Unavailable
		dbErr.IsTemporary = true
		retryAfter := time.Millisecond * 100
		dbErr.RetryAfter = &retryAfter

	case sqlitelib.SQLITE_LOCKED:
		dbErr.Code = DatabaseErrorCodeLockTimeout
		dbErr.Message = "Database table is locked"
		dbErr.HTTPStatusCode = 503 // Service Unavailable
		dbErr.IsTemporary = true
		retryAfter := time.Millisecond * 500
		dbErr.RetryAfter = &retryAfter

	case sqlitelib.SQLITE_CANTOPEN:
		dbErr.Code = DatabaseErrorCodeConnection
		dbErr.Message = "Cannot open database file"
		dbErr.HTTPStatusCode = 503 // Service Unavailable
		dbErr.IsTemporary = false

	default:
		dbErr.Code = DatabaseErrorCodeInternal
		dbErr.Message = "SQLite error: " + sqliteErr.Error()
		dbErr.HTTPStatusCode = 500 // Internal Server Error
	}

	return dbErr
}

// mapGenericDatabaseError handles string-based error patterns for any database driver
func mapGenericDatabaseError(err error, dbErr *DatabaseError) *DatabaseError {
	errStr := strings.ToLower(err.Error())

	switch {
	case strings.Contains(errStr, "duplicate") || strings.Contains(errStr, "unique"):
		dbErr.Code = DatabaseErrorCodeDuplicateKey
		dbErr.Message = "Duplicate key violation"
		dbErr.HTTPStatusCode = 409 // Conflict

	case strings.Contains(errStr, "foreign key"):
		dbErr.Code = DatabaseErrorCodeForeignKey
		dbErr.Message = "Foreign key constraint violation"
		dbErr.HTTPStatusCode = 409 // Conflict

	case strings.Contains(errStr, "connection") && (strings.Contains(errStr, "refused") || strings.Contains(errStr, "timeout")):
		dbErr.Code = DatabaseErrorCodeConnection
		dbErr.Message = "Database connection failed"
		dbErr.HTTPStatusCode = 503 // Service Unavailable
		dbErr.IsTemporary = true
		retryAfter := time.Second * 5
		dbErr.RetryAfter = &retryAfter

	case strings.Contains(errStr, "timeout"):
		dbErr.Code = DatabaseErrorCodeTimeout
		dbErr.Message = "Database operation timed out"
		dbErr.HTTPStatusCode = 408 // Request Timeout
		dbErr.IsTemporary = true
		retryAfter := time.Second * 3
		dbErr.RetryAfter = &retryAfter

	case strings.Contains(errStr, "permission") || strings.Contains(errStr, "access denied"):
		dbErr.Code = DatabaseErrorCodePermission
		dbErr.Message = "Database permission denied"
		dbErr.HTTPStatusCode = 403 // Forbidden

	case strings.Contains(errStr, "table") && strings.Contains(errStr, "not exist"):
		dbErr.Code = DatabaseErrorCodeTableNotFound
		dbErr.Message = "Database table not found"
		dbErr.HTTPStatusCode = 500 // Internal Server Error

	case strings.Contains(errStr, "syntax"):
		dbErr.Code = DatabaseErrorCodeSyntaxError
		dbErr.Message = "SQL syntax error"
		dbErr.HTTPStatusCode = 500 // Internal Server Error

	case strings.Contains(errStr, "deadlock"):
		dbErr.Code = DatabaseErrorCodeDeadlock
		dbErr.Message = "Database deadlock detected"
		dbErr.HTTPStatusCode = 503 // Service Unavailable
		dbErr.IsTemporary = true
		retryAfter := time.Second * 2
		dbErr.RetryAfter = &retryAfter

	default:
		dbErr.Code = DatabaseErrorCodeInternal
		dbErr.Message = err.Error()
		dbErr.HTTPStatusCode = 500 // Internal Server Error
	}

	return dbErr
}

// RespondWithError sends a uniform error response
func RespondWithError(c *gin.Context, statusCode int, code ErrorCode, message string, details map[string]interface{}) {
	requestID := c.GetString("request_id")
	if requestID == "" {
		requestID = c.GetHeader("X-Request-ID")
	}

	response := models.ErrorResponse{
		Error:   message,
		Code:    string(code),
		Details: details,
	}

	c.JSON(statusCode, response)
}

// RespondWithBadRequest sends a 400 Bad Request error
func RespondWithBadRequest(c *gin.Context, message string, details map[string]interface{}) {
	RespondWithError(c, 400, ErrorCodeBadRequest, message, details)
}

// RespondWithUnauthorized sends a 401 Unauthorized error
func RespondWithUnauthorized(c *gin.Context, message string) {
	RespondWithError(c, 401, ErrorCodeUnauthorized, message, nil)
}

// RespondWithForbidden sends a 403 Forbidden error
func RespondWithForbidden(c *gin.Context, message string) {
	RespondWithError(c, 403, ErrorCodeForbidden, message, nil)
}

// RespondWithNotFound sends a 404 Not Found error
func RespondWithNotFound(c *gin.Context, message string) {
	RespondWithError(c, 404, ErrorCodeNotFound, message, nil)
}

// RespondWithConflict sends a 409 Conflict error
func RespondWithConflict(c *gin.Context, message string, details map[string]interface{}) {
	RespondWithError(c, 409, ErrorCodeConflict, message, details)
}

// RespondWithRateLimited sends a 429 Rate Limited error
func RespondWithRateLimited(c *gin.Context, message string, retryAfter int) {
	if retryAfter > 0 {
		c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
	}
	RespondWithError(c, 429, ErrorCodeRateLimited, message, nil)
}

// RespondWithInternalError sends a 500 Internal Server Error
func RespondWithInternalError(c *gin.Context, message string, err error) {
	details := make(map[string]interface{})
	if err != nil {
		details["error"] = err.Error()
	}
	RespondWithError(c, 500, ErrorCodeInternal, message, details)
}

// RespondWithDatabaseError handles database-specific errors with intelligent HTTP status mapping
func RespondWithDatabaseError(c *gin.Context, operation string, err error) {
	dbErr := MapDatabaseError(err, operation)

	details := make(map[string]interface{})
	details["operation"] = dbErr.Operation
	details["is_temporary"] = dbErr.IsTemporary

	if dbErr.Table != "" {
		details["table"] = dbErr.Table
	}
	if dbErr.Constraint != "" {
		details["constraint"] = dbErr.Constraint
	}
	if dbErr.Details != nil {
		for k, v := range dbErr.Details {
			details[k] = v
		}
	}

	// Set retry headers for temporary errors
	if dbErr.IsTemporary && dbErr.RetryAfter != nil {
		c.Header("Retry-After", dbErr.RetryAfter.String())
	}

	RespondWithError(c, dbErr.HTTPStatusCode, ErrorCode(dbErr.Code), dbErr.Message, details)
}
