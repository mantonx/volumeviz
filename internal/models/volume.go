// Package models contains domain models - these are the types that services work with
// These models are independent of database implementation details
package models

import (
	"time"
)

// Volume represents a Docker volume in the domain
type Volume struct {
	ID          int64             `json:"id"`
	VolumeID    string            `json:"volume_id"`
	Name        string            `json:"name"`
	Driver      string            `json:"driver"`
	Mountpoint  string            `json:"mountpoint"`
	Labels      map[string]string `json:"labels,omitempty"`
	Options     map[string]string `json:"options,omitempty"`
	Scope       string            `json:"scope"`
	Status      string            `json:"status"`
	UsageData   *VolumeUsage      `json:"usage_data,omitempty"`
	LastScanned *time.Time        `json:"last_scanned,omitempty"`
	IsActive    bool              `json:"is_active"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// Container represents a Docker container in the domain
type Container struct {
	ID          int64             `json:"id"`
	ContainerID string            `json:"container_id"`
	Name        string            `json:"name"`
	Image       string            `json:"image"`
	State       string            `json:"state"`
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels,omitempty"`
	StartedAt   *time.Time        `json:"started_at,omitempty"`
	FinishedAt  *time.Time        `json:"finished_at,omitempty"`
	IsActive    bool              `json:"is_active"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// VolumeMount represents a volume mount between container and volume
type VolumeMount struct {
	ID          int64     `json:"id"`
	VolumeID    string    `json:"volume_id"`
	ContainerID string    `json:"container_id"`
	MountPath   string    `json:"mount_path"`
	AccessMode  string    `json:"access_mode"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// VolumeStats represents volume statistics
type VolumeStats struct {
	TotalVolumes   int64      `json:"total_volumes"`
	ActiveVolumes  int64      `json:"active_volumes"`
	UniqueDrivers  int64      `json:"unique_drivers"`
	ScannedVolumes int64      `json:"scanned_volumes"`
	NewestVolume   *time.Time `json:"newest_volume,omitempty"`
	OldestVolume   *time.Time `json:"oldest_volume,omitempty"`
}

// CreateVolumeParams represents parameters for creating a volume
type CreateVolumeParams struct {
	VolumeID   string            `json:"volume_id"`
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Labels     map[string]string `json:"labels,omitempty"`
	Options    map[string]string `json:"options,omitempty"`
	Scope      string            `json:"scope"`
	Status     string            `json:"status"`
	IsActive   bool              `json:"is_active"`
}

// UpdateVolumeParams represents parameters for updating a volume
type UpdateVolumeParams struct {
	ID         int64             `json:"id"`
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Labels     map[string]string `json:"labels,omitempty"`
	Options    map[string]string `json:"options,omitempty"`
	Scope      string            `json:"scope"`
	Status     string            `json:"status"`
	IsActive   bool              `json:"is_active"`
}

// CreateContainerParams represents parameters for creating a container
type CreateContainerParams struct {
	ContainerID string            `json:"container_id"`
	Name        string            `json:"name"`
	Image       string            `json:"image"`
	State       string            `json:"state"`
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels,omitempty"`
	StartedAt   *time.Time        `json:"started_at,omitempty"`
	FinishedAt  *time.Time        `json:"finished_at,omitempty"`
	IsActive    bool              `json:"is_active"`
}

// CreateVolumeMountParams represents parameters for creating a volume mount
type CreateVolumeMountParams struct {
	VolumeID    string `json:"volume_id"`
	ContainerID string `json:"container_id"`
	MountPath   string `json:"mount_path"`
	AccessMode  string `json:"access_mode"`
	IsActive    bool   `json:"is_active"`
}

// ==============================================================================
// SCAN-RELATED DOMAIN MODELS
// ==============================================================================

// ScanJob represents a volume scanning job
type ScanJob struct {
	ID                int64      `json:"id"`
	ScanID            string     `json:"scan_id"`
	VolumeID          string     `json:"volume_id"`
	TriggerType       string     `json:"trigger_type"`
	TriggerBy         string     `json:"trigger_by"`
	Status            string     `json:"status"`
	ScanProgress      float64    `json:"scan_progress"`
	FilesScanned      int64      `json:"files_scanned"`
	SizeScanned       int64      `json:"size_scanned"`
	Progress          *int32     `json:"progress,omitempty"`
	Method            string     `json:"method"`
	StartedAt         *time.Time `json:"started_at,omitempty"`
	CompletedAt       *time.Time `json:"completed_at,omitempty"`
	ErrorMessage      *string    `json:"error_message,omitempty"`
	ResultID          *int64     `json:"result_id,omitempty"`
	EstimatedDuration *int64     `json:"estimated_duration,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// FileEntry represents a file entry in a volume scan
type FileEntry struct {
	ID          int64      `json:"id"`
	VolumeID    string     `json:"volume_id"`
	ParentDirID *int64     `json:"parent_dir_id,omitempty"`
	Name        string     `json:"name"`
	SizeBytes   int64      `json:"size_bytes"`
	Mtime       time.Time  `json:"mtime"`
	Ctime       time.Time  `json:"ctime"`
	Inode       *int64     `json:"inode,omitempty"`
	Uid         *int32     `json:"uid,omitempty"`
	Gid         *int32     `json:"gid,omitempty"`
	Type        string     `json:"type"`
	Hidden      bool       `json:"hidden"`
	PathHash    []byte     `json:"path_hash"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// DirNode represents a directory node in a volume scan
type DirNode struct {
	ID              int64     `json:"id"`
	VolumeID        string    `json:"volume_id"`
	ParentDirID     *int64    `json:"parent_dir_id,omitempty"`
	Name            string    `json:"name"`
	FullPath        string    `json:"full_path"`
	Depth           int32     `json:"depth"`
	LatestSizeBytes int64     `json:"latest_size_bytes"`
	LatestFileCount int64     `json:"latest_file_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// DirRollup represents directory rollup statistics
type DirRollup struct {
	ID         int64     `json:"id"`
	DirID      int64     `json:"dir_id"`
	SizeBytes  int64     `json:"size_bytes"`
	FileCount  int64     `json:"file_count"`
	ComputedAt time.Time `json:"computed_at"`
	CreatedAt  time.Time `json:"created_at"`
}

// CreateScanJobParams represents parameters for creating a scan job
type CreateScanJobParams struct {
	ScanID            string     `json:"scan_id"`
	VolumeID          string     `json:"volume_id"`
	TriggerType       string     `json:"trigger_type"`
	TriggerBy         string     `json:"trigger_by"`
	Status            string     `json:"status"`
	ScanProgress      float64    `json:"scan_progress"`
	Progress          *int32     `json:"progress,omitempty"`
	Method            string     `json:"method"`
	StartedAt         *time.Time `json:"started_at,omitempty"`
	CompletedAt       *time.Time `json:"completed_at,omitempty"`
	ErrorMessage      *string    `json:"error_message,omitempty"`
	ResultID          *int64     `json:"result_id,omitempty"`
	EstimatedDuration *int64     `json:"estimated_duration,omitempty"`
}

// UpdateScanJobStatusParams represents parameters for updating scan job status
type UpdateScanJobStatusParams struct {
	ID           int64   `json:"id"`
	Status       string  `json:"status"`
	ScanProgress float64 `json:"scan_progress"`
	FilesScanned int64   `json:"files_scanned"`
	SizeScanned  int64   `json:"size_scanned"`
}

// ListVolumesParams represents parameters for listing volumes
type ListVolumesParams struct {
	Limit  int32 `json:"limit"`
	Offset int32 `json:"offset"`
}

// CreateFileEntryParams represents parameters for creating a file entry
type CreateFileEntryParams struct {
	VolumeID    string     `json:"volume_id"`
	ParentDirID *int64     `json:"parent_dir_id,omitempty"`
	Name        string     `json:"name"`
	SizeBytes   int64      `json:"size_bytes"`
	Mtime       time.Time  `json:"mtime"`
	Ctime       time.Time  `json:"ctime"`
	Inode       *int64     `json:"inode,omitempty"`
	Uid         *int32     `json:"uid,omitempty"`
	Gid         *int32     `json:"gid,omitempty"`
	Type        string     `json:"type"`
	Hidden      bool       `json:"hidden"`
	PathHash    []byte     `json:"path_hash"`
}

// ==============================================================================
// ADDITIONAL DOMAIN MODELS
// ==============================================================================

// VolumeUsage represents volume usage statistics
type VolumeUsage struct {
	RefCount int   `json:"ref_count"`
	Size     int64 `json:"size"`
}

// VolumeContainer represents a container using a volume
type VolumeContainer struct {
	ID          int64     `json:"id"`
	ContainerID string    `json:"container_id"`
	VolumeID    string    `json:"volume_id"`
	Name        string    `json:"name"`
	Image       string    `json:"image"`
	State       string    `json:"state"`
	Status      string    `json:"status"`
	MountPath   string    `json:"mount_path"`
	AccessMode  string    `json:"access_mode"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string            `json:"error"`
	Message string            `json:"message,omitempty"`
	Code    string            `json:"code,omitempty"`
	Details map[string]string `json:"details,omitempty"`
}