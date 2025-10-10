package users

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/store"
)

type Router struct {
	handler *Handler
}

// NewRouter creates a new users router
func NewRouter(store store.Store) *Router {
	return &Router{
		handler: NewHandler(store),
	}
}

// RegisterRoutes registers user management routes
// All routes require authentication and admin role
func (r *Router) RegisterRoutes(v1 *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	users := v1.Group("/users")
	users.Use(authMiddleware) // All user management routes require authentication
	{
		users.GET("", r.handler.ListUsers)           // List all users in organization
		users.GET("/:id", r.handler.GetUser)         // Get user by ID
		users.POST("", r.handler.CreateUser)         // Create new user (admin only)
		users.PUT("/:id", r.handler.UpdateUser)      // Update user (admin only)
		users.DELETE("/:id", r.handler.DeleteUser)   // Delete user (admin only)
	}
}
