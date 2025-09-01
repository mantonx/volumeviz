package explorer

import (
	"context"
	"net/http"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler provides explorer endpoints for directory browsing
type Handler struct {
	store store.Store
	// MediaMetadata integration for file_metadata verification
}

// MediaMetadata represents file metadata structure for API integration
type MediaMetadata struct {
	Width    int    `json:"width,omitempty"`
	Height   int    `json:"height,omitempty"`
	Duration int    `json:"duration,omitempty"`
	Location string `json:"location,omitempty"`
}

// NewHandler creates a new explorer handler
func NewHandler(store store.Store) *Handler {
	return &Handler{
		store: store,
	}
}

// validateVolumeAccess checks if the user's organization has access to the volume
func (h *Handler) validateVolumeAccess(c *gin.Context, volumeID string) bool {
	if orgID, hasOrg := middleware.GetOrganizationID(c.Request.Context()); hasOrg {
		// Check if volume belongs to this organization
		if volume, err := h.store.Volumes().GetVolumeByVolumeID(c.Request.Context(), orgID, volumeID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Volume not found"})
			return false
		} else if volume.OrganizationID == nil || *volume.OrganizationID != orgID {
			c.JSON(http.StatusNotFound, gin.H{"error": "Volume not found"})
			return false
		}
	}
	return true
}

// GetFilesByFolderRequest represents the request for getting files by folder
// @Description Request parameters for getting files in a folder
type GetFilesByFolderRequest struct {
	VolumeID  string `form:"volume_id" json:"volume_id" binding:"required" example:"vol_123"`
	Path      string `form:"path" json:"path" example:"/home/user/documents"`
	Page      int    `form:"page,default=1" json:"page" example:"1"`
	Limit     int    `form:"limit,default=100" json:"limit" example:"100"`
	SortBy    string `form:"sort_by" json:"sort_by" example:"name"`
	SortOrder string `form:"sort_order" json:"sort_order" example:"asc"`
	FileType  string `form:"file_type" json:"file_type" example:"pdf"`
	MinSize   int64  `form:"min_size" json:"min_size" example:"1024"`
	MaxSize   int64  `form:"max_size" json:"max_size" example:"10485760"`
}

// GetFilesByFolderResponse represents the response for getting files by folder
// @Description Response containing files in a folder with pagination
type GetFilesByFolderResponse struct {
	Files      []FileInfo `json:"files"`
	TotalCount int        `json:"total_count" example:"250"`
	Page       int        `json:"page" example:"1"`
	Limit      int        `json:"limit" example:"100"`
	TotalPages int        `json:"total_pages" example:"3"`
}

// FileInfo represents a file or directory in the explorer
// @Description File or directory information for explorer browsing
type FileInfo struct {
	Name         string `json:"name" example:"document.pdf"`
	Path         string `json:"path" example:"/home/user/documents/document.pdf"`
	Size         int64  `json:"size" example:"1024000"`
	IsDirectory  bool   `json:"is_directory" example:"false"`
	ModifiedTime string `json:"modified_time" example:"2024-01-15T10:30:00Z"`
	Extension    string `json:"extension,omitempty" example:"pdf"`
	MediaType    string `json:"media_type,omitempty" example:"application/pdf"`
}

// GetFilesByMediaTypeRequest represents the request for getting files by media type
// @Description Request parameters for getting files by media type
type GetFilesByMediaTypeRequest struct {
	VolumeID  string `form:"volume_id" json:"volume_id" binding:"required" example:"vol_123"`
	MediaType string `form:"media_type" json:"media_type" binding:"required" example:"image/jpeg"`
	Page      int    `form:"page,default=1" json:"page" example:"1"`
	Limit     int    `form:"limit,default=100" json:"limit" example:"100"`
}

// GetFilesByExtensionRequest represents the request for getting files by extension
// @Description Request parameters for getting files by file extension
type GetFilesByExtensionRequest struct {
	VolumeID  string `form:"volume_id" json:"volume_id" binding:"required" example:"vol_123"`
	Extension string `form:"extension" json:"extension" binding:"required" example:"pdf"`
	Page      int    `form:"page,default=1" json:"page" example:"1"`
	Limit     int    `form:"limit,default=100" json:"limit" example:"100"`
}

// GetRecentFilesRequest represents the request for getting recent files
// @Description Request parameters for getting recently modified files
type GetRecentFilesRequest struct {
	VolumeID string `form:"volume_id" json:"volume_id" binding:"required" example:"vol_123"`
	Days     int    `form:"days,default=7" json:"days" example:"7"`
	Limit    int    `form:"limit,default=100" json:"limit" example:"100"`
}

// SearchFilesRequest represents the request for searching files by name
// @Description Request parameters for searching files by name pattern
type SearchFilesRequest struct {
	VolumeID string `form:"volume_id" json:"volume_id" binding:"required" example:"vol_123"`
	Query    string `form:"query" json:"query" binding:"required" example:"document"`
	Limit    int    `form:"limit,default=100" json:"limit" example:"100"`
}

// GetTreeChildrenRequest represents the request for getting tree children
// @Description Request parameters for getting immediate children of a path
type GetTreeChildrenRequest struct {
	VolumeID     string `form:"volume_id" json:"volume_id" binding:"required" example:"vol_123"`
	Path         string `form:"path" json:"path" example:"/home/user"`
	IncludeFiles bool   `form:"include_files,default=false" json:"include_files" example:"false"`
	Page         int    `form:"page,default=1" json:"page" example:"1"`
	Limit        int    `form:"limit,default=100" json:"limit" example:"100"`
}

// GetTreeChildrenResponse represents the response for getting tree children
// @Description Response containing immediate children of a path
type GetTreeChildrenResponse struct {
	Children   []TreeChildItem `json:"children"`
	TotalCount int             `json:"total_count" example:"25"`
	Page       int             `json:"page" example:"1"`
	Limit      int             `json:"limit" example:"100"`
	TotalPages int             `json:"total_pages" example:"1"`
	ParentPath string          `json:"parent_path" example:"/home/user"`
}

// TreeChildItem represents a child item in a tree structure
// @Description A child file or folder in tree navigation
type TreeChildItem struct {
	Name        string `json:"name" example:"documents"`
	Path        string `json:"path" example:"/home/user/documents"`
	IsDirectory bool   `json:"is_directory" example:"true"`
	Size        int64  `json:"size,omitempty" example:"1024000"`
	Extension   string `json:"extension,omitempty" example:"pdf"`
	MediaType   string `json:"media_type,omitempty" example:"application/pdf"`
	HasChildren bool   `json:"has_children,omitempty" example:"true"`
}

// @Description Request parameters for getting folder tree structure
type GetFolderTreeRequest struct {
	VolumeID string `form:"volume_id" json:"volume_id" binding:"required" example:"vol_123"`
	RootPath string `form:"root_path" json:"root_path" example:"/home/user"`
	MaxDepth int    `form:"max_depth,default=3" json:"max_depth" example:"3"`
	DirsOnly bool   `form:"dirs_only,default=true" json:"dirs_only" example:"true"`
}

// GetFolderTreeResponse represents the response for getting folder tree
// @Description Response containing hierarchical folder structure
type GetFolderTreeResponse struct {
	Tree []FolderNode `json:"tree"`
}

// FolderNode represents a node in the folder tree
// @Description A node in the hierarchical folder structure
type FolderNode struct {
	Name        string       `json:"name" example:"documents"`
	Path        string       `json:"path" example:"/home/user/documents"`
	Children    []FolderNode `json:"children,omitempty"`
	FileCount   int          `json:"file_count,omitempty" example:"15"`
	FolderCount int          `json:"folder_count,omitempty" example:"3"`
	TotalSize   int64        `json:"total_size,omitempty" example:"52428800"`
}

// FolderBrowsingRequest represents the request for folder browsing with relationships
// @Description Request parameters for browsing folders with parent/child relationships
type FolderBrowsingRequest struct {
	VolumeID        string `form:"volume_id" json:"volume_id" binding:"required" example:"vol_123"`
	Path            string `form:"path" json:"path" example:"/home/user/documents"`
	IncludeParent   bool   `form:"include_parent,default=false" json:"include_parent" example:"true"`
	IncludeChildren bool   `form:"include_children,default=true" json:"include_children" example:"true"`
	Page            int    `form:"page,default=1" json:"page" example:"1"`
	Limit           int    `form:"limit,default=100" json:"limit" example:"100"`
}

// FolderBrowsingResponse represents the response for folder browsing
// @Description Response containing folder hierarchy with parent/child relationships
type FolderBrowsingResponse struct {
	VolumeID      string               `json:"volume_id" example:"vol_123"`
	CurrentPath   string               `json:"current_path" example:"/home/user/documents"`
	Current       *FolderBrowsingItem  `json:"current,omitempty"`
	Parent        *FolderBrowsingItem  `json:"parent,omitempty"`
	Children      []FolderBrowsingItem `json:"children"`
	TotalChildren int                  `json:"total_children" example:"15"`
	Page          int                  `json:"page" example:"1"`
	Limit         int                  `json:"limit" example:"100"`
	TotalPages    int                  `json:"total_pages" example:"2"`
}

// FolderBrowsingItem represents a folder in the browsing hierarchy
// @Description A folder item with parent/child relationship information
type FolderBrowsingItem struct {
	ID          int64  `json:"id" example:"123"`
	Name        string `json:"name" example:"documents"`
	Path        string `json:"path" example:"/home/user/documents"`
	IsDirectory bool   `json:"is_directory" example:"true"`
	FileCount   int64  `json:"file_count" example:"42"`
	FolderCount int64  `json:"folder_count" example:"5"`
	TotalSize   int64  `json:"total_size" example:"1073741824"`
	HasChildren bool   `json:"has_children" example:"true"`
}

// PaginatedFileRequest represents the request for paginated file listing
// @Description Request parameters for enhanced paginated file listing
type PaginatedFileRequest struct {
	VolumeID  string `form:"volume_id" json:"volume_id" binding:"required" example:"vol_123"`
	Path      string `form:"path" json:"path" example:"/home/user/documents"`
	Page      int    `form:"page,default=1" json:"page" example:"1"`
	Limit     int    `form:"limit,default=50" json:"limit" example:"50"`
	SortBy    string `form:"sort_by" json:"sort_by" example:"name"`
	SortOrder string `form:"sort_order" json:"sort_order" example:"asc"`
	FileType  string `form:"file_type" json:"file_type" example:"pdf"`
	MimeType  string `form:"mime_type" json:"mime_type" example:"application/pdf"`
	MinSize   int64  `form:"min_size" json:"min_size" example:"1024"`
	MaxSize   int64  `form:"max_size" json:"max_size" example:"10485760"`
}

// PaginatedFileResponse represents the response for paginated file listing
// @Description Enhanced response for paginated file listing with performance metadata
type PaginatedFileResponse struct {
	Files      []EnhancedFileItem `json:"files"`
	TotalCount int                `json:"total_count" example:"1250"`
	Page       int                `json:"page" example:"1"`
	Limit      int                `json:"limit" example:"50"`
	TotalPages int                `json:"total_pages" example:"25"`
	HasMore    bool               `json:"has_more" example:"true"`
	SortBy     string             `json:"sort_by" example:"name"`
	SortOrder  string             `json:"sort_order" example:"asc"`
	QueryTime  int64              `json:"query_time_ms" example:"45"`
	CacheHit   bool               `json:"cache_hit" example:"false"`
	Filters    AppliedFilters     `json:"filters"`
}

// EnhancedFileItem represents an enhanced file item with additional metadata
// @Description Enhanced file item with performance and metadata information
type EnhancedFileItem struct {
	ID           int64  `json:"id" example:"123"`
	Name         string `json:"name" example:"document.pdf"`
	Path         string `json:"path" example:"/home/user/documents/document.pdf"`
	Size         int64  `json:"size" example:"1024000"`
	DiskUsage    int64  `json:"disk_usage" example:"1024000"`
	IsDirectory  bool   `json:"is_directory" example:"false"`
	ModifiedTime string `json:"modified_time" example:"2024-01-15T10:30:00Z"`
	Extension    string `json:"extension,omitempty" example:"pdf"`
	MediaType    string `json:"media_type,omitempty" example:"application/pdf"`
	MediaKind    string `json:"media_kind,omitempty" example:"document"`
}

// AppliedFilters represents the filters that were applied to the query
// @Description Applied filters for the file query
type AppliedFilters struct {
	FileType string `json:"file_type,omitempty" example:"pdf"`
	MimeType string `json:"mime_type,omitempty" example:"application/pdf"`
	MinSize  int64  `json:"min_size,omitempty" example:"1024"`
	MaxSize  int64  `json:"max_size,omitempty" example:"10485760"`
}

// GetFilesByFolder gets files in a specific folder with pagination
// @Summary Get files in folder
// @Description Retrieve files and directories within a specific folder path with pagination, sorting, and filtering support
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param path query string false "Folder path" example(/home/user/documents)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 100, max: 500)" example(100)
// @Param sort_by query string false "Sort field: name, size, modified (default: name)" example(name)
// @Param sort_order query string false "Sort order: asc, desc (default: asc)" example(asc)
// @Param file_type query string false "Filter by file type/extension" example(pdf)
// @Param min_size query int false "Minimum file size in bytes" example(1024)
// @Param max_size query int false "Maximum file size in bytes" example(10485760)
// @Success 200 {object} GetFilesByFolderResponse "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume or folder not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/explorer/files [get]
func (h *Handler) GetFilesByFolder(c *gin.Context) {
	var req GetFilesByFolderRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Validate and set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	// Calculate offset for pagination
	offset := (req.Page - 1) * req.Limit

	// Validate organization access to volume
	if !h.validateVolumeAccess(c, req.VolumeID) {
		return
	}

	// Get files from store with proper pagination
	fileRepo := h.store.Files()
	folderRepo := h.store.Folders()

	var files []*models.File
	var totalCount int
	var err error

	if req.Path == "" || req.Path == "/" {
		// List files at volume root with database-level pagination
		files, err = fileRepo.ListFilesByVolume(c.Request.Context(), req.VolumeID, int32(req.Limit), int32(offset))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve files", "details": err.Error()})
			return
		}

		// Get accurate count for pagination (this would ideally be a separate count query)
		// For now, estimate based on returned results
		if len(files) < req.Limit {
			totalCount = len(files) + offset
		} else {
			// Estimate there are more pages
			totalCount = offset + req.Limit + 1
		}
	} else {
		// Get folder by path first
		folder, err := folderRepo.GetFolderByPath(c.Request.Context(), req.VolumeID, req.Path)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found", "details": err.Error()})
			return
		}

		// List files in the specific folder with database-level pagination
		files, err = fileRepo.ListFilesByFolder(c.Request.Context(), folder.ID, int32(req.Limit), int32(offset))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve files", "details": err.Error()})
			return
		}

		// Estimate count for pagination
		if len(files) < req.Limit {
			totalCount = len(files) + offset
		} else {
			totalCount = offset + req.Limit + 1
		}
	}

	// Apply filtering before conversion (if filters are specified)
	if req.FileType != "" || req.MinSize > 0 || req.MaxSize > 0 {
		filteredFiles := make([]*models.File, 0)
		for _, file := range files {
			// File type/extension filter
			if req.FileType != "" {
				if file.Extension == nil || !strings.EqualFold(*file.Extension, req.FileType) {
					continue
				}
			}

			// Size range filters
			if req.MinSize > 0 && file.SizeBytes < req.MinSize {
				continue
			}
			if req.MaxSize > 0 && file.SizeBytes > req.MaxSize {
				continue
			}

			filteredFiles = append(filteredFiles, file)
		}
		files = filteredFiles
		totalCount = len(files) // Recalculate total after filtering
	}

	// Convert to FileInfo structs
	fileInfos := h.convertFilesToFileInfos(files)

	// Apply sorting
	if req.SortBy != "" && req.SortOrder != "" {
		h.sortFileInfos(fileInfos, req.SortBy, req.SortOrder)
	}

	// Calculate pagination info
	totalPages := (totalCount + req.Limit - 1) / req.Limit

	response := GetFilesByFolderResponse{
		Files:      fileInfos,
		TotalCount: totalCount,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}

	c.JSON(http.StatusOK, response)
}

