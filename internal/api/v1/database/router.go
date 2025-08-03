package database

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/database"
)

// Router handles database-related routes
type Router struct {
	handler *Handler
}

// NewRouter creates a new database router
func NewRouter(db *database.DB) *Router {
	return &Router{
		handler: NewHandler(db),
	}
}

// RegisterRoutes registers all database-related routes
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
	// Database health and monitoring endpoints
	database := group.Group("/database")
	{
		// Health and status endpoints
		database.GET("/health", r.handler.GetDatabaseHealth)
		database.GET("/test-connection", r.handler.TestDatabaseConnection)
		database.GET("/stats", r.handler.GetDatabaseStats)
		
		// Migration management endpoints
		migrations := database.Group("/migrations")
		{
			migrations.GET("/status", r.handler.GetMigrationStatus)
			migrations.GET("/history", r.handler.GetMigrationHistory)
			migrations.POST("/apply", r.handler.ApplyPendingMigrations)
			migrations.POST("/:version/rollback", r.handler.RollbackMigration)
		}
		
		// Performance and monitoring endpoints
		performance := database.Group("/performance")
		{
			performance.GET("/table-sizes", r.handler.GetTableSizes)
			performance.GET("/slow-queries", r.handler.GetSlowQueries)
		}
	}
}