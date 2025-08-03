package database

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/database"
)

// Handler handles database-related HTTP requests
type Handler struct {
	db           *database.DB
	migrationMgr *database.MigrationManager
	volumeRepo   *database.VolumeRepository
	scanJobRepo  *database.ScanJobRepository
}

// NewHandler creates a new database handler
func NewHandler(db *database.DB) *Handler {
	return &Handler{
		db:           db,
		migrationMgr: database.NewMigrationManager(db.DB),
		volumeRepo:   database.NewVolumeRepository(db),
		scanJobRepo:  database.NewScanJobRepository(db),
	}
}

// GetDatabaseHealth returns database connection health status
// @Summary Get database health
// @Description Get comprehensive database health information including connection status, performance metrics, and resource usage
// @Tags database
// @Accept json
// @Produce json
// @Success 200 {object} database.HealthStatus "Database is healthy"
// @Success 503 {object} database.HealthStatus "Database is unhealthy"
// @Router /database/health [get]
func (h *Handler) GetDatabaseHealth(c *gin.Context) {
	health := h.db.Health()

	// Set appropriate HTTP status based on health
	statusCode := http.StatusOK
	switch health.Status {
	case "unhealthy":
		statusCode = http.StatusServiceUnavailable
	case "degraded":
		statusCode = http.StatusOK // Still functional, but warn
	}

	c.JSON(statusCode, health)
}

// GetMigrationStatus returns current migration status
// @Summary Get migration status
// @Description Get detailed information about database migrations including applied, pending, and completion status
// @Tags database
// @Accept json
// @Produce json
// @Success 200 {object} database.MigrationStatus "Migration status retrieved successfully"
// @Failure 500 {object} ErrorResponse "Failed to get migration status"
// @Router /database/migrations/status [get]
func (h *Handler) GetMigrationStatus(c *gin.Context) {
	status, err := h.migrationMgr.GetMigrationStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get migration status",
			"code":    "MIGRATION_STATUS_ERROR",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetMigrationHistory returns migration history
// @Summary Get migration history
// @Description Get complete history of applied database migrations with execution details
// @Tags database
// @Accept json
// @Produce json
// @Success 200 {array} database.MigrationHistory "Migration history retrieved successfully"
// @Failure 500 {object} ErrorResponse "Failed to get migration history"
// @Router /database/migrations/history [get]
func (h *Handler) GetMigrationHistory(c *gin.Context) {
	history, err := h.migrationMgr.GetAppliedMigrations()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get migration history",
			"code":    "MIGRATION_HISTORY_ERROR",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, history)
}

// ApplyPendingMigrations applies all pending database migrations
// @Summary Apply pending migrations
// @Description Apply all pending database migrations. Use with caution in production environments.
// @Tags database
// @Accept json
// @Produce json
// @Success 200 {object} database.MigrationStatus "Migrations applied successfully"
// @Failure 400 {object} ErrorResponse "No pending migrations or validation error"
// @Failure 500 {object} ErrorResponse "Failed to apply migrations"
// @Router /database/migrations/apply [post]
func (h *Handler) ApplyPendingMigrations(c *gin.Context) {
	// Check if there are pending migrations first
	status, err := h.migrationMgr.GetMigrationStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to check migration status",
			"code":    "MIGRATION_STATUS_ERROR",
			"details": err.Error(),
		})
		return
	}

	if status.PendingCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "No pending migrations to apply",
			"code":    "NO_PENDING_MIGRATIONS",
			"details": "Database is already up to date",
		})
		return
	}

	// Apply pending migrations
	err = h.migrationMgr.ApplyAllPending()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to apply migrations",
			"code":    "MIGRATION_APPLY_ERROR",
			"details": err.Error(),
		})
		return
	}

	// Get updated status
	updatedStatus, err := h.migrationMgr.GetMigrationStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Migrations applied but failed to get updated status",
			"code":    "MIGRATION_STATUS_ERROR",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, updatedStatus)
}