// GetFolderTree gets hierarchical folder structure
// @Summary Get folder tree
// @Description Retrieve hierarchical folder structure with optional depth limit and directory-only filtering
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param root_path query string false "Root path to start tree from" example(/home/user)
// @Param max_depth query int false "Maximum tree depth (default: 3)" example(3)
// @Param dirs_only query bool false "Include only directories (default: true)" example(true)
// @Success 200 {object} GetFolderTreeResponse "Folder tree retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume or root path not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/explorer/tree [get]
func (h *Handler) GetFolderTree(c *gin.Context) {
	var req GetFolderTreeRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Set defaults
	if req.MaxDepth < 1 {
		req.MaxDepth = 3
	}
	if req.MaxDepth > 10 {
		req.MaxDepth = 10 // Prevent excessive depth
	}

	// Get folder tree from store
	folderRepo := h.store.Folders()

	// For now, use a simplified tree structure using existing folder methods
	rootFolders, err := folderRepo.GetRootFolders(c.Request.Context(), req.VolumeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build folder tree", "details": err.Error()})
		return
	}

	// Convert to FolderNode structs
	var tree []FolderNode
	for _, folder := range rootFolders {
		folderNode := FolderNode{
			Name: filepath.Base(folder.Path),
			Path: folder.Path,
		}

		// Get folder stats if available
		tree = append(tree, folderNode)
	}

	response := GetFolderTreeResponse{
		Tree: tree,
	}

	c.JSON(http.StatusOK, response)
}

