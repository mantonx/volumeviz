package utils

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMapDatabaseError(t *testing.T) {
	tests := []struct {
		name               string
		err                error
		operation          string
		expectedCode       DatabaseErrorCode
		expectedHTTPStatus int
		expectedTemporary  bool
		expectRetryAfter   bool
	}{
		{
			name:               "nil error",
			err:                nil,
			operation:          "test",
			expectedCode:       "",
			expectedHTTPStatus: 0,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name:               "sql.ErrNoRows",
			err:                sql.ErrNoRows,
			operation:          "select user",
			expectedCode:       DatabaseErrorCodeNotFound,
			expectedHTTPStatus: 404,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name:               "context canceled",
			err:                context.Canceled,
			operation:          "insert",
			expectedCode:       DatabaseErrorCodeTimeout,
			expectedHTTPStatus: 408,
			expectedTemporary:  true,
			expectRetryAfter:   false,
		},
		{
			name:               "context deadline exceeded",
			err:                context.DeadlineExceeded,
			operation:          "update",
			expectedCode:       DatabaseErrorCodeTimeout,
			expectedHTTPStatus: 408,
			expectedTemporary:  true,
			expectRetryAfter:   true,
		},
		{
			name:               "generic duplicate error",
			err:                errors.New("duplicate key value violates unique constraint"),
			operation:          "insert user",
			expectedCode:       DatabaseErrorCodeDuplicateKey,
			expectedHTTPStatus: 409,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name:               "generic connection error",
			err:                errors.New("connection refused: timeout"),
			operation:          "connect",
			expectedCode:       DatabaseErrorCodeConnection,
			expectedHTTPStatus: 503,
			expectedTemporary:  true,
			expectRetryAfter:   true,
		},
		{
			name:               "generic timeout error",
			err:                errors.New("operation timeout"),
			operation:          "query",
			expectedCode:       DatabaseErrorCodeTimeout,
			expectedHTTPStatus: 408,
			expectedTemporary:  true,
			expectRetryAfter:   true,
		},
		{
			name:               "generic unknown error",
			err:                errors.New("unknown database error"),
			operation:          "unknown",
			expectedCode:       DatabaseErrorCodeInternal,
			expectedHTTPStatus: 500,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MapDatabaseError(tt.err, tt.operation)

			if tt.err == nil {
				assert.Nil(t, result)
				return
			}

			require.NotNil(t, result)
			assert.Equal(t, tt.expectedCode, result.Code)
			assert.Equal(t, tt.expectedHTTPStatus, result.HTTPStatusCode)
			assert.Equal(t, tt.expectedTemporary, result.IsTemporary)
			assert.Equal(t, tt.operation, result.Operation)
			assert.Equal(t, tt.err, result.OriginalError)

			if tt.expectRetryAfter {
				assert.NotNil(t, result.RetryAfter)
				assert.Greater(t, *result.RetryAfter, time.Duration(0))
			} else {
				assert.Nil(t, result.RetryAfter)
			}
		})
	}
}

func TestMapPostgreSQLError(t *testing.T) {
	tests := []struct {
		name               string
		pqError            *pq.Error
		expectedCode       DatabaseErrorCode
		expectedHTTPStatus int
		expectedTemporary  bool
		expectRetryAfter   bool
	}{
		{
			name: "unique violation",
			pqError: &pq.Error{
				Code:       "23505",
				Message:    "duplicate key value violates unique constraint",
				Table:      "users",
				Constraint: "users_email_key",
			},
			expectedCode:       DatabaseErrorCodeDuplicateKey,
			expectedHTTPStatus: 409,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name: "foreign key violation",
			pqError: &pq.Error{
				Code:       "23503",
				Message:    "insert or update on table violates foreign key constraint",
				Table:      "posts",
				Constraint: "posts_user_id_fkey",
			},
			expectedCode:       DatabaseErrorCodeForeignKey,
			expectedHTTPStatus: 409,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name: "insufficient privilege",
			pqError: &pq.Error{
				Code:    "42501",
				Message: "permission denied for table users",
			},
			expectedCode:       DatabaseErrorCodePermission,
			expectedHTTPStatus: 403,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name: "deadlock detected",
			pqError: &pq.Error{
				Code:    "40001",
				Message: "deadlock detected",
			},
			expectedCode:       DatabaseErrorCodeDeadlock,
			expectedHTTPStatus: 503,
			expectedTemporary:  true,
			expectRetryAfter:   true,
		},
		{
			name: "too many connections",
			pqError: &pq.Error{
				Code:    "53300",
				Message: "too many connections for database",
			},
			expectedCode:       DatabaseErrorCodeUnavailable,
			expectedHTTPStatus: 503,
			expectedTemporary:  true,
			expectRetryAfter:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dbErr := &DatabaseError{
				Operation: "test",
				Details:   make(map[string]interface{}),
			}

			result := mapPostgreSQLError(tt.pqError, dbErr)

			assert.Equal(t, tt.expectedCode, result.Code)
			assert.Equal(t, tt.expectedHTTPStatus, result.HTTPStatusCode)
			assert.Equal(t, tt.expectedTemporary, result.IsTemporary)
			assert.Equal(t, string(tt.pqError.Code), result.Details["postgres_code"])

			if tt.pqError.Table != "" {
				assert.Equal(t, tt.pqError.Table, result.Table)
			}
			if tt.pqError.Constraint != "" {
				assert.Equal(t, tt.pqError.Constraint, result.Constraint)
			}

			if tt.expectRetryAfter {
				assert.NotNil(t, result.RetryAfter)
			} else {
				assert.Nil(t, result.RetryAfter)
			}
		})
	}
}

