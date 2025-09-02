package duplicates

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles duplicate detection API requests
type Handler struct {
	store    store.Store
	detector *services.DuplicateDetector
}

// NewHandler creates a new duplicates handler
func NewHandler(store store.Store) *Handler {
	return &Handler{
		store:    store,
		detector: services.NewDuplicateDetector(store),
	}
}

// DetectDuplicates godoc
// @Summary Detect duplicate files
// @Description Find duplicate files by content hash in the specified volume and path
// @Tags Duplicates
// @Accept json
// @Produce json
// @Param volumeId query string true "Volume ID" example("media-library")
// @Param path query string false "Starting path" default("/") example("/movies")
// @Param minSize query int false "Minimum file size in bytes" example(1048576)
// @Param maxSize query int false "Maximum file size in bytes" example(104857600)
// @Param includeEmpty query bool false "Include empty files" default(false)
// @Success 200 {object} DuplicateDetectionResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /api/v1/duplicates/detect [get]
func (h *Handler) DetectDuplicates(c *gin.Context) {
	// Parse parameters
	volumeID := c.Query("volumeId")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "volumeId is required",
		})
		return
	}

	path := c.DefaultQuery("path", "/")
	minSize := h.parseInt64(c.Query("minSize"), 0)
	maxSize := h.parseInt64(c.Query("maxSize"), 0)
	includeEmpty := c.DefaultQuery("includeEmpty", "false") == "true"

	// Create request
	req := services.DuplicateDetectionRequest{
		VolumeID:     volumeID,
		Path:         path,
		MinSize:      minSize,
		MaxSize:      maxSize,
		IncludeEmpty: includeEmpty,
	}

	// Start timing
	start := time.Now()

	// Detect duplicates
	result, err := h.detector.DetectDuplicates(c.Request.Context(), req)
	if err != nil {
		log.Printf("Failed to detect duplicates for volume %s, path %s: %v", volumeID, path, err)
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to detect duplicates",
		})
		return
	}

	// Build response
	response := DuplicateDetectionResponse{
		Groups:           convertDuplicateGroups(result.Groups),
		Summary:          buildDuplicateSummary(*result),
		ProcessingTime:   time.Since(start).Milliseconds(),
		Timestamp:        time.Now(),
		Parameters:       buildRequestParameters(req),
	}

	c.JSON(http.StatusOK, response)
}

// DetectDuplicatesBySize godoc
// @Summary Detect potential duplicates by file size
// @Description Find potential duplicate files by matching file sizes (faster than hash-based detection)
// @Tags Duplicates
// @Accept json
// @Produce json
// @Param volumeId query string true "Volume ID" example("media-library")
// @Param path query string false "Starting path" default("/") example("/movies")
// @Param minSize query int false "Minimum file size in bytes" example(1048576)
// @Param maxSize query int false "Maximum file size in bytes" example(104857600)
// @Param includeEmpty query bool false "Include empty files" default(false)
// @Success 200 {object} DuplicateDetectionResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /api/v1/duplicates/detect-by-size [get]
func (h *Handler) DetectDuplicatesBySize(c *gin.Context) {
	// Parse parameters (same as DetectDuplicates)
	volumeID := c.Query("volumeId")
	if volumeID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "volumeId is required",
		})
		return
	}

	path := c.DefaultQuery("path", "/")
	minSize := h.parseInt64(c.Query("minSize"), 0)
	maxSize := h.parseInt64(c.Query("maxSize"), 0)
	includeEmpty := c.DefaultQuery("includeEmpty", "false") == "true"

	// Create request
	req := services.DuplicateDetectionRequest{
		VolumeID:     volumeID,
		Path:         path,
		MinSize:      minSize,
		MaxSize:      maxSize,
		IncludeEmpty: includeEmpty,
	}

	// Start timing
	start := time.Now()

	// Detect duplicates by size
	result, err := h.detector.GetDuplicatesBySize(c.Request.Context(), req)
	if err != nil {
		log.Printf("Failed to detect duplicates by size for volume %s, path %s: %v", volumeID, path, err)
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to detect duplicates by size",
		})
		return
	}

	// Build response
	response := DuplicateDetectionResponse{
		Groups:           convertDuplicateGroups(result.Groups),
		Summary:          buildDuplicateSummary(*result),
		ProcessingTime:   time.Since(start).Milliseconds(),
		Timestamp:        time.Now(),
		Parameters:       buildRequestParameters(req),
	}

	c.JSON(http.StatusOK, response)
}

// VerifyDuplicateGroup godoc
// @Summary Verify a duplicate group with hash comparison
// @Description Verify a size-based duplicate group by calculating and comparing file hashes
// @Tags Duplicates
// @Accept json
// @Produce json
// @Param groupId path string true "Duplicate group ID" example("size-dup-1")
// @Param group body DuplicateGroup true "Duplicate group to verify"
// @Success 200 {object} DuplicateGroup
// @Failure 400 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /api/v1/duplicates/verify/{groupId} [post]
func (h *Handler) VerifyDuplicateGroup(c *gin.Context) {
	groupID := c.Param("groupId")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "groupId is required",
		})
		return
	}

	var group DuplicateGroup
	if err := c.ShouldBindJSON(&group); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: "Invalid group data: " + err.Error(),
		})
		return
	}

	// Convert to service type
	serviceGroup := convertToServiceGroup(group)

	// Verify with hash
	verifiedGroup, err := h.detector.VerifyDuplicatesWithHash(c.Request.Context(), serviceGroup)
	if err != nil {
		log.Printf("Failed to verify duplicate group %s: %v", groupID, err)
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to verify duplicate group",
		})
		return
	}

	// Convert back to response type
	response := convertDuplicateGroup(*verifiedGroup)
	c.JSON(http.StatusOK, response)
}

