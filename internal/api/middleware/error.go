package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/username/volumeviz/internal/models"
)

// ErrorHandler middleware for handling panics and errors
func ErrorHandler() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered any) {
		var err error
		var msg string
		
		switch v := recovered.(type) {
		case string:
			msg = v
		case error:
			err = v
			msg = err.Error()
		default:
			msg = "Internal server error"
		}

		// Log the error (in production, use proper logging)
		gin.Logger()(c)

		// Determine error type and status code
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		if err != nil {
			if isDockerError(err) {
				statusCode = http.StatusServiceUnavailable
				errorCode = "DOCKER_ERROR"
			} else if isPermissionError(err) {
				statusCode = http.StatusForbidden
				errorCode = "PERMISSION_ERROR"
			} else if isNetworkError(err) {
				statusCode = http.StatusBadGateway
				errorCode = "NETWORK_ERROR"
			}
		}

		c.AbortWithStatusJSON(statusCode, models.ErrorResponse{
			Error:   "Request failed due to an unexpected error",
			Code:    errorCode,
			Details: msg,
		})
	})
}

// DockerErrorHandler middleware for Docker-specific error handling
func DockerErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Check if there were any errors during request processing
		if len(c.Errors) > 0 {
			err := c.Errors.Last().Err
			
			var statusCode int
			var errorCode string
			var message string

			if isDockerDaemonError(err) {
				statusCode = http.StatusServiceUnavailable
				errorCode = "DOCKER_DAEMON_UNAVAILABLE"
				message = "Docker daemon is not running or unreachable"
			} else if isDockerPermissionError(err) {
				statusCode = http.StatusForbidden
				errorCode = "DOCKER_PERMISSION_DENIED"
				message = "Permission denied accessing Docker socket"
			} else if isDockerNetworkError(err) {
				statusCode = http.StatusBadGateway
				errorCode = "DOCKER_NETWORK_ERROR"
				message = "Network error connecting to Docker daemon"
			} else {
				// Default error handling
				return
			}

			c.AbortWithStatusJSON(statusCode, models.ErrorResponse{
				Error:   message,
				Code:    errorCode,
				Details: err.Error(),
			})
		}
	}
}

// isDockerError checks if the error is Docker-related
func isDockerError(err error) bool {
	if err == nil {
		return false
	}
	
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "docker") ||
		   strings.Contains(errMsg, "daemon") ||
		   strings.Contains(errMsg, "socket")
}

// isPermissionError checks if the error is permission-related
func isPermissionError(err error) bool {
	if err == nil {
		return false
	}
	
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "permission denied") ||
		   strings.Contains(errMsg, "access denied") ||
		   strings.Contains(errMsg, "unauthorized")
}

// isNetworkError checks if the error is network-related
func isNetworkError(err error) bool {
	if err == nil {
		return false
	}
	
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "connection refused") ||
		   strings.Contains(errMsg, "network") ||
		   strings.Contains(errMsg, "timeout") ||
		   strings.Contains(errMsg, "unreachable")
}

// isDockerDaemonError checks for Docker daemon specific errors
func isDockerDaemonError(err error) bool {
	if err == nil {
		return false
	}
	
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "daemon not running") ||
		   strings.Contains(errMsg, "docker daemon") ||
		   strings.Contains(errMsg, "cannot connect to docker") ||
		   strings.Contains(errMsg, "connection refused")
}

// isDockerPermissionError checks for Docker permission errors
func isDockerPermissionError(err error) bool {
	if err == nil {
		return false
	}
	
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "permission denied") && 
		   (strings.Contains(errMsg, "docker") || strings.Contains(errMsg, "socket"))
}

// isDockerNetworkError checks for Docker network errors
func isDockerNetworkError(err error) bool {
	if err == nil {
		return false
	}
	
	errMsg := strings.ToLower(err.Error())
	return (strings.Contains(errMsg, "network") || 
		    strings.Contains(errMsg, "timeout") ||
		    strings.Contains(errMsg, "unreachable")) && 
		   strings.Contains(errMsg, "docker")
}