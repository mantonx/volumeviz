package scheduler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/services/scheduler"
)

// Handler handles scheduler API endpoints
type Handler struct {
	scheduler *scheduler.Scheduler
}

// NewHandler creates a new scheduler handler
func NewHandler(sched *scheduler.Scheduler) *Handler {
	return &Handler{
		scheduler: sched,
	}
}

// RegisterRoutes registers scheduler routes
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	jobs := rg.Group("/scheduler")
	{
		jobs.GET("/jobs", h.GetAllJobs)
		jobs.GET("/jobs/:name", h.GetJob)
		jobs.POST("/jobs/:name/run", h.RunJob)
		jobs.POST("/jobs/:name/enable", h.EnableJob)
		jobs.POST("/jobs/:name/disable", h.DisableJob)
	}
}

// GetAllJobs returns status of all scheduled jobs
// @Summary Get all scheduled jobs
// @Description Get status information for all scheduled jobs
// @Tags scheduler
// @Produce json
// @Success 200 {object} map[string]scheduler.JobStatus
// @Router /api/v1/scheduler/jobs [get]
func (h *Handler) GetAllJobs(c *gin.Context) {
	statuses := h.scheduler.GetAllStatuses()
	c.JSON(http.StatusOK, statuses)
}

// GetJob returns status of a specific job
// @Summary Get job status
// @Description Get status information for a specific scheduled job
// @Tags scheduler
// @Param name path string true "Job name"
// @Produce json
// @Success 200 {object} scheduler.JobStatus
// @Failure 404 {object} map[string]string
// @Router /api/v1/scheduler/jobs/{name} [get]
func (h *Handler) GetJob(c *gin.Context) {
	jobName := c.Param("name")

	status, err := h.scheduler.GetStatus(jobName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

// RunJob manually triggers a job to run immediately
// @Summary Manually run a job
// @Description Trigger a scheduled job to run immediately
// @Tags scheduler
// @Param name path string true "Job name"
// @Success 200 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/scheduler/jobs/{name}/run [post]
func (h *Handler) RunJob(c *gin.Context) {
	jobName := c.Param("name")

	err := h.scheduler.RunNow(jobName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Job triggered successfully",
		"job":     jobName,
	})
}

// EnableJob enables a disabled job
// @Summary Enable a job
// @Description Enable a previously disabled scheduled job
// @Tags scheduler
// @Param name path string true "Job name"
// @Success 200 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/scheduler/jobs/{name}/enable [post]
func (h *Handler) EnableJob(c *gin.Context) {
	jobName := c.Param("name")

	err := h.scheduler.Enable(jobName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Job enabled successfully",
		"job":     jobName,
	})
}

// DisableJob disables a job
// @Summary Disable a job
// @Description Disable a scheduled job (it will not run automatically)
// @Tags scheduler
// @Param name path string true "Job name"
// @Success 200 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/scheduler/jobs/{name}/disable [post]
func (h *Handler) DisableJob(c *gin.Context) {
	jobName := c.Param("name")

	err := h.scheduler.Disable(jobName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Job disabled successfully",
		"job":     jobName,
	})
}