// RegisterRoutes registers the duplicate detection routes
func (h *Handler) RegisterRoutes(g *gin.RouterGroup) {
	g.GET("/duplicates/detect", h.DetectDuplicates)
	g.GET("/duplicates/detect-by-size", h.DetectDuplicatesBySize)
	g.POST("/duplicates/verify/:groupId", h.VerifyDuplicateGroup)
}

// Helper functions

func (h *Handler) parseInt64(value string, defaultValue int64) int64 {
	if value == "" {
		return defaultValue
	}
	result, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return defaultValue
	}
	return result
}

// Response types

// DuplicateDetectionResponse represents the response for duplicate detection
type DuplicateDetectionResponse struct {
	Groups         []DuplicateGroup       `json:"groups"`
	Summary        DuplicateSummary       `json:"summary"`
	ProcessingTime int64                  `json:"processing_time_ms"`
	Timestamp      time.Time              `json:"timestamp"`
	Parameters     DetectionParameters    `json:"parameters"`
}

// DuplicateGroup represents a group of duplicate files (API response format)
type DuplicateGroup struct {
	ID          string                 `json:"id" example:"dup-1"`
	Hash        string                 `json:"hash,omitempty" example:"d41d8cd98f00b204e9800998ecf8427e"`
	Size        int64                  `json:"size" example:"2048000"`
	Count       int                    `json:"count" example:"3"`
	Files       []models.DuplicateFile `json:"files"`
	WastedSpace int64                  `json:"wasted_space" example:"4096000"`
	CreatedAt   time.Time              `json:"created_at"`
}

// DuplicateSummary provides overall statistics about duplicate detection
type DuplicateSummary struct {
	TotalGroups      int   `json:"total_groups" example:"15"`
	TotalDuplicates  int   `json:"total_duplicates" example:"42"`
	TotalWastedSpace int64 `json:"total_wasted_space" example:"536870912"`
	ProcessedFiles   int   `json:"processed_files" example:"10000"`
	LargestGroup     *struct {
		ID          string `json:"id" example:"dup-5"`
		Count       int    `json:"count" example:"8"`
		WastedSpace int64  `json:"wasted_space" example:"134217728"`
	} `json:"largest_group,omitempty"`
}

// DetectionParameters shows the parameters used for detection
type DetectionParameters struct {
	VolumeID     string `json:"volume_id" example:"media-library"`
	Path         string `json:"path" example:"/movies"`
	MinSize      int64  `json:"min_size,omitempty" example:"1048576"`
	MaxSize      int64  `json:"max_size,omitempty" example:"104857600"`
	IncludeEmpty bool   `json:"include_empty" example:"false"`
}

// Conversion functions

func convertDuplicateGroups(serviceGroups []services.DuplicateGroup) []DuplicateGroup {
	groups := make([]DuplicateGroup, len(serviceGroups))
	for i, sg := range serviceGroups {
		groups[i] = convertDuplicateGroup(sg)
	}
	return groups
}

func convertDuplicateGroup(sg services.DuplicateGroup) DuplicateGroup {
	return DuplicateGroup{
		ID:          sg.ID,
		Hash:        sg.Hash,
		Size:        sg.Size,
		Count:       sg.Count,
		Files:       sg.Files,
		WastedSpace: sg.WastedSpace,
		CreatedAt:   sg.CreatedAt,
	}
}

func convertToServiceGroup(group DuplicateGroup) services.DuplicateGroup {
	return services.DuplicateGroup{
		ID:          group.ID,
		Hash:        group.Hash,
		Size:        group.Size,
		Count:       group.Count,
		Files:       group.Files,
		WastedSpace: group.WastedSpace,
		CreatedAt:   group.CreatedAt,
	}
}

func buildDuplicateSummary(result services.DuplicateDetectionResult) DuplicateSummary {
	summary := DuplicateSummary{
		TotalGroups:      len(result.Groups),
		TotalDuplicates:  result.TotalDuplicates,
		TotalWastedSpace: result.TotalWastedSpace,
		ProcessedFiles:   result.ProcessedFiles,
	}

	// Find largest group by wasted space
	if len(result.Groups) > 0 {
		largestGroup := &result.Groups[0]
		for i := range result.Groups {
			if result.Groups[i].WastedSpace > largestGroup.WastedSpace {
				largestGroup = &result.Groups[i]
			}
		}

		summary.LargestGroup = &struct {
			ID          string `json:"id" example:"dup-5"`
			Count       int    `json:"count" example:"8"`
			WastedSpace int64  `json:"wasted_space" example:"134217728"`
		}{
			ID:          largestGroup.ID,
			Count:       largestGroup.Count,
			WastedSpace: largestGroup.WastedSpace,
		}
	}

	return summary
}

func buildRequestParameters(req services.DuplicateDetectionRequest) DetectionParameters {
	return DetectionParameters{
		VolumeID:     req.VolumeID,
		Path:         req.Path,
		MinSize:      req.MinSize,
		MaxSize:      req.MaxSize,
		IncludeEmpty: req.IncludeEmpty,
	}
}