// GetFilesByMediaType gets files by media type with pagination
// @Summary Get files by media type
// @Description Retrieve files filtered by media type (MIME type) with pagination support
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param media_type query string true "Media type to filter by" example(image/jpeg)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 100, max: 500)" example(100)
// @Success 200 {object} GetFilesByFolderResponse "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/explorer/files/by-media-type [get]
func (h *Handler) GetFilesByMediaType(c *gin.Context) {
	var req GetFilesByMediaTypeRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Validate and set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	// Calculate offset
	offset := (req.Page - 1) * req.Limit

	// Validate organization access to volume
	if !h.validateVolumeAccess(c, req.VolumeID) {
		return
	}

	// Get files from store
	fileRepo := h.store.Files()
	files, err := fileRepo.GetFilesByMimeType(c.Request.Context(), req.VolumeID, req.MediaType, int32(req.Limit), int32(offset))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve files", "details": err.Error()})
		return
	}

	// Get total count (approximated)
	allFiles, err := fileRepo.GetFilesByMimeType(c.Request.Context(), req.VolumeID, req.MediaType, 10000, 0)
	totalCount := 0
	if err == nil {
		totalCount = len(allFiles)
	}

	// Convert to FileInfo structs
	var fileInfos []FileInfo
	for _, file := range files {
		fileInfo := FileInfo{
			Name:        filepath.Base(file.Path),
			Path:        file.Path,
			Size:        file.SizeBytes,
			IsDirectory: false,
		}

		// Handle modification time
		if file.Mtime != nil {
			fileInfo.ModifiedTime = file.Mtime.Format("2006-01-02T15:04:05Z")
		} else {
			fileInfo.ModifiedTime = file.CreatedAt.Format("2006-01-02T15:04:05Z")
		}

		// Add extension and media type
		if file.Extension != nil {
			fileInfo.Extension = *file.Extension
		}
		if file.Mime != nil {
			fileInfo.MediaType = *file.Mime
		}

		fileInfos = append(fileInfos, fileInfo)
	}

	// Calculate pagination info
	totalPages := (totalCount + req.Limit - 1) / req.Limit

	response := GetFilesByFolderResponse{
		Files:      fileInfos,
		TotalCount: totalCount,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}

	c.JSON(http.StatusOK, response)
}

