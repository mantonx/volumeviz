package systemconfig

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/config"
)

// Handler serves a read-only summary of the process's active configuration
type Handler struct {
	config *config.Config
}

// NewHandler creates a new system-config handler
func NewHandler(cfg *config.Config) *Handler {
	return &Handler{config: cfg}
}

// GetConfig returns the current, real configuration values the running
// process loaded at startup. Every field is read-only - none of it can be
// changed without setting the corresponding env var and restarting.
// @Summary Get current system configuration
// @Description Get a read-only summary of the process's active configuration (scan/retention/rate-limit/CORS settings, etc). All values are loaded once at startup - none are editable here. Admin only.
// @Tags system
// @Accept json
// @Produce json
// @Success 200 {object} models.SystemConfigResponse
// @Router /api/v1/system/config [get]
func (h *Handler) GetConfig(c *gin.Context) {
	cfg := h.config

	response := models.SystemConfigResponse{
		Server: models.SystemConfigServer{
			Mode:         cfg.Server.Mode,
			DatabaseType: cfg.Database.Type,
		},
		Auth: models.SystemConfigAuth{
			Enabled: cfg.Auth.Enabled,
		},
		RateLimit: models.SystemConfigRateLimit{
			Enabled: cfg.RateLimit.Enabled,
			RPM:     cfg.RateLimit.RPM,
			Burst:   cfg.RateLimit.Burst,
		},
		CORS: models.SystemConfigCORS{
			AllowedOrigins: cfg.CORS.AllowedOrigins,
		},
		Scan: models.SystemConfigScan{
			Enabled:           cfg.Scan.Enabled,
			IntervalSeconds:   int(cfg.Scan.Interval.Seconds()),
			Concurrency:       cfg.Scan.Concurrency,
			BindMountsEnabled: cfg.Scan.BindMountsEnabled,
		},
		Retention: models.SystemConfigRetention{
			Enabled:                    cfg.Retention.Enabled,
			ScanJobsRetentionDays:      cfg.Retention.ScanJobsRetentionDays,
			ScanMetricsRetentionDays:   cfg.Retention.ScanMetricsRetentionDays,
			ScanPhasesRetentionDays:    cfg.Retention.ScanPhasesRetentionDays,
			FileMetadataRetentionDays:  cfg.Retention.FileMetadataRetentionDays,
			InactiveFilesRetentionDays: cfg.Retention.InactiveFilesRetentionDays,
		},
		Alerts: models.SystemConfigAlerts{
			Enabled:                   cfg.Alerts.Enabled,
			EvaluationIntervalMinutes: cfg.Alerts.EvaluationIntervalMinutes,
		},
	}

	c.JSON(http.StatusOK, response)
}