func TestMapGenericDatabaseError(t *testing.T) {
	tests := []struct {
		name               string
		err                error
		expectedCode       DatabaseErrorCode
		expectedHTTPStatus int
		expectedTemporary  bool
		expectRetryAfter   bool
	}{
		{
			name:               "duplicate key error",
			err:                errors.New("duplicate key value violates unique constraint"),
			expectedCode:       DatabaseErrorCodeDuplicateKey,
			expectedHTTPStatus: 409,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name:               "foreign key error",
			err:                errors.New("foreign key constraint violation"),
			expectedCode:       DatabaseErrorCodeForeignKey,
			expectedHTTPStatus: 409,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name:               "connection refused",
			err:                errors.New("connection refused: timeout"),
			expectedCode:       DatabaseErrorCodeConnection,
			expectedHTTPStatus: 503,
			expectedTemporary:  true,
			expectRetryAfter:   true,
		},
		{
			name:               "timeout error",
			err:                errors.New("query timeout exceeded"),
			expectedCode:       DatabaseErrorCodeTimeout,
			expectedHTTPStatus: 408,
			expectedTemporary:  true,
			expectRetryAfter:   true,
		},
		{
			name:               "permission denied",
			err:                errors.New("permission denied for table users"),
			expectedCode:       DatabaseErrorCodePermission,
			expectedHTTPStatus: 403,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name:               "table does not exist",
			err:                errors.New("table users does not exist"),
			expectedCode:       DatabaseErrorCodeTableNotFound,
			expectedHTTPStatus: 500,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name:               "syntax error",
			err:                errors.New("syntax error in SQL statement"),
			expectedCode:       DatabaseErrorCodeSyntaxError,
			expectedHTTPStatus: 500,
			expectedTemporary:  false,
			expectRetryAfter:   false,
		},
		{
			name:               "deadlock detected",
			err:                errors.New("deadlock detected in database"),
			expectedCode:       DatabaseErrorCodeDeadlock,
			expectedHTTPStatus: 503,
			expectedTemporary:  true,
			expectRetryAfter:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dbErr := &DatabaseError{
				Operation: "test",
				Details:   make(map[string]interface{}),
			}

			result := mapGenericDatabaseError(tt.err, dbErr)

			assert.Equal(t, tt.expectedCode, result.Code)
			assert.Equal(t, tt.expectedHTTPStatus, result.HTTPStatusCode)
			assert.Equal(t, tt.expectedTemporary, result.IsTemporary)

			if tt.expectRetryAfter {
				assert.NotNil(t, result.RetryAfter)
			} else {
				assert.Nil(t, result.RetryAfter)
			}
		})
	}
}

func TestDatabaseError_Error(t *testing.T) {
	tests := []struct {
		name     string
		dbErr    *DatabaseError
		expected string
	}{
		{
			name: "with operation",
			dbErr: &DatabaseError{
				Operation: "insert user",
				Message:   "duplicate key",
			},
			expected: "insert user: duplicate key",
		},
		{
			name: "without operation",
			dbErr: &DatabaseError{
				Message: "connection failed",
			},
			expected: "connection failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.dbErr.Error()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestDatabaseError_Unwrap(t *testing.T) {
	originalErr := errors.New("original error")
	dbErr := &DatabaseError{
		OriginalError: originalErr,
	}

	unwrapped := dbErr.Unwrap()
	assert.Equal(t, originalErr, unwrapped)

	// Test with errors.Is
	assert.True(t, errors.Is(dbErr, originalErr))
}