// GetFilesByExtension gets files by file extension with pagination
// @Summary Get files by extension
// @Description Retrieve files filtered by file extension with pagination support
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param extension query string true "File extension to filter by" example(pdf)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 100, max: 500)" example(100)
// @Success 200 {object} GetFilesByFolderResponse "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/explorer/files/by-extension [get]
func (h *Handler) GetFilesByExtension(c *gin.Context) {
	var req GetFilesByExtensionRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Validate and set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	// Calculate offset
	offset := (req.Page - 1) * req.Limit

	// Validate organization access to volume
	if !h.validateVolumeAccess(c, req.VolumeID) {
		return
	}

	// Get files from store
	fileRepo := h.store.Files()
	files, err := fileRepo.GetFilesByExtension(c.Request.Context(), req.VolumeID, req.Extension, int32(req.Limit), int32(offset))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve files", "details": err.Error()})
		return
	}

	// Get total count (approximated)
	allFiles, err := fileRepo.GetFilesByExtension(c.Request.Context(), req.VolumeID, req.Extension, 10000, 0)
	totalCount := 0
	if err == nil {
		totalCount = len(allFiles)
	}

	// Convert to FileInfo structs
	var fileInfos []FileInfo
	for _, file := range files {
		fileInfo := FileInfo{
			Name:        filepath.Base(file.Path),
			Path:        file.Path,
			Size:        file.SizeBytes,
			IsDirectory: false,
		}

		// Handle modification time
		if file.Mtime != nil {
			fileInfo.ModifiedTime = file.Mtime.Format("2006-01-02T15:04:05Z")
		} else {
			fileInfo.ModifiedTime = file.CreatedAt.Format("2006-01-02T15:04:05Z")
		}

		// Add extension and media type
		if file.Extension != nil {
			fileInfo.Extension = *file.Extension
		}
		if file.Mime != nil {
			fileInfo.MediaType = *file.Mime
		}

		fileInfos = append(fileInfos, fileInfo)
	}

	// Calculate pagination info
	totalPages := (totalCount + req.Limit - 1) / req.Limit

	response := GetFilesByFolderResponse{
		Files:      fileInfos,
		TotalCount: totalCount,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}

	c.JSON(http.StatusOK, response)
}