// RollbackMigration rolls back a specific migration
// @Summary Rollback migration
// @Description Rollback a specific database migration by version. Use with extreme caution in production.
// @Tags database
// @Accept json
// @Produce json
// @Param version path string true "Migration version to rollback" example("002")
// @Success 200 {object} database.MigrationStatus "Migration rolled back successfully"
// @Failure 400 {object} ErrorResponse "Invalid version or validation error"
// @Failure 404 {object} ErrorResponse "Migration not found"
// @Failure 500 {object} ErrorResponse "Failed to rollback migration"
// @Router /database/migrations/{version}/rollback [post]
func (h *Handler) RollbackMigration(c *gin.Context) {
	version := c.Param("version")
	if version == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Migration version is required",
			"code":    "INVALID_VERSION",
			"details": "Version parameter cannot be empty",
		})
		return
	}

	// Attempt rollback
	err := h.migrationMgr.RollbackMigration(version)
	if err != nil {
		if err.Error() == "migration "+version+" not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Migration not found",
				"code":    "MIGRATION_NOT_FOUND",
				"details": "Migration version " + version + " has not been applied",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to rollback migration",
			"code":    "MIGRATION_ROLLBACK_ERROR",
			"details": err.Error(),
		})
		return
	}

	// Get updated status
	status, err := h.migrationMgr.GetMigrationStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Migration rolled back but failed to get updated status",
			"code":    "MIGRATION_STATUS_ERROR",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetDatabaseStats returns comprehensive database statistics
// @Summary Get database statistics
// @Description Get comprehensive database statistics including volume counts, scan job metrics, and performance data
// @Tags database
// @Accept json
// @Produce json
// @Success 200 {object} DatabaseStats "Database statistics retrieved successfully"
// @Failure 500 {object} ErrorResponse "Failed to get database statistics"
// @Router /database/stats [get]
func (h *Handler) GetDatabaseStats(c *gin.Context) {
	stats := &DatabaseStats{}

	// Get volume statistics
	volumeStats, err := h.volumeRepo.GetVolumeStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get volume statistics",
			"code":    "VOLUME_STATS_ERROR",
			"details": err.Error(),
		})
		return
	}
	stats.VolumeStats = volumeStats

	// Get scan job statistics
	scanJobStats, err := h.scanJobRepo.GetJobStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get scan job statistics",
			"code":    "SCAN_JOB_STATS_ERROR",
			"details": err.Error(),
		})
		return
	}
	stats.ScanJobStats = scanJobStats

	// Get database health
	health := h.db.Health()
	stats.DatabaseHealth = health

	// Get migration status
	migrationStatus, err := h.migrationMgr.GetMigrationStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get migration status",
			"code":    "MIGRATION_STATUS_ERROR",
			"details": err.Error(),
		})
		return
	}
	stats.MigrationStatus = migrationStatus

	c.JSON(http.StatusOK, stats)
}

// TestDatabaseConnection tests database connectivity
// @Summary Test database connection
// @Description Test database connectivity and return detailed connection information
// @Tags database
// @Accept json
// @Produce json
// @Success 200 {object} ConnectionTestResult "Connection test successful"
// @Failure 503 {object} ConnectionTestResult "Connection test failed"
// @Router /database/test-connection [get]
func (h *Handler) TestDatabaseConnection(c *gin.Context) {
	result := &ConnectionTestResult{}

	// Test basic ping
	err := h.db.Ping()
	if err != nil {
		result.Success = false
		result.Error = err.Error()
		result.Message = "Database connection failed"
		c.JSON(http.StatusServiceUnavailable, result)
		return
	}

	// Test query execution
	var testResult int
	err = h.db.QueryRow("SELECT 1").Scan(&testResult)
	if err != nil {
		result.Success = false
		result.Error = err.Error()
		result.Message = "Database query test failed"
		c.JSON(http.StatusServiceUnavailable, result)
		return
	}

	// Get connection stats
	stats := h.db.Stats()
	result.Success = true
	result.Message = "Database connection is healthy"
	result.OpenConnections = stats.OpenConnections
	result.IdleConnections = stats.Idle
	result.MaxOpenConnections = stats.MaxOpenConnections

	c.JSON(http.StatusOK, result)
}

