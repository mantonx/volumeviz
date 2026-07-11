package health

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/models"
	"github.com/mantonx/volumeviz/internal/events"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/scheduler"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/version"
)

// Handler handles health-related HTTP requests
type Handler struct {
	dockerService interfaces.DockerService
	store         store.Store // Modern store interface using sqlc
	eventsService events.EventService
	scheduler     scheduler.ScanScheduler // Optional scan scheduler
}

// NewHandler creates a new health handler
func NewHandler(dockerService interfaces.DockerService, store store.Store, eventsService events.EventService, scanScheduler scheduler.ScanScheduler) *Handler {
	return &Handler{
		dockerService: dockerService,
		store:         store,
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
// @Router /api/v1/health/docker [get]
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
// @Summary Check overall application health
// @Description Aggregates Docker, database, events, and scheduler health into one overall status
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} models.AppHealth
// @Success 206 {object} models.AppHealth
// @Router /api/v1/health [get]
func (h *Handler) GetAppHealth(c *gin.Context) {
	ctx := c.Request.Context()

	dockerAvailable := h.dockerService.IsDockerAvailable(ctx)
	dockerStatus := "unhealthy"
	if dockerAvailable {
		dockerStatus = "healthy"
	}

	checks := models.AppHealthChecks{
		Docker: models.DockerHealth{Status: dockerStatus},
	}

	if h.eventsService != nil {
		eventsHealth := h.getEventsHealth()
		checks.Events = &eventsHealth
	}

	if h.scheduler != nil {
		schedulerHealth := h.getSchedulerHealth()
		checks.Scheduler = &schedulerHealth
	}

	if h.store != nil {
		dbHealth := models.DatabaseHealth{Status: "unknown"}
		if err := h.store.Health(c.Request.Context()); err != nil {
			dbHealth.Status = "unhealthy"
			dbHealth.Error = err.Error()
		} else {
			dbHealth.Status = "healthy"
		}
		checks.Database = dbHealth
		checks.Migrations = &models.MigrationsHealth{Status: "store-managed"}
	}

	overallStatus := "healthy"
	if !dockerAvailable {
		overallStatus = "degraded"
	} else if h.store != nil && checks.Database.Status != "healthy" {
		overallStatus = "degraded"
	} else if checks.Events != nil && checks.Events.Status == "unhealthy" {
		overallStatus = "degraded"
	}

	health := models.AppHealth{
		Status:    overallStatus,
		Timestamp: time.Now().Unix(),
		Version:   version.Get(),
		Checks:    checks,
	}

	statusCode := http.StatusOK
	if overallStatus == "degraded" {
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
func (h *Handler) getEventsHealth() models.EventsHealth {
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

	healthInfo := models.EventsHealth{
		Status:          status,
		Connected:       connected,
		QueueSize:       metrics.QueueSize,
		ProcessedTotal:  len(metrics.ProcessedTotal),
		ErrorsTotal:     len(metrics.ErrorsTotal),
		DroppedTotal:    metrics.DroppedTotal,
		ReconnectsTotal: metrics.ReconnectsTotal,
	}

	if lastEventTime != nil {
		ts := lastEventTime.Unix()
		age := int64(time.Since(*lastEventTime).Seconds())
		healthInfo.LastEventTimestamp = &ts
		healthInfo.LastEventAgeSeconds = &age
	}

	if metrics.LastReconnectTime != nil {
		ts := metrics.LastReconnectTime.Unix()
		healthInfo.LastReconnectTimestamp = &ts
	}

	if len(metrics.ReconcileRuns) > 0 {
		healthInfo.ReconciliationRuns = metrics.ReconcileRuns
	}

	return healthInfo
}

// GetEventsHealth returns detailed Docker events health status
// @Summary Check Docker events health
// @Description Get Docker events service status and metrics
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} models.EventsHealth
// @Failure 503 {object} models.EventsHealth
// @Router /api/v1/health/events [get]
func (h *Handler) GetEventsHealth(c *gin.Context) {
	if h.eventsService == nil {
		c.JSON(http.StatusNotImplemented, models.EventsHealth{
			Status:  "not_configured",
			Message: "Docker events service is not configured",
		})
		return
	}

	eventsHealth := h.getEventsHealth()

	statusCode := http.StatusOK
	switch eventsHealth.Status {
	case "unhealthy":
		statusCode = http.StatusServiceUnavailable
	case "degraded":
		statusCode = http.StatusPartialContent
	}

	c.JSON(statusCode, eventsHealth)
}

// getSchedulerHealth returns scheduler health information
func (h *Handler) getSchedulerHealth() models.SchedulerHealth {
	if h.scheduler == nil {
		return models.SchedulerHealth{
			Status:  "not_configured",
			Message: "Scan scheduler is not configured",
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

	healthInfo := models.SchedulerHealth{
		Status:            schedulerStatus,
		Running:           status.Running,
		QueueDepth:        status.QueueDepth,
		ActiveScans:       status.ActiveScans,
		WorkerCount:       status.WorkerCount,
		WorkerUtilization: metrics.WorkerUtilization,
		TotalCompleted:    status.TotalCompleted,
		TotalFailed:       status.TotalFailed,
		CompletedByStatus: metrics.CompletedScans,
		ErrorCounts:       metrics.ErrorCounts,
	}

	if status.LastRunAt != nil {
		ts := status.LastRunAt.Unix()
		age := int64(time.Since(*status.LastRunAt).Seconds())
		healthInfo.LastRunTimestamp = &ts
		healthInfo.LastRunAgeSeconds = &age
	}

	if status.NextRunAt != nil {
		ts := status.NextRunAt.Unix()
		in := int64(time.Until(*status.NextRunAt).Seconds())
		healthInfo.NextRunTimestamp = &ts
		healthInfo.NextRunInSeconds = &in
	}

	if len(metrics.ScanDurations) > 0 {
		healthInfo.ScanDurationsAvg = metrics.ScanDurations
	}

	return healthInfo
}

// GetSchedulerHealth returns detailed scan scheduler health status
// @Summary Check scan scheduler health
// @Description Get scan scheduler status and metrics
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} models.SchedulerHealth
// @Failure 503 {object} models.SchedulerHealth
// @Router /api/v1/health/scheduler [get]
func (h *Handler) GetSchedulerHealth(c *gin.Context) {
	if h.scheduler == nil {
		c.JSON(http.StatusNotImplemented, models.SchedulerHealth{
			Status:  "not_configured",
			Message: "Scan scheduler is not configured",
		})
		return
	}

	schedulerHealth := h.getSchedulerHealth()

	statusCode := http.StatusOK
	switch schedulerHealth.Status {
	case "stopped":
		statusCode = http.StatusServiceUnavailable
	case "degraded":
		statusCode = http.StatusPartialContent
	}

	c.JSON(statusCode, schedulerHealth)
}

// GetDatabaseHealth returns detailed database health status
// @Summary Check database health
// @Description Get database connection status via store interface
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} models.DatabaseHealth
// @Failure 503 {object} models.DatabaseHealth
// @Router /api/v1/health/database [get]
func (h *Handler) GetDatabaseHealth(c *gin.Context) {
	if h.store == nil {
		c.JSON(http.StatusNotImplemented, models.DatabaseHealth{
			Status: "not_configured",
		})
		return
	}

	response := models.DatabaseHealth{Status: "unknown", Type: "store-managed"}

	if err := h.store.Health(c.Request.Context()); err != nil {
		response.Status = "unhealthy"
		response.Error = err.Error()
	} else {
		response.Status = "healthy"
	}

	statusCode := http.StatusOK
	if response.Status == "unhealthy" {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, response)
}