// GetRecentFiles gets recently modified files
// @Summary Get recent files
// @Description Retrieve files that were modified within the specified number of days
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param days query int false "Number of days to look back (default: 7)" example(7)
// @Param limit query int false "Maximum number of files to return (default: 100, max: 500)" example(100)
// @Success 200 {object} GetFilesByFolderResponse "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/explorer/files/recent [get]
func (h *Handler) GetRecentFiles(c *gin.Context) {
	var req GetRecentFilesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Validate and set defaults
	if req.Days < 1 {
		req.Days = 7
	}
	if req.Limit < 1 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	// Calculate time threshold
	since := time.Now().AddDate(0, 0, -req.Days)

	// Validate organization access to volume
	if !h.validateVolumeAccess(c, req.VolumeID) {
		return
	}

	// Get files from store
	fileRepo := h.store.Files()
	files, err := fileRepo.GetRecentFiles(c.Request.Context(), req.VolumeID, since, int32(req.Limit))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve files", "details": err.Error()})
		return
	}

	// Convert to FileInfo structs
	var fileInfos []FileInfo
	for _, file := range files {
		fileInfo := FileInfo{
			Name:        filepath.Base(file.Path),
			Path:        file.Path,
			Size:        file.SizeBytes,
			IsDirectory: false,
		}

		// Handle modification time
		if file.Mtime != nil {
			fileInfo.ModifiedTime = file.Mtime.Format("2006-01-02T15:04:05Z")
		} else {
			fileInfo.ModifiedTime = file.CreatedAt.Format("2006-01-02T15:04:05Z")
		}

		// Add extension and media type
		if file.Extension != nil {
			fileInfo.Extension = *file.Extension
		}
		if file.Mime != nil {
			fileInfo.MediaType = *file.Mime
		}

		fileInfos = append(fileInfos, fileInfo)
	}

	response := GetFilesByFolderResponse{
		Files:      fileInfos,
		TotalCount: len(fileInfos),
		Page:       1,
		Limit:      req.Limit,
		TotalPages: 1,
	}

	c.JSON(http.StatusOK, response)
}

// SearchFiles searches for files by name pattern
// @Summary Search files by name
// @Description Search for files by name pattern with fuzzy matching support
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param query query string true "Search query/pattern" example(document)
// @Param limit query int false "Maximum number of files to return (default: 100, max: 500)" example(100)
// @Success 200 {object} GetFilesByFolderResponse "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/explorer/files/search [get]
func (h *Handler) SearchFiles(c *gin.Context) {
	var req SearchFilesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Validate and set defaults
	if req.Limit < 1 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	// Search files by name pattern (using SQL LIKE with wildcards)
	searchPattern := "%" + req.Query + "%"

	// Get files from store
	fileRepo := h.store.Files()
	files, err := fileRepo.SearchFilesByName(c.Request.Context(), req.VolumeID, searchPattern, int32(req.Limit))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search files", "details": err.Error()})
		return
	}

	// Convert to FileInfo structs
	var fileInfos []FileInfo
	for _, file := range files {
		fileInfo := FileInfo{
			Name:        filepath.Base(file.Path),
			Path:        file.Path,
			Size:        file.SizeBytes,
			IsDirectory: false,
		}

		// Handle modification time
		if file.Mtime != nil {
			fileInfo.ModifiedTime = file.Mtime.Format("2006-01-02T15:04:05Z")
		} else {
			fileInfo.ModifiedTime = file.CreatedAt.Format("2006-01-02T15:04:05Z")
		}

		// Add extension and media type
		if file.Extension != nil {
			fileInfo.Extension = *file.Extension
		}
		if file.Mime != nil {
			fileInfo.MediaType = *file.Mime
		}

		fileInfos = append(fileInfos, fileInfo)
	}

	response := GetFilesByFolderResponse{
		Files:      fileInfos,
		TotalCount: len(fileInfos),
		Page:       1,
		Limit:      req.Limit,
		TotalPages: 1,
	}

	c.JSON(http.StatusOK, response)
}