// GetTableSizes returns the sizes of all database tables
// @Summary Get table sizes
// @Description Get storage usage information for all database tables
// @Tags database
// @Accept json
// @Produce json
// @Success 200 {array} TableSizeInfo "Table sizes retrieved successfully"
// @Failure 500 {object} ErrorResponse "Failed to get table sizes"
// @Router /database/table-sizes [get]
func (h *Handler) GetTableSizes(c *gin.Context) {
	query := `
		SELECT
			schemaname,
			tablename,
			attname,
			n_distinct,
			correlation,
			most_common_vals,
			most_common_freqs,
			histogram_bounds
		FROM pg_stats
		WHERE schemaname = 'public'
		ORDER BY tablename, attname
	`

	rows, err := h.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get table sizes",
			"code":    "TABLE_SIZE_ERROR",
			"details": err.Error(),
		})
		return
	}
	defer rows.Close()

	var tableSizes []TableSizeInfo
	for rows.Next() {
		var info TableSizeInfo
		var mostCommonVals, mostCommonFreqs, histogramBounds interface{}

		err := rows.Scan(
			&info.SchemaName,
			&info.TableName,
			&info.ColumnName,
			&info.DistinctValues,
			&info.Correlation,
			&mostCommonVals,
			&mostCommonFreqs,
			&histogramBounds,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to scan table size data",
				"code":    "TABLE_SIZE_SCAN_ERROR",
				"details": err.Error(),
			})
			return
		}

		tableSizes = append(tableSizes, info)
	}

	c.JSON(http.StatusOK, tableSizes)
}

// GetSlowQueries returns information about slow queries
// @Summary Get slow queries
// @Description Get information about slow-running database queries for performance analysis
// @Tags database
// @Accept json
// @Produce json
// @Param limit query int false "Maximum number of queries to return" default(10)
// @Success 200 {array} SlowQueryInfo "Slow queries retrieved successfully"
// @Failure 500 {object} ErrorResponse "Failed to get slow queries"
// @Router /database/slow-queries [get]
func (h *Handler) GetSlowQueries(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 10
	}

	// Note: This requires pg_stat_statements extension to be enabled
	query := `
		SELECT
			query,
			calls,
			total_time,
			mean_time,
			min_time,
			max_time,
			stddev_time,
			rows,
			100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
		FROM pg_stat_statements
		ORDER BY total_time DESC
		LIMIT $1
	`

	rows, err := h.db.Query(query, limit)
	if err != nil {
		// If pg_stat_statements is not available, return empty array
		c.JSON(http.StatusOK, []SlowQueryInfo{})
		return
	}
	defer rows.Close()

	var slowQueries []SlowQueryInfo
	for rows.Next() {
		var info SlowQueryInfo
		var hitPercent interface{}

		err := rows.Scan(
			&info.Query,
			&info.Calls,
			&info.TotalTime,
			&info.MeanTime,
			&info.MinTime,
			&info.MaxTime,
			&info.StddevTime,
			&info.Rows,
			&hitPercent,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to scan slow query data",
				"code":    "SLOW_QUERY_SCAN_ERROR",
				"details": err.Error(),
			})
			return
		}

		if hitPercent != nil {
			if hp, ok := hitPercent.(float64); ok {
				info.HitPercent = &hp
			}
		}

		slowQueries = append(slowQueries, info)
	}

	c.JSON(http.StatusOK, slowQueries)
}

// Response types for API documentation

// DatabaseStats represents comprehensive database statistics
type DatabaseStats struct {
	VolumeStats     *database.VolumeStats     `json:"volume_stats"`
	ScanJobStats    *database.ScanJobStats    `json:"scan_job_stats"`
	DatabaseHealth  *database.HealthStatus    `json:"database_health"`
	MigrationStatus *database.MigrationStatus `json:"migration_status"`
}

// ConnectionTestResult represents database connection test results
type ConnectionTestResult struct {
	Success            bool   `json:"success"`
	Message            string `json:"message"`
	Error              string `json:"error,omitempty"`
	OpenConnections    int    `json:"open_connections,omitempty"`
	IdleConnections    int    `json:"idle_connections,omitempty"`
	MaxOpenConnections int    `json:"max_open_connections,omitempty"`
}

// TableSizeInfo represents database table size information
type TableSizeInfo struct {
	SchemaName     string   `json:"schema_name"`
	TableName      string   `json:"table_name"`
	ColumnName     string   `json:"column_name"`
	DistinctValues *int64   `json:"distinct_values"`
	Correlation    *float64 `json:"correlation"`
}

// SlowQueryInfo represents slow query information
type SlowQueryInfo struct {
	Query      string   `json:"query"`
	Calls      int64    `json:"calls"`
	TotalTime  float64  `json:"total_time"`
	MeanTime   float64  `json:"mean_time"`
	MinTime    float64  `json:"min_time"`
	MaxTime    float64  `json:"max_time"`
	StddevTime float64  `json:"stddev_time"`
	Rows       int64    `json:"rows"`
	HitPercent *float64 `json:"hit_percent,omitempty"`
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code"`
	Details string `json:"details,omitempty"`
}
