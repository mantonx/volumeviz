package previews

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers preview routes
func RegisterRoutes(router *gin.RouterGroup, handler *Handler) {
	// Preview management endpoints
	previews := router.Group("/previews")
	{
		// Generate preview
		previews.POST("", handler.GeneratePreview)
		
		// Service endpoints  
		previews.GET("/stats", handler.GetStats)
		previews.GET("/supported", handler.GetSupportedTypes)
		previews.GET("/health", handler.HealthCheck)
	}
	
	// Preview file access (separate to avoid wildcard conflicts)
	previewFiles := router.Group("/previews")
	{
		// Serve preview file by ID
		previewFiles.GET("/:file_id", handler.GetPreview)
		
		// Delete preview by ID
		previewFiles.DELETE("/:file_id", handler.DeletePreview)
	}
	
	// File-specific preview endpoints
	files := router.Group("/files")
	{
		// Get preview for a specific file
		files.GET("/:file_id/preview", handler.GetPreviewByFile)
	}
}

// SetupPreviewRoutes sets up all preview-related routes
func SetupPreviewRoutes(v1 *gin.RouterGroup, handler *Handler) {
	RegisterRoutes(v1, handler)
}