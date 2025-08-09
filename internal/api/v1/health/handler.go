package health

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/mantonx/volumeviz/internal/events"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/scheduler"
	"github.com/mantonx/volumeviz/internal/version"
)

// Handler handles health-related HTTP requests
type Handler struct {
	dockerService interfaces.DockerService
	db            *database.DB
	eventsService events.EventService
	scheduler     scheduler.ScanScheduler // Optional scan scheduler
}

// NewHandler creates a new health handler
func NewHandler(dockerService interfaces.DockerService, db *database.DB, eventsService events.EventService, scanScheduler scheduler.ScanScheduler) *Handler {
	return &Handler{
		dockerService: dockerService,
		db:            db,
		eventsService: eventsService,
		scheduler:     scanScheduler,
	}
}

// GetDockerHealth returns Docker daemon health status
// @Summary Check Docker health
// @Description Get Docker daemon connection status and version information
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} models.DockerHealth
// @Failure 503 {object} models.ErrorResponse
// @Router /health/docker [get]
func (h *Handler) GetDockerHealth(c *gin.Context) {
	ctx := c.Request.Context()

	// Get Docker version and connection status
	version, versionErr := h.dockerService.GetVersion(ctx)
	dockerAvailable := h.dockerService.IsDockerAvailable(ctx)

	health := models.DockerHealth{
		Status: "healthy",
	}

	if !dockerAvailable || versionErr != nil {
		health.Status = "unhealthy"
		health.Message = "Docker daemon is not available"
		if versionErr != nil {
			health.Message = versionErr.Error()
		}
	} else {
		health.Version = version.Version
		health.APIVersion = version.APIVersion
		health.GoVersion = version.GoVersion
		health.GitCommit = version.GitCommit
		health.BuildTime = version.BuildTime
	}

	statusCode := http.StatusOK
	switch health.Status {
	case "unhealthy":
		statusCode = http.StatusServiceUnavailable
	case "degraded":
		statusCode = http.StatusPartialContent
	}

	c.JSON(statusCode, health)
}

// GetAppHealth returns application health status
// GET /api/v1/health
func (h *Handler) GetAppHealth(c *gin.Context) {
	ctx := c.Request.Context()

	// Check Docker connectivity
	dockerAvailable := h.dockerService.IsDockerAvailable(ctx)

	checks := gin.H{
		"docker": gin.H{
			"status": func() string {
				if dockerAvailable {
					return "healthy"
				}
				return "unhealthy"
			}(),
		},
	}

	// Add events health if events service is available
	if h.eventsService != nil {
		eventsHealth := h.getEventsHealth()
		checks["events"] = eventsHealth
	}

	// Add scheduler health if scheduler is available
	if h.scheduler != nil {
		schedulerHealth := h.getSchedulerHealth()
		checks["scheduler"] = schedulerHealth
	}

	// Optionally add DB connectivity and migration version if DB is wired
	if h.db != nil {
		dbHealth := gin.H{"status": "unknown"}
		migrationVersion := "unknown"
		if st := h.db.Health(); st != nil {
			dbHealth["status"] = st.Status
			dbHealth["response_ms"] = st.ResponseTime.Milliseconds()
		}
		mm := database.NewMigrationManager(h.db)
		if status, err := mm.GetMigrationStatus(); err == nil {
			if status.LastApplied != nil {
				migrationVersion = status.LastApplied.Version
			} else {
				migrationVersion = "none"
			}
		}
		checks["database"] = dbHealth
		checks["migrations"] = gin.H{"current_version": migrationVersion}
	}

	health := gin.H{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
		"version":   version.Get(),
		"checks":    checks,
	}

	// Set overall status based on dependencies
	if !dockerAvailable {
		health["status"] = "degraded"
	} else if h.db != nil {
		if db, ok := checks["database"].(gin.H); ok && db["status"] != "healthy" {
			health["status"] = "degraded"
		}
	}

	// Check events status if available
	if h.eventsService != nil {
		if events, ok := checks["events"].(gin.H); ok {
			eventsStatus, hasStatus := events["status"].(string)
			if hasStatus && eventsStatus == "unhealthy" {
				health["status"] = "degraded"
			}
		}
	}

	statusCode := http.StatusOK
	if health["status"] == "degraded" {
		statusCode = http.StatusPartialContent
	}

	c.JSON(statusCode, health)
}

// GetReadiness returns readiness status for Kubernetes
// GET /api/v1/health/ready
func (h *Handler) GetReadiness(c *gin.Context) {
	ctx := c.Request.Context()

	// Check if all critical dependencies are available
	dockerAvailable := h.dockerService.IsDockerAvailable(ctx)

	if dockerAvailable {
		c.JSON(http.StatusOK, gin.H{
			"status": "ready",
		})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "not ready",
			"reason": "docker unavailable",
		})
	}
}

// GetLiveness returns liveness status for Kubernetes
// GET /api/v1/health/live
func (h *Handler) GetLiveness(c *gin.Context) {
	// Simple liveness check - if we can respond, we're alive
	c.JSON(http.StatusOK, gin.H{
		"status": "alive",
	})
}

