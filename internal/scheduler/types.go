package scheduler

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
)

// ScanScheduler defines the interface for the scan scheduling system
type ScanScheduler interface {
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	IsRunning() bool
	GetStatus() *SchedulerStatus
	GetMetrics() *SchedulerMetrics
	EnqueueVolume(volumeName string) (string, error)
	EnqueueAllVolumes() (string, error)
	GetScanStatus(scanID string) (*ScanStatus, error)

	// Enhanced features for hardened mode
	GetDetailedMetrics() *EnhancedSchedulerMetrics
	IsHardenedMode() bool
	GetWorkerStats() []WorkerStats
	GetWatchdogStats() *WatchdogStats
}

// ScanRepository defines database operations for scan persistence
type ScanRepository interface {
	// Volume stats operations
	InsertVolumeStats(ctx context.Context, stats *models.DirRollup) error
	InsertScanResult(ctx context.Context, scanResult *interfaces.ScanResult) error
	GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*models.DirRollup, error)
	GetLatestVolumeStats(ctx context.Context, volumeName string) (*models.DirRollup, error)

	// Scan runs operations
	InsertScanRun(ctx context.Context, run *models.ScanJob) error
	UpdateScanRun(ctx context.Context, run *models.ScanJob) error
	GetScanRunByID(ctx context.Context, scanID string) (*models.ScanJob, error)
	GetActiveScanRuns(ctx context.Context) ([]*models.ScanJob, error)

	// Volume operations
	ListVolumes(ctx context.Context) ([]*models.Volume, error)
	UpsertVolume(ctx context.Context, volume *models.Volume) error
}

// VolumeProvider defines interface for getting volume information
type VolumeProvider interface {
	ListVolumes(ctx context.Context) ([]*models.Volume, error)
	GetVolume(ctx context.Context, volumeName string) (*models.Volume, error)
}

// ScanTask represents a scan task in the queue
type ScanTask struct {
	ScanID     string
	VolumeName string
	Method     string
	Priority   int
	CreatedAt  time.Time
	Timeout    time.Duration
	Retries    int
	MaxRetries int
}

// ScanResult represents the result of a completed scan
type ScanResult struct {
	ScanID      string
	VolumeName  string
	Success     bool
	SizeBytes   int64
	FileCount   *int
	Method      string
	Duration    time.Duration
	Error       string
	CompletedAt time.Time
}

// SchedulerStatus represents the current status of the scheduler
type SchedulerStatus struct {
	Running        bool       `json:"running"`
	LastRunAt      *time.Time `json:"last_run_at,omitempty"`
	NextRunAt      *time.Time `json:"next_run_at,omitempty"`
	ActiveScans    int        `json:"active_scans"`
	QueueDepth     int        `json:"queue_depth"`
	WorkerCount    int        `json:"worker_count"`
	TotalCompleted int64      `json:"total_completed"`
	TotalFailed    int64      `json:"total_failed"`
}

// SchedulerMetrics represents metrics for Prometheus
type SchedulerMetrics struct {
	QueueDepth        int                `json:"queue_depth"`
	ActiveScans       int                `json:"active_scans"`
	CompletedScans    map[string]int64   `json:"completed_scans"`    // by status
	ScanDurations     map[string]float64 `json:"scan_durations"`     // by method (avg seconds)
	ErrorCounts       map[string]int64   `json:"error_counts"`       // by reason
	WorkerUtilization float64            `json:"worker_utilization"` // percentage
}

// ScanStatus represents the status of a specific scan
type ScanStatus struct {
	ScanID      string         `json:"scan_id"`
	VolumeName  string         `json:"volume_name"`
	Status      string         `json:"status"` // queued, running, completed, failed, timeout
	Method      string         `json:"method"`
	Progress    int            `json:"progress"`
	StartedAt   *time.Time     `json:"started_at,omitempty"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`
	Duration    *time.Duration `json:"duration,omitempty"`
	SizeBytes   *int64         `json:"size_bytes,omitempty"`
	FileCount   *int           `json:"file_count,omitempty"`
	Error       string         `json:"error,omitempty"`
}

// SchedulerConfig wraps the config.ScanConfig with additional runtime settings
type SchedulerConfig struct {
	*config.ScanConfig
	QueueSize int // Internal queue size (defaults to 10x concurrency)
}

// NewSchedulerConfig creates a scheduler config from scan config
func NewSchedulerConfig(scanConfig *config.ScanConfig) *SchedulerConfig {
	queueSize := scanConfig.Concurrency * 10
	if queueSize < 100 {
		queueSize = 100
	}

	return &SchedulerConfig{
		ScanConfig: scanConfig,
		QueueSize:  queueSize,
	}
}

// WorkerStats represents statistics for a worker
type WorkerStats struct {
	ID                  int           `json:"id"`
	ProcessedCount      int64         `json:"processed_count"`
	ErrorCount          int64         `json:"error_count"`
	IsActive            bool          `json:"is_active"`
	CurrentScanID       string        `json:"current_scan_id,omitempty"`
	CurrentVolumeID     string        `json:"current_volume_id,omitempty"`
	CurrentScanDuration time.Duration `json:"current_scan_duration,omitempty"`
}

// HardenedScanConfig provides configuration for hardened scan orchestration
type HardenedScanConfig struct {
	// Heartbeat and watchdog configuration
	HeartbeatInterval time.Duration `yaml:"heartbeat_interval" env:"VV_SCAN_HEARTBEAT_INTERVAL" envDefault:"7s"`
	WatchdogInterval  time.Duration `yaml:"watchdog_interval" env:"VV_SCAN_WATCHDOG_INTERVAL" envDefault:"30s"`
	ScanTimeout       time.Duration `yaml:"scan_timeout" env:"VV_SCAN_TIMEOUT" envDefault:"300s"`

	// Graceful restart behavior
	GracefulShutdownTimeout time.Duration `yaml:"graceful_shutdown_timeout" env:"VV_SCAN_GRACEFUL_SHUTDOWN_TIMEOUT" envDefault:"60s"`
	MarkInFlightAsFailed    bool          `yaml:"mark_inflight_as_failed" env:"VV_SCAN_MARK_INFLIGHT_AS_FAILED" envDefault:"true"`

	// Metrics and observability
	MetricsEnabled  bool          `yaml:"metrics_enabled" env:"VV_SCAN_METRICS_ENABLED" envDefault:"true"`
	MetricsInterval time.Duration `yaml:"metrics_interval" env:"VV_SCAN_METRICS_INTERVAL" envDefault:"10s"`
}

// WatchdogStats holds statistics for the watchdog
type WatchdogStats struct {
	CheckedCount int64     `json:"checked_count"`
	MarkedCount  int64     `json:"marked_count"`
	ErrorCount   int64     `json:"error_count"`
	LastCheck    time.Time `json:"last_check"`
}

// EnhancedSchedulerMetrics represents enhanced metrics for hardened scheduler mode
type EnhancedSchedulerMetrics struct {
	QueueDepth        int            `json:"queue_depth"`
	ActiveScans       int            `json:"active_scans"`
	WorkerUtilization float64        `json:"worker_utilization"`
	WorkerStats       []WorkerStats  `json:"worker_stats"`
	WatchdogStats     *WatchdogStats `json:"watchdog_stats,omitempty"`
	IsHardened        bool           `json:"is_hardened"`
	HeartbeatInterval time.Duration  `json:"heartbeat_interval"`
	WatchdogEnabled   bool           `json:"watchdog_enabled"`
}
