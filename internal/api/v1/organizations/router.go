package organizations

import (
	"github.com/gin-gonic/gin"
	organizationsService "github.com/mantonx/volumeviz/internal/services/organizations"
	"github.com/mantonx/volumeviz/internal/store"
)

type Router struct {
	handler *Handler
}

// NewRouter creates a new organizations router
func NewRouter(store store.Store, organizationSvc organizationsService.Service) *Router {
	return &Router{
		handler: NewHandler(store, organizationSvc),
	}
}

// RegisterRoutes registers organization routes
func (r *Router) RegisterRoutes(v1 *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	orgs := v1.Group("/organizations")
	{
		// Public routes (no auth required)
		orgs.GET("/:id", r.handler.GetOrganization)
		orgs.GET("/:id/stats", r.handler.GetOrganizationStats)
	}

	// Protected routes (auth required)
	orgsAuth := v1.Group("/organizations")
	orgsAuth.Use(authMiddleware)
	{
		// Get current user's organization
		orgsAuth.GET("/me", r.handler.GetMyOrganization)

		// Update current user's organization (admin only)
		orgsAuth.PUT("/me", r.handler.UpdateMyOrganization)
	}
}