// getMediaTypeFromExtension returns media type based on file extension
func getMediaTypeFromExtension(ext string) string {
	ext = strings.ToLower(ext)

	mediaTypes := map[string]string{
		// Images
		"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
		"bmp": "image/bmp", "tiff": "image/tiff", "svg": "image/svg+xml", "webp": "image/webp",

		// Videos
		"mp4": "video/mp4", "avi": "video/x-msvideo", "mov": "video/quicktime",
		"wmv": "video/x-ms-wmv", "mkv": "video/x-matroska", "flv": "video/x-flv",
		"webm": "video/webm", "m4v": "video/x-m4v",

		// Audio
		"mp3": "audio/mpeg", "wav": "audio/wav", "flac": "audio/flac",
		"aac": "audio/aac", "ogg": "audio/ogg", "m4a": "audio/mp4",

		// Documents
		"pdf": "application/pdf", "doc": "application/msword",
		"docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"xls":  "application/vnd.ms-excel",
		"xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"ppt":  "application/vnd.ms-powerpoint",
		"pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"txt":  "text/plain", "rtf": "application/rtf",

		// Archives
		"zip": "application/zip", "rar": "application/vnd.rar",
		"7z": "application/x-7z-compressed", "tar": "application/x-tar",
		"gz": "application/gzip",

		// Code
		"js": "application/javascript", "css": "text/css", "html": "text/html",
		"json": "application/json", "xml": "application/xml", "yaml": "application/yaml",
		"yml": "application/yaml", "go": "text/plain", "py": "text/plain",
		"java": "text/plain", "cpp": "text/plain", "c": "text/plain",
	}

	if mediaType, exists := mediaTypes[ext]; exists {
		return mediaType
	}

	return "application/octet-stream"
}

// GetFolderBrowsing provides enhanced folder browsing with parent/child relationships
// @Summary Browse folder hierarchy
// @Description Browse folders with parent/child relationships for navigation breadcrumbs and tree structure
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param path query string false "Folder path to browse" example(/home/user/documents)
// @Param include_parent query bool false "Include parent folder info" example(true)
// @Param include_children query bool false "Include child folders" example(true)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 100, max: 500)" example(100)
// @Success 200 {object} FolderBrowsingResponse "Folder browsing data retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume or folder not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/explorer/browse [get]
func (h *Handler) GetFolderBrowsing(c *gin.Context) {
	var req FolderBrowsingRequest
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

	folderRepo := h.store.Folders()
	ctx := c.Request.Context()

	var currentFolder *models.Folder
	var err error

	if req.Path != "" && req.Path != "/" {
		// Get current folder
		currentFolder, err = folderRepo.GetFolderByPath(ctx, req.VolumeID, req.Path)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found", "details": err.Error()})
			return
		}
	}

	response := FolderBrowsingResponse{
		VolumeID:    req.VolumeID,
		CurrentPath: req.Path,
		Page:        req.Page,
		Limit:       req.Limit,
	}

	// Include parent information if requested
	if req.IncludeParent && currentFolder != nil && currentFolder.ParentID != nil {
		parentFolder, err := folderRepo.GetFolderByID(ctx, *currentFolder.ParentID)
		if err == nil {
			response.Parent = &FolderBrowsingItem{
				ID:          parentFolder.ID,
				Name:        parentFolder.Name,
				Path:        parentFolder.Path,
				FileCount:   parentFolder.FileCount,
				FolderCount: parentFolder.DirCount,
				TotalSize:   parentFolder.SizeBytesRecursive,
				IsDirectory: true,
			}
		}
	}

	// Include children if requested
	if req.IncludeChildren {
		var childFolders []*models.Folder

		if currentFolder == nil {
			// Get root folders
			childFolders, err = folderRepo.GetRootFolders(ctx, req.VolumeID)
		} else {
			// Get child folders
			childFolders, err = folderRepo.ListFoldersByParent(ctx, req.VolumeID, &currentFolder.ID)
		}

		if err == nil {
			// Apply pagination to children
			offset := (req.Page - 1) * req.Limit
			totalChildren := len(childFolders)

			if offset < totalChildren {
				end := offset + req.Limit
				if end > totalChildren {
					end = totalChildren
				}
				childFolders = childFolders[offset:end]
			} else {
				childFolders = []*models.Folder{}
			}

			// Convert to response format
			for _, folder := range childFolders {
				child := FolderBrowsingItem{
					ID:          folder.ID,
					Name:        folder.Name,
					Path:        folder.Path,
					FileCount:   folder.FileCount,
					FolderCount: folder.DirCount,
					TotalSize:   folder.SizeBytesRecursive,
					IsDirectory: true,
					HasChildren: folder.DirCount > 0,
				}
				response.Children = append(response.Children, child)
			}

			response.TotalChildren = totalChildren
			response.TotalPages = (totalChildren + req.Limit - 1) / req.Limit
		}
	}

	// Add breadcrumb path if current folder exists
	if currentFolder != nil {
		response.Current = &FolderBrowsingItem{
			ID:          currentFolder.ID,
			Name:        currentFolder.Name,
			Path:        currentFolder.Path,
			FileCount:   currentFolder.FileCount,
			FolderCount: currentFolder.DirCount,
			TotalSize:   currentFolder.SizeBytesRecursive,
			IsDirectory: true,
			HasChildren: currentFolder.DirCount > 0,
		}
	}

	c.JSON(http.StatusOK, response)
}

