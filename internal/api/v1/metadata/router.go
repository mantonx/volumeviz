package metadata

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/store"
)

// RegisterRoutes registers all metadata routes
func RegisterRoutes(router *gin.RouterGroup, store store.Store) {
	handler := NewHandler(store)
	
	metadataGroup := router.Group("/metadata")
	{
		metadataGroup.GET("/files/:id", handler.GetFileMetadata)
		metadataGroup.GET("/files/by-media-kind", handler.GetFilesByMediaKind)
		metadataGroup.GET("/files/by-resolution", handler.GetFilesByResolution)
		metadataGroup.GET("/files/by-duration", handler.GetFilesByDuration)
		metadataGroup.GET("/files/by-location", handler.GetFilesByLocation)
	}
}
