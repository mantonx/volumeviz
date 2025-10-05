package security

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRequireSystemAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create middleware
	sm := &SecurityMiddleware{
		dbSecurity: nil, // Not needed for RequireSystemAdmin
		store:      nil, // Not needed for RequireSystemAdmin
	}

	tests := []struct {
		name           string
		userRole       string
		hasRole        bool
		expectedStatus int
		expectAbort    bool
		description    string
	}{
		{
			name:           "Admin user allowed",
			userRole:       "admin",
			hasRole:        true,
			expectedStatus: http.StatusOK,
			expectAbort:    false,
			description:    "Admin role should be allowed",
		},
		{
			name:           "Viewer user blocked",
			userRole:       "viewer",
			hasRole:        true,
			expectedStatus: http.StatusForbidden,
			expectAbort:    true,
			description:    "Viewer role should be blocked",
		},
		{
			name:           "Operator user blocked",
			userRole:       "operator",
			hasRole:        true,
			expectedStatus: http.StatusForbidden,
			expectAbort:    true,
			description:    "Operator role should be blocked",
		},
		{
			name:           "No role context blocked",
			userRole:       "",
			hasRole:        false,
			expectedStatus: http.StatusForbidden,
			expectAbort:    true,
			description:    "Missing role context should be blocked",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test router
			router := gin.New()
			router.Use(func(c *gin.Context) {
				// Set up test context
				if tt.hasRole {
					c.Set("user_role", tt.userRole)
				}
				c.Next()
			})

			// Apply admin middleware
			router.Use(sm.RequireSystemAdmin())

			// Test handler
			router.GET("/test", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			// Make request
			req := httptest.NewRequest("GET", "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assert response
			assert.Equal(t, tt.expectedStatus, w.Code, tt.description)

			if tt.expectAbort {
				// Should return error JSON
				assert.Contains(t, w.Body.String(), "admin privileges required", "Should return admin error message")
			} else {
				// Should reach handler
				assert.Contains(t, w.Body.String(), "success", "Should reach handler with success message")
			}
		})
	}
}

func TestRequireSystemAdminLogging(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sm := &SecurityMiddleware{
		dbSecurity: nil,
		store:      nil,
	}

	// Test that security events are logged
	t.Run("Logs admin access granted", func(t *testing.T) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("user_role", "admin")
			c.Next()
		})
		router.Use(sm.RequireSystemAdmin())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		// Security event should be logged (we can't easily test log output, but we verify the flow works)
	})

	t.Run("Logs unauthorized access attempt", func(t *testing.T) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("user_role", "viewer")
			c.Next()
		})
		router.Use(sm.RequireSystemAdmin())
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
		// Unauthorized attempt should be logged
	})
}
