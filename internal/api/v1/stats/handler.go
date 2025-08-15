package stats

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/mantonx/volumeviz/internal/api/models" // For swag annotations
	"github.com/mantonx/volumeviz/internal/api/utils"
	coremodels "github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/stats"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles stats-related HTTP requests with StatsService integration
type Handler struct {
	store        store.Store
	statsService *stats.StatsService // StatsService integration for verification
}

// NewHandler creates a new stats handler
func NewHandler(store store.Store, statsService *stats.StatsService) *Handler {
	return &Handler{
		store:        store,
		statsService: statsService,
	}
}

// GetDailyStats returns daily statistics for a volume
// @Summary Get daily stats
// @Description Get daily aggregated statistics for a volume
// @Tags stats
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID"
// @Param days query int false "Number of days to retrieve" default:30
// @Success 200 {object} models.VolumeStatsResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /stats/daily [get]
func (h *Handler) GetDailyStats(c *gin.Context) {
	volumeID := c.Query("volume_id")
	if volumeID == "" {
		utils.RespondWithBadRequest(c, "Volume ID is required", nil)
		return
	}

	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 1 || days > 365 {
		days = 30
	}

	ctx := c.Request.Context()

	// Calculate date range
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days)

	// Get daily stats from the store
	dailyStats, err := h.store.Stats().GetVolumeStatsHistory(ctx, volumeID, startDate, endDate)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve daily stats", err)
		return
	}

	// TODO: Transform dailyStats to response format
	response := map[string]interface{}{
		"volume_id":  volumeID,
		"stats":      dailyStats,
		"start_date": startDate.Format("2006-01-02"),
		"end_date":   endDate.Format("2006-01-02"),
	}

	c.JSON(http.StatusOK, response)
}

// GetTopFolders returns the largest folders in a volume
// @Summary Get top folders by size
// @Description Get the largest folders in a volume by total size
// @Tags stats
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID"
// @Param limit query int false "Number of folders to return" default:10
// @Success 200 {object} models.TopFoldersResponse
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /stats/top-folders [get]
func (h *Handler) GetTopFolders(c *gin.Context) {
	volumeID := c.Query("volume_id")
	if volumeID == "" {
		utils.RespondWithBadRequest(c, "Volume ID is required", nil)
		return
	}

	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 10
	}

	ctx := c.Request.Context()

	// Get largest folders from the repository
	folders, err := h.store.Folders().GetLargestFolders(ctx, volumeID, int32(limit))
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve top folders", err)
		return
	}

	// Convert to response format
	var folderSizeInfos []coremodels.FolderSizeInfo
	for _, folder := range folders {
		folderSizeInfos = append(folderSizeInfos, coremodels.FolderSizeInfo{
			ID:                      folder.ID,
			Name:                    folder.Name,
			Path:                    folder.Path,
			SizeBytesRecursive:      folder.SizeBytesRecursive,
			DiskUsageBytesRecursive: folder.DiskUsageBytesRecursive,
			FileCount:               folder.FileCount,
			DirCount:                folder.DirCount,
		})
	}

	c.JSON(http.StatusOK, folderSizeInfos)
}

// GetMediaStats gets media type statistics for a volume
// @Summary Get media statistics
// @Description Get statistics aggregated by media type (images, videos, documents, etc.)
// @Tags stats
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID"
// @Success 200 {object} map[string]interface{} "Media statistics"
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /stats/media [get]
func (h *Handler) GetMediaStats(c *gin.Context) {
	volumeID := c.Query("volume_id")
	if volumeID == "" {
		utils.RespondWithBadRequest(c, "Volume ID is required", nil)
		return
	}

	// Get media kind statistics
	fileRepo := h.store.Files()
	mediaStats, err := fileRepo.GetMediaKindStats(c.Request.Context(), volumeID)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve media statistics", err)
		return
	}

	// Get extension statistics
	extensionStats, err := fileRepo.GetExtensionStats(c.Request.Context(), volumeID, 20)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve extension statistics", err)
		return
	}

	// Build response
	response := map[string]interface{}{
		"volume_id":      volumeID,
		"media_kinds":    mediaStats,
		"top_extensions": extensionStats,
		"generated_at":   time.Now().Format("2006-01-02T15:04:05Z"),
	}

	c.JSON(http.StatusOK, response)
}

// GetStorageStats gets storage usage statistics for a volume
// @Summary Get storage statistics
// @Description Get detailed storage usage statistics including size distribution and growth trends
// @Tags stats
// @Accept json
// @Produce json
// @Param volume_id query string true "Volume ID"
// @Success 200 {object} map[string]interface{} "Storage statistics"
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /stats/storage [get]
func (h *Handler) GetStorageStats(c *gin.Context) {
	volumeID := c.Query("volume_id")
	if volumeID == "" {
		utils.RespondWithBadRequest(c, "Volume ID is required", nil)
		return
	}

	// Get file statistics
	fileRepo := h.store.Files()
	fileStats, err := fileRepo.GetFileStats(c.Request.Context(), volumeID)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve file statistics", err)
		return
	}

	// Get folder statistics
	folderRepo := h.store.Folders()
	folderStats, err := folderRepo.GetFolderStats(c.Request.Context(), volumeID)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve folder statistics", err)
		return
	}

	// Get largest files
	largestFiles, err := fileRepo.GetLargestFiles(c.Request.Context(), volumeID, 10)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve largest files", err)
		return
	}

	// Get largest folders
	largestFolders, err := folderRepo.GetLargestFolders(c.Request.Context(), volumeID, 10)
	if err != nil {
		utils.RespondWithInternalError(c, "Failed to retrieve largest folders", err)
		return
	}

	// Build response
	response := map[string]interface{}{
		"volume_id":       volumeID,
		"file_stats":      fileStats,
		"folder_stats":    folderStats,
		"largest_files":   largestFiles,
		"largest_folders": largestFolders,
		"generated_at":    time.Now().Format("2006-01-02T15:04:05Z"),
	}

	c.JSON(http.StatusOK, response)
}