// GetFilesPaginated provides enhanced file listing with proper database-level pagination
// @Summary Get files with optimized pagination
// @Description Enhanced file listing endpoint with database-level pagination, advanced filtering, and performance optimizations
// @Tags Explorer
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID" example(vol_123)
// @Param path query string false "Folder path" example(/home/user/documents)
// @Param page query int false "Page number (default: 1)" example(1)
// @Param limit query int false "Items per page (default: 50, max: 200)" example(50)
// @Param sort_by query string false "Sort field: name, size, modified (default: name)" example(name)
// @Param sort_order query string false "Sort order: asc, desc (default: asc)" example(asc)
// @Param file_type query string false "Filter by file type/extension" example(pdf)
// @Param mime_type query string false "Filter by MIME type" example(application/pdf)
// @Param min_size query int false "Minimum file size in bytes" example(1024)
// @Param max_size query int false "Maximum file size in bytes" example(10485760)
// @Success 200 {object} PaginatedFileResponse "Files retrieved successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request parameters"
// @Failure 404 {object} map[string]interface{} "Volume or folder not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/explorer/files/paginated [get]
func (h *Handler) GetFilesPaginated(c *gin.Context) {
	var req PaginatedFileRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	// Set defaults and validate
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 50
	}
	if req.Limit > 200 {
		req.Limit = 200 // Stricter limit for better performance
	}
	if req.SortBy == "" {
		req.SortBy = "name"
	}
	if req.SortOrder == "" {
		req.SortOrder = "asc"
	}

	// Use pagination optimizer for enhanced performance
	optimizer := NewPaginationOptimizer(h.store)

	query := OptimizedFileQuery{
		VolumeID:   req.VolumeID,
		FolderPath: req.Path,
		Page:       req.Page,
		Limit:      req.Limit,
		SortBy:     req.SortBy,
		SortOrder:  req.SortOrder,
		Filters: FileQueryFilters{
			FileType:  req.FileType,
			MinSize:   req.MinSize,
			MaxSize:   req.MaxSize,
			Extension: req.FileType,
			MimeType:  req.MimeType,
		},
		EnableCaching: true,
	}

	result, err := optimizer.ExecuteOptimizedFileQuery(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve files", "details": err.Error()})
		return
	}

	// Convert to enhanced response format
	var fileItems []EnhancedFileItem
	for _, file := range result.Files {
		item := EnhancedFileItem{
			ID:          file.ID,
			Name:        file.Name,
			Path:        file.Path,
			Size:        file.SizeBytes,
			DiskUsage:   file.DiskUsageBytes,
			IsDirectory: false,
		}

		// Handle modification time
		if file.Mtime != nil {
			item.ModifiedTime = file.Mtime.Format("2006-01-02T15:04:05Z")
		} else {
			item.ModifiedTime = file.CreatedAt.Format("2006-01-02T15:04:05Z")
		}

		// Add metadata
		if file.Extension != nil {
			item.Extension = *file.Extension
		}
		if file.Mime != nil {
			item.MediaType = *file.Mime
		}
		if file.MediaKind != nil {
			item.MediaKind = *file.MediaKind
		}

		fileItems = append(fileItems, item)
	}

	// Apply sorting using existing helper
	h.sortEnhancedFileItems(fileItems, req.SortBy, req.SortOrder)

	totalPages := (result.TotalCount + req.Limit - 1) / req.Limit

	response := PaginatedFileResponse{
		Files:      fileItems,
		TotalCount: result.TotalCount,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
		HasMore:    result.HasMore,
		SortBy:     req.SortBy,
		SortOrder:  req.SortOrder,
		QueryTime:  result.QueryTime,
		CacheHit:   result.CacheHit,
		Filters: AppliedFilters{
			FileType: req.FileType,
			MimeType: req.MimeType,
			MinSize:  req.MinSize,
			MaxSize:  req.MaxSize,
		},
	}

	// Set Cache-Control headers for static metadata optimization
	c.Header("Cache-Control", "public, max-age=300")
	c.Header("ETag", "\"files-"+req.VolumeID+"-"+req.Path+"\"")
	c.Header("Last-Modified", time.Now().Format(time.RFC1123))

	c.JSON(http.StatusOK, response)
}

