package auth

import (
	"github.com/gin-gonic/gin"
	authService "github.com/mantonx/volumeviz/internal/services/auth"
	"github.com/mantonx/volumeviz/internal/store"
)

type Router struct {
	handler *Handler
}

// NewRouter creates a new auth router
func NewRouter(store store.Store, authService *authService.Service) *Router {
	return &Router{
		handler: NewHandler(store, authService),
	}
}

// RegisterRoutes registers auth routes
func (r *Router) RegisterRoutes(v1 *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	auth := v1.Group("/auth")
	{
		// Public routes (no authentication required)
		auth.POST("/login", r.handler.Login)
		auth.POST("/register", r.handler.Register)

		// Protected routes (authentication required)
		authenticated := auth.Group("")
		authenticated.Use(authMiddleware)
		{
			authenticated.GET("/me", r.handler.GetCurrentUser)
			authenticated.POST("/change-password", r.handler.ChangePassword)
		}
	}
}
