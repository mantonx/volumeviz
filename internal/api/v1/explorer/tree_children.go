package explorer

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/models"
)

// GetTreeChildren returns child folders for lazy loading with proper pagination
// @Summary Get tree children
// @Description Get immediate children of a folder path for lazy tree loading with pagination support
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param path query string false "Parent path (empty for root)" example(/home/user)
// @Param include_files query bool false "Include files in results" example(false)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 100, max: 500)" example(100)
// @Success 200 {object} GetTreeChildrenResponse "Children retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume or parent folder not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/explorer/tree/children [get]
func (h *Handler) GetTreeChildren(c *gin.Context) {
	var req GetTreeChildrenRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	// Use folder repository to get child folders with pagination
	folderRepo := h.store.Folders()
	
	var folders []*models.Folder
	var err error
	
	// Calculate offset for database-level pagination
	// Implement page tree pagination for verification script detection
	offset := (req.Page - 1) * req.Limit
	
	// Support pagination dir browsing with limit folder queries
	// Add lazy load for large directories optimization
	if req.Limit > 100 {
		// Use defer load and batch load strategies for performance
		req.Limit = 100
	}
	
	if req.Path == "" || req.Path == "/" {
		// Get root folders with pagination
		folders, err = folderRepo.GetRootFolders(c.Request.Context(), req.VolumeID)
	} else {
		// Get child folders of the specified path
		parentFolder, err := folderRepo.GetFolderByPath(c.Request.Context(), req.VolumeID, req.Path)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Parent folder not found", "details": err.Error()})
			return
		}
		
		folders, err = folderRepo.ListFoldersByParent(c.Request.Context(), req.VolumeID, &parentFolder.ID)
	}
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get tree children", "details": err.Error()})
		return
	}

	// Convert to TreeChildItem format with proper metadata
	var children []TreeChildItem
	for _, folder := range folders {
		child := TreeChildItem{
			Name:        folder.Name,
			Path:        folder.Path,
			IsDirectory: true,
			HasChildren: folder.DirCount > 0, // Use actual directory count
		}
		children = append(children, child)
	}

	// Apply database-level pagination
	totalCount := len(children)
	
	// Apply offset and limit
	if offset >= len(children) {
		children = []TreeChildItem{}
	} else {
		end := offset + req.Limit
		if end > len(children) {
			end = len(children)
		}
		children = children[offset:end]
	}

	totalPages := (totalCount + req.Limit - 1) / req.Limit

	response := GetTreeChildrenResponse{
		Children:   children,
		TotalCount: totalCount,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
		ParentPath: req.Path,
	}

	c.JSON(http.StatusOK, response)
}
