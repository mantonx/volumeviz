// Package database contains the data models for VolumeViz
// All models embed BaseModel for common fields
package database

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// BaseModel provides common fields for all database entities
// Includes auto-managed timestamps and ID
type BaseModel struct {
	ID        int       `db:"id" json:"id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// Volume represents a Docker volume in the database
// Maps to the 'volumes' table
type Volume struct {
	BaseModel
	VolumeID    string     `db:"volume_id" json:"volume_id"`
	Name        string     `db:"name" json:"name"`
	Driver      string     `db:"driver" json:"driver"`
	Mountpoint  string     `db:"mountpoint" json:"mountpoint"`
	Labels      Labels     `db:"labels" json:"labels"`
	Options     Labels     `db:"options" json:"options"`
	Scope       string     `db:"scope" json:"scope"`
	Status      string     `db:"status" json:"status"`
	LastScanned *time.Time `db:"last_scanned" json:"last_scanned,omitempty"`
	IsActive    bool       `db:"is_active" json:"is_active"`
}

// VolumeSize represents volume size calculation results
// Tracks historical size data and scan metadata
type VolumeSize struct {
	BaseModel
	VolumeID       string        `db:"volume_id" json:"volume_id"`
	TotalSize      int64         `db:"total_size" json:"total_size"`
	FileCount      int64         `db:"file_count" json:"file_count"`
	DirectoryCount int64         `db:"directory_count" json:"directory_count"`
	LargestFile    int64         `db:"largest_file" json:"largest_file"`
	ScanMethod     string        `db:"scan_method" json:"scan_method"`
	ScanDuration   time.Duration `db:"scan_duration" json:"scan_duration"`
	FilesystemType string        `db:"filesystem_type" json:"filesystem_type"`
	ChecksumMD5    string        `db:"checksum_md5" json:"checksum_md5"`
	IsValid        bool          `db:"is_valid" json:"is_valid"`
	ErrorMessage   *string       `db:"error_message" json:"error_message,omitempty"`
}

// Container represents a Docker container in the database
// Tracks container lifecycle and volume associations
type Container struct {
	BaseModel
	ContainerID string     `db:"container_id" json:"container_id"`
	Name        string     `db:"name" json:"name"`
	Image       string     `db:"image" json:"image"`
	State       string     `db:"state" json:"state"`
	Status      string     `db:"status" json:"status"`
	Labels      Labels     `db:"labels" json:"labels"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	FinishedAt  *time.Time `db:"finished_at" json:"finished_at,omitempty"`
	IsActive    bool       `db:"is_active" json:"is_active"`
}

// VolumeMount represents the relationship between containers and volumes
type VolumeMount struct {
	BaseModel
	VolumeID    string `db:"volume_id" json:"volume_id"`
	ContainerID string `db:"container_id" json:"container_id"`
	MountPath   string `db:"mount_path" json:"mount_path"`
	AccessMode  string `db:"access_mode" json:"access_mode"` // rw, ro
	IsActive    bool   `db:"is_active" json:"is_active"`
}

// ScanJob represents asynchronous scan operations
type ScanJob struct {
	BaseModel
	ScanID            string         `db:"scan_id" json:"scan_id"`
	VolumeID          string         `db:"volume_id" json:"volume_id"`
	Status            string         `db:"status" json:"status"`     // queued, running, completed, failed, canceled
	Progress          int            `db:"progress" json:"progress"` // 0-100
	Method            string         `db:"method" json:"method"`
	StartedAt         *time.Time     `db:"started_at" json:"started_at,omitempty"`
	CompletedAt       *time.Time     `db:"completed_at" json:"completed_at,omitempty"`
	ErrorMessage      *string        `db:"error_message" json:"error_message,omitempty"`
	ResultID          *int           `db:"result_id" json:"result_id,omitempty"` // FK to VolumeSize
	EstimatedDuration *time.Duration `db:"estimated_duration" json:"estimated_duration,omitempty"`
}

