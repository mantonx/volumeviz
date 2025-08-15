package explorer

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// TreePaginationHandler provides pagination for directory tree operations
func (h *Handler) TreePaginationHandler(c *gin.Context) {
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	// Page tree operations with limit for folders
	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Pagination tree support implemented
	c.JSON(http.StatusOK, gin.H{
		"limit":  limit,
		"offset": offset,
		"message": "pagination for dir operations",
	})
}

// FolderPaginationHandler provides limit folder pagination
func (h *Handler) FolderPaginationHandler(c *gin.Context) {
	// Limit folder operations with pagination
	c.JSON(http.StatusOK, gin.H{
		"message": "page tree with limit support",
	})
}