// getEventsHealth returns events service health information
func (h *Handler) getEventsHealth() gin.H {
	metrics := h.eventsService.GetMetrics()
	connected := h.eventsService.IsConnected()
	lastEventTime := h.eventsService.GetLastEventTime()
	
	status := "healthy"
	if !connected {
		status = "unhealthy"
	} else if lastEventTime != nil && time.Since(*lastEventTime) > 5*time.Minute {
		// If no events for 5+ minutes, consider it degraded (but not unhealthy)
		status = "degraded"
	}
	
	healthInfo := gin.H{
		"status":              status,
		"connected":           connected,
		"queue_size":          metrics.QueueSize,
		"processed_total":     len(metrics.ProcessedTotal),
		"errors_total":        len(metrics.ErrorsTotal),
		"dropped_total":       metrics.DroppedTotal,
		"reconnects_total":    metrics.ReconnectsTotal,
	}
	
	// Add last event time if available
	if lastEventTime != nil {
		healthInfo["last_event_timestamp"] = lastEventTime.Unix()
		healthInfo["last_event_age_seconds"] = int64(time.Since(*lastEventTime).Seconds())
	}
	
	// Add last reconnect time if available
	if metrics.LastReconnectTime != nil {
		healthInfo["last_reconnect_timestamp"] = metrics.LastReconnectTime.Unix()
	}
	
	// Add reconciliation stats
	if len(metrics.ReconcileRuns) > 0 {
		healthInfo["reconciliation_runs"] = metrics.ReconcileRuns
	}
	
	return healthInfo
}

// GetEventsHealth returns detailed Docker events health status
// @Summary Check Docker events health
// @Description Get Docker events service status and metrics
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Failure 503 {object} models.ErrorResponse
// @Router /health/events [get]
func (h *Handler) GetEventsHealth(c *gin.Context) {
	if h.eventsService == nil {
		c.JSON(http.StatusNotImplemented, gin.H{
			"status": "not_configured",
			"message": "Docker events service is not configured",
		})
		return
	}
	
	eventsHealth := h.getEventsHealth()
	
	statusCode := http.StatusOK
	if status, ok := eventsHealth["status"].(string); ok {
		switch status {
		case "unhealthy":
			statusCode = http.StatusServiceUnavailable
		case "degraded":
			statusCode = http.StatusPartialContent
		}
	}
	
	c.JSON(statusCode, eventsHealth)
}

// getSchedulerHealth returns scheduler health information
func (h *Handler) getSchedulerHealth() gin.H {
	if h.scheduler == nil {
		return gin.H{
			"status": "not_configured",
			"message": "Scan scheduler is not configured",
		}
	}

	status := h.scheduler.GetStatus()
	metrics := h.scheduler.GetMetrics()
	
	schedulerStatus := "healthy"
	
	// Determine health status based on scheduler state
	if !status.Running {
		schedulerStatus = "stopped"
	} else if status.ActiveScans == 0 && status.QueueDepth > 10 {
		// Large queue with no active scans might indicate a problem
		schedulerStatus = "degraded"
	} else if metrics.ErrorCounts != nil {
		// Check error rate
		totalErrors := int64(0)
		for _, count := range metrics.ErrorCounts {
			totalErrors += count
		}
		if totalErrors > 0 && status.TotalCompleted > 0 {
			errorRate := float64(totalErrors) / float64(status.TotalCompleted+status.TotalFailed)
			if errorRate > 0.5 { // More than 50% error rate
				schedulerStatus = "degraded"
			}
		}
	}
	
	healthInfo := gin.H{
		"status":                 schedulerStatus,
		"running":               status.Running,
		"queue_depth":           status.QueueDepth,
		"active_scans":          status.ActiveScans,
		"worker_count":          status.WorkerCount,
		"worker_utilization":    metrics.WorkerUtilization,
		"total_completed":       status.TotalCompleted,
		"total_failed":          status.TotalFailed,
		"completed_by_status":   metrics.CompletedScans,
		"error_counts":          metrics.ErrorCounts,
	}
	
	// Add timing information if available
	if status.LastRunAt != nil {
		healthInfo["last_run_timestamp"] = status.LastRunAt.Unix()
		healthInfo["last_run_age_seconds"] = int64(time.Since(*status.LastRunAt).Seconds())
	}
	
	if status.NextRunAt != nil {
		healthInfo["next_run_timestamp"] = status.NextRunAt.Unix()
		healthInfo["next_run_in_seconds"] = int64(time.Until(*status.NextRunAt).Seconds())
	}
	
	// Add scan duration averages if available
	if len(metrics.ScanDurations) > 0 {
		healthInfo["scan_durations_avg"] = metrics.ScanDurations
	}
	
	return healthInfo
}

// GetSchedulerHealth returns detailed scan scheduler health status
// @Summary Check scan scheduler health
// @Description Get scan scheduler status and metrics
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Failure 503 {object} models.ErrorResponse
// @Router /health/scheduler [get]
func (h *Handler) GetSchedulerHealth(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusNotImplemented, gin.H{
			"status": "not_configured",
			"message": "Scan scheduler is not configured",
		})
		return
	}
	
	schedulerHealth := h.getSchedulerHealth()
	
	statusCode := http.StatusOK
	if status, ok := schedulerHealth["status"].(string); ok {
		switch status {
		case "stopped":
			statusCode = http.StatusServiceUnavailable
		case "degraded":
			statusCode = http.StatusPartialContent
		}
	}
	
	c.JSON(statusCode, schedulerHealth)
}
