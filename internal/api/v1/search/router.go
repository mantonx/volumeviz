package search

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/store"
)

// Router handles search-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new search router
func NewRouter(store store.Store) *Router {
	return &Router{
		handler: NewHandler(store),
	}
}

// RegisterRoutes registers all search-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	searchGroup := group.Group("/search")
	{
		// File search
		searchGroup.GET("/files", r.handler.SearchFiles)
		searchGroup.GET("/suggestions", r.handler.GetSearchSuggestions)

		// Saved searches CRUD
		searchGroup.POST("/saved", r.handler.CreateSavedSearch)
		searchGroup.GET("/saved", r.handler.ListSavedSearches)
		searchGroup.GET("/saved/:id", r.handler.GetSavedSearch)
		searchGroup.PUT("/saved/:id", r.handler.UpdateSavedSearch)
		searchGroup.DELETE("/saved/:id", r.handler.DeleteSavedSearch)
		searchGroup.POST("/saved/:id/run", r.handler.RunSavedSearch)
	}
}
