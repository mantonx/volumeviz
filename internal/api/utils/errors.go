package utils

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
)

// ErrorCode represents standard API error codes
type ErrorCode string

const (
	ErrorCodeBadRequest   ErrorCode = "bad_request"
	ErrorCodeUnauthorized ErrorCode = "unauthorized"
	ErrorCodeForbidden    ErrorCode = "forbidden"
	ErrorCodeNotFound     ErrorCode = "not_found"
	ErrorCodeRateLimited  ErrorCode = "rate_limited"
	ErrorCodeInternal     ErrorCode = "internal"
)

// RespondWithError sends a uniform error response
func RespondWithError(c *gin.Context, statusCode int, code ErrorCode, message string, details map[string]interface{}) {
	requestID := c.GetString("request_id")
	if requestID == "" {
		requestID = c.GetHeader("X-Request-ID")
	}

	response := models.ErrorV1{
		Error: models.ErrorDetailsV1{
			Code:      string(code),
			Message:   message,
			Details:   details,
			RequestID: requestID,
		},
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