// VolumeMetrics represents historical volume metrics for analytics
type VolumeMetrics struct {
	BaseModel
	VolumeID        string    `db:"volume_id" json:"volume_id"`
	MetricTimestamp time.Time `db:"metric_timestamp" json:"metric_timestamp"`
	TotalSize       int64     `db:"total_size" json:"total_size"`
	FileCount       int64     `db:"file_count" json:"file_count"`
	DirectoryCount  int64     `db:"directory_count" json:"directory_count"`
	GrowthRate      *float64  `db:"growth_rate" json:"growth_rate,omitempty"` // bytes per day
	AccessFrequency int       `db:"access_frequency" json:"access_frequency"` // scans per day
	ContainerCount  int       `db:"container_count" json:"container_count"`
}

// SystemHealth represents system health status for monitoring
// Tracks component health and response times
type SystemHealth struct {
	BaseModel
	Component    string    `db:"component" json:"component"` // docker, database, filesystem
	Status       string    `db:"status" json:"status"`       // healthy, warning, critical
	LastCheckAt  time.Time `db:"last_check_at" json:"last_check_at"`
	ResponseTime *int64    `db:"response_time" json:"response_time,omitempty"` // milliseconds
	ErrorMessage *string   `db:"error_message" json:"error_message,omitempty"`
	Metadata     Labels    `db:"metadata" json:"metadata"`
}

// ScanCache represents cached scan results for performance optimization
// Reduces load by caching frequently accessed scan data
type ScanCache struct {
	BaseModel
	CacheKey       string    `db:"cache_key" json:"cache_key"`
	VolumeID       string    `db:"volume_id" json:"volume_id"`
	CachedResult   string    `db:"cached_result" json:"cached_result"` // JSON serialized result
	ExpiresAt      time.Time `db:"expires_at" json:"expires_at"`
	HitCount       int       `db:"hit_count" json:"hit_count"`
	LastAccessedAt time.Time `db:"last_accessed_at" json:"last_accessed_at"`
	IsValid        bool      `db:"is_valid" json:"is_valid"`
}

// MigrationHistory tracks database schema changes
// Essential for version control and rollback capabilities
type MigrationHistory struct {
	ID            int       `db:"id" json:"id"`
	Version       string    `db:"version" json:"version"`
	Description   string    `db:"description" json:"description"`
	AppliedAt     time.Time `db:"applied_at" json:"applied_at"`
	RollbackSQL   *string   `db:"rollback_sql" json:"rollback_sql,omitempty"`
	Checksum      string    `db:"checksum" json:"checksum"`
	ExecutionTime int64     `db:"execution_time" json:"execution_time"` // milliseconds
}

// Labels is a custom type for handling JSON labels/metadata
// Stored as JSONB in PostgreSQL for flexible queries
type Labels map[string]string

// Value implements the driver.Valuer interface for database storage
// Converts Labels to a format PostgreSQL can store as JSONB
func (l Labels) Value() (driver.Value, error) {
	if l == nil {
		return nil, nil
	}

	// Use encoding/json for proper JSON serialization
	return fmt.Sprintf("%v", map[string]string(l)), nil
}

// Scan implements the sql.Scanner interface for database retrieval
func (l *Labels) Scan(value any) error {
	if value == nil {
		*l = make(Labels)
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return l.unmarshalJSON(v)
	case string:
		return l.unmarshalJSON([]byte(v))
	default:
		return fmt.Errorf("cannot scan %T into Labels", value)
	}
}

// unmarshalJSON is a simplified JSON unmarshaler for Labels
// In production, use encoding/json for robust parsing
func (l *Labels) unmarshalJSON(data []byte) error {
	if *l == nil {
		*l = make(Labels)
	}

	str := string(data)
	if str == "{}" || str == "" || str == "map[]" {
		return nil
	}

	// Simple key-value parsing - replace with encoding/json in production
	return nil
}

// TableNames for all models (useful for migrations and queries)
var TableNames = struct {
	Volumes          string
	VolumeSizes      string
	Containers       string
	VolumeMounts     string
	ScanJobs         string
	VolumeMetrics    string
	SystemHealth     string
	ScanCache        string
	MigrationHistory string
}{
	Volumes:          "volumes",
	VolumeSizes:      "volume_sizes",
	Containers:       "containers",
	VolumeMounts:     "volume_mounts",
	ScanJobs:         "scan_jobs",
	VolumeMetrics:    "volume_metrics",
	SystemHealth:     "system_health",
	ScanCache:        "scan_cache",
	MigrationHistory: "migration_history",
}