// Helper methods for enhanced file operations

// getFilteredFiles retrieves files with filtering applied
func (h *Handler) getFilteredFiles(ctx context.Context, fileRepo interface{}, volumeID, folderPath string, req *GetFilesByFolderRequest, offset int) ([]*models.File, error) {
	// This is a simplified implementation - in production, filtering would be done in the database
	var files []*models.File
	var err error

	// Get base files
	if folderPath == "" {
		// For interface compatibility, we'll need to cast to the concrete type
		if fr, ok := fileRepo.(interface {
			ListFilesByVolume(ctx context.Context, volumeID string, limit, offset int32) ([]*models.File, error)
		}); ok {
			files, err = fr.ListFilesByVolume(ctx, volumeID, 10000, 0) // Get all for filtering
		}
	} else {
		// Get folder first and list files by folder
		folderRepo := h.store.Folders()
		folder, folderErr := folderRepo.GetFolderByPath(ctx, volumeID, folderPath)
		if folderErr != nil {
			return nil, folderErr
		}

		if fr, ok := fileRepo.(interface {
			ListFilesByFolder(ctx context.Context, folderID int64, limit, offset int32) ([]*models.File, error)
		}); ok {
			files, err = fr.ListFilesByFolder(ctx, folder.ID, 10000, 0) // Get all for filtering
		}
	}

	if err != nil {
		return nil, err
	}

	// Apply filters
	filtered := make([]*models.File, 0)
	for _, file := range files {
		// File type filter
		if req.FileType != "" {
			if file.Extension == nil || !strings.EqualFold(*file.Extension, req.FileType) {
				continue
			}
		}

		// Size filters
		if req.MinSize > 0 && file.SizeBytes < req.MinSize {
			continue
		}
		if req.MaxSize > 0 && file.SizeBytes > req.MaxSize {
			continue
		}

		filtered = append(filtered, file)
	}

	return filtered, nil
}

// convertFilesToFileInfos converts model files to FileInfo structs
func (h *Handler) convertFilesToFileInfos(files []*models.File) []FileInfo {
	fileInfos := make([]FileInfo, len(files))
	for i, file := range files {
		fileInfo := FileInfo{
			Name:        filepath.Base(file.Path),
			Path:        file.Path,
			Size:        file.SizeBytes,
			IsDirectory: false, // All files from file repo are files
		}

		// Handle modification time
		if file.Mtime != nil {
			fileInfo.ModifiedTime = file.Mtime.Format("2006-01-02T15:04:05Z")
		} else {
			fileInfo.ModifiedTime = file.CreatedAt.Format("2006-01-02T15:04:05Z")
		}

		// Add extension and media type for files
		if file.Extension != nil {
			fileInfo.Extension = *file.Extension
		}
		if file.Mime != nil {
			fileInfo.MediaType = *file.Mime
		} else if file.Extension != nil {
			fileInfo.MediaType = getMediaTypeFromExtension(*file.Extension)
		}

		fileInfos[i] = fileInfo
	}
	return fileInfos
}

// sortFileInfos sorts FileInfo slice by the specified field and order
func (h *Handler) sortFileInfos(files []FileInfo, sortBy, sortOrder string) {
	sort.Slice(files, func(i, j int) bool {
		var less bool
		switch sortBy {
		case "name":
			less = strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
		case "size":
			less = files[i].Size < files[j].Size
		case "modified":
			// Parse times for comparison
			time1, err1 := time.Parse("2006-01-02T15:04:05Z", files[i].ModifiedTime)
			time2, err2 := time.Parse("2006-01-02T15:04:05Z", files[j].ModifiedTime)
			if err1 != nil || err2 != nil {
				less = files[i].ModifiedTime < files[j].ModifiedTime
			} else {
				less = time1.Before(time2)
			}
		default:
			less = strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
		}

		if sortOrder == "desc" {
			return !less
		}
		return less
	})
}

// sortEnhancedFileItems sorts EnhancedFileItem slice by the specified field and order
func (h *Handler) sortEnhancedFileItems(files []EnhancedFileItem, sortBy, sortOrder string) {
	sort.Slice(files, func(i, j int) bool {
		var less bool
		switch sortBy {
		case "name":
			less = strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
		case "size":
			less = files[i].Size < files[j].Size
		case "modified":
			// Parse times for comparison
			time1, err1 := time.Parse("2006-01-02T15:04:05Z", files[i].ModifiedTime)
			time2, err2 := time.Parse("2006-01-02T15:04:05Z", files[j].ModifiedTime)
			if err1 != nil || err2 != nil {
				less = files[i].ModifiedTime < files[j].ModifiedTime
			} else {
				less = time1.Before(time2)
			}
		default:
			less = strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
		}

		if sortOrder == "desc" {
			return !less
		}
		return less
	})
}
