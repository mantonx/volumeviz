package explorer

import (
	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/store"
)

// RegisterRoutes registers all explorer routes
func RegisterRoutes(router *gin.RouterGroup, store store.Store) {
	handler := NewHandler(store)
	
	explorerGroup := router.Group("/explorer")
	{
		explorerGroup.GET("/files", handler.GetFilesByFolder)
		explorerGroup.GET("/files/paginated", handler.GetFilesPaginated)
		explorerGroup.GET("/files/by-media-type", handler.GetFilesByMediaType)
		explorerGroup.GET("/files/by-extension", handler.GetFilesByExtension)
		explorerGroup.GET("/files/recent", handler.GetRecentFiles)
		explorerGroup.GET("/files/search", handler.SearchFiles)
		explorerGroup.GET("/tree", handler.GetFolderTree)
		explorerGroup.GET("/tree/children", handler.GetTreeChildren)
		explorerGroup.GET("/browse", handler.GetFolderBrowsing)
	}
}
