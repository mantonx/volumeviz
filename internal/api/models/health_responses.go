package models

import "github.com/mantonx/volumeviz/internal/version"

// DatabaseHealth represents database connectivity health status
type DatabaseHealth struct {
	Status string `json:"status" example:"healthy" enums:"healthy,unhealthy,unknown"`
	Type   string `json:"type,omitempty" example:"store-managed"`
	Error  string `json:"error,omitempty"`
} // @name DatabaseHealth

// EventsHealth represents the Docker events subscription's health status
type EventsHealth struct {
	Status                 string           `json:"status" example:"healthy" enums:"healthy,degraded,unhealthy,not_configured"`
	Connected              bool             `json:"connected"`
	QueueSize              int              `json:"queue_size"`
	ProcessedTotal         int              `json:"processed_total"`
	ErrorsTotal            int              `json:"errors_total"`
	DroppedTotal           int64            `json:"dropped_total"`
	ReconnectsTotal        int64            `json:"reconnects_total"`
	LastEventTimestamp     *int64           `json:"last_event_timestamp,omitempty"`
	LastEventAgeSeconds    *int64           `json:"last_event_age_seconds,omitempty"`
	LastReconnectTimestamp *int64           `json:"last_reconnect_timestamp,omitempty"`
	ReconciliationRuns     map[string]int64 `json:"reconciliation_runs,omitempty"`
	Message                string           `json:"message,omitempty"`
} // @name EventsHealth

// AppHealthChecks groups every dependency's health status for GetAppHealth
type AppHealthChecks struct {
	Docker     DockerHealth      `json:"docker"`
	Database   DatabaseHealth    `json:"database,omitempty"`
	Events     *EventsHealth     `json:"events,omitempty"`
	Scheduler  *SchedulerHealth  `json:"scheduler,omitempty"`
	Migrations *MigrationsHealth `json:"migrations,omitempty"`
} // @name AppHealthChecks

// MigrationsHealth represents database migration status
type MigrationsHealth struct {
	Status string `json:"status" example:"store-managed"`
} // @name MigrationsHealth

// AppHealth is the response body for GET /api/v1/health, aggregating every
// dependency's health status into one overall status
type AppHealth struct {
	Status    string          `json:"status" example:"healthy" enums:"healthy,degraded"`
	Timestamp int64           `json:"timestamp"`
	Version   version.Info    `json:"version"`
	Checks    AppHealthChecks `json:"checks"`
} // @name AppHealth

// SchedulerHealth represents the background scan scheduler's health status
type SchedulerHealth struct {
	Status            string             `json:"status" example:"healthy" enums:"healthy,degraded,stopped,not_configured"`
	Running           bool               `json:"running"`
	QueueDepth        int                `json:"queue_depth"`
	ActiveScans       int                `json:"active_scans"`
	WorkerCount       int                `json:"worker_count"`
	WorkerUtilization float64            `json:"worker_utilization"`
	TotalCompleted    int64              `json:"total_completed"`
	TotalFailed       int64              `json:"total_failed"`
	CompletedByStatus map[string]int64   `json:"completed_by_status,omitempty"`
	ErrorCounts       map[string]int64   `json:"error_counts,omitempty"`
	ScanDurationsAvg  map[string]float64 `json:"scan_durations_avg,omitempty"`
	LastRunTimestamp  *int64             `json:"last_run_timestamp,omitempty"`
	LastRunAgeSeconds *int64             `json:"last_run_age_seconds,omitempty"`
	NextRunTimestamp  *int64             `json:"next_run_timestamp,omitempty"`
	NextRunInSeconds  *int64             `json:"next_run_in_seconds,omitempty"`
	Message           string             `json:"message,omitempty"`
} // @name SchedulerHealth
