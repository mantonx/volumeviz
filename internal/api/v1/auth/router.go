package auth

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/utils/auth"
)

// RegisterRoutes registers authentication routes
func RegisterRoutes(v1 *gin.RouterGroup, store store.Store, jwtManager *auth.JWTManager, authConfig *middleware.AuthConfig) {
	handler := NewHandler(store, jwtManager)
	
	// Public auth routes (no auth required)
	auth := v1.Group("/auth")
	{
		auth.POST("/login", handler.Login)
		auth.POST("/register", handler.Register)
		auth.POST("/register/invitation", handler.RegisterWithInvitation) // Register with invitation token
		auth.POST("/password/reset", handler.RequestPasswordReset)
		auth.POST("/refresh", handler.RefreshToken) // JWT refresh endpoint
		auth.GET("/csrf", handler.GetCSRFToken)     // CSRF token endpoint
	}
	
	// Protected auth routes (auth required)
	authProtected := v1.Group("/auth")
	authProtected.Use(middleware.AuthMiddleware(authConfig))
	{
		authProtected.GET("/me", handler.GetProfile)
		authProtected.POST("/logout", handler.Logout)
		authProtected.POST("/password/change", handler.ChangePassword)
		authProtected.POST("/password/force-change", handler.ForcePasswordChange) // Force password change for default admin
		authProtected.POST("/accept-invitation", handler.AcceptInvitation)        // Accept organization invitation
	}
}