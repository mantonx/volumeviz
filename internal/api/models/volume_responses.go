package models

import (
	"time"
)

// VolumeV1 represents a volume in the v1 API format
type VolumeV1 struct {
	Name               string              `json:"name" example:"tv-shows-readonly"`
	Driver             string              `json:"driver" example:"local"`
	VolumeType         string              `json:"volume_type" example:"network" enums:"local,bind,network"` // Type: local, bind mount, or network
	CreatedAt          time.Time           `json:"created_at" example:"2023-01-01T10:00:00Z"`
	Labels             map[string]string   `json:"labels,omitempty" example:"com.docker.compose.project:media"`
	Options            map[string]string   `json:"options,omitempty" example:"type:none,device:/mnt/media"`
	Scope              string              `json:"scope" example:"local"`
	Mountpoint         string              `json:"mountpoint" example:"/var/lib/docker/volumes/tv-shows-readonly/_data"`
	SizeBytes          *int64              `json:"size_bytes,omitempty" example:"1073741824"`
	LastScanAt         *time.Time          `json:"last_scan_at,omitempty" example:"2023-01-01T12:00:00Z"`
	AttachmentsCount   int                 `json:"attachments_count" example:"2"`
	ContainerNames     []string            `json:"container_names,omitempty" example:"media-server,plex"`
	IsSystem           bool                `json:"is_system" example:"false"`
	IsOrphaned         bool                `json:"is_orphaned" example:"false"`
	FilesystemCapacity *FilesystemCapacity `json:"filesystem_capacity,omitempty"`
	// File/folder counts from filesystem indexing
	FileCount   *int64 `json:"file_count,omitempty" example:"1250"`   // Total number of files indexed
	FolderCount *int64 `json:"folder_count,omitempty" example:"150"` // Total number of folders indexed
	// Volume status (computed from scan status and active state)
	Status string `json:"status" example:"active"` // Overall status: active, inactive, scanning, error
	// Scan status information
	ScanStatus   *string `json:"scan_status,omitempty" example:"completed"`       // Latest scan status: pending, running, completed, failed
	ScanProgress *int    `json:"scan_progress,omitempty" example:"100"`           // Latest scan progress (0-100)
	LastScanID   *string `json:"last_scan_id,omitempty" example:"scan_abc123def"` // Latest scan ID for tracking
	// Background filesystem indexing status
	FilesystemStatus   *string                 `json:"filesystem_status,omitempty" example:"indexing"` // Background indexing status: indexing, completed, not_started
	FilesystemProgress *map[string]interface{} `json:"filesystem_progress,omitempty"`                  // Background indexing progress details
	// Volume tracking status
	IsTracked   *bool      `json:"is_tracked,omitempty" example:"true"`                             // Whether the volume is being tracked
	TrackedAt   *time.Time `json:"tracked_at,omitempty" example:"2023-01-01T10:00:00Z"`            // When tracking was enabled
	UntrackedAt *time.Time `json:"untracked_at,omitempty" example:"2023-01-01T12:00:00Z"`          // When tracking was disabled
} // @name VolumeV1

// VolumeDetailV1 represents detailed volume information
type VolumeDetailV1 struct {
	Name               string                 `json:"name" example:"tv-shows-readonly"`
	Driver             string                 `json:"driver" example:"local"`
	VolumeType         string                 `json:"volume_type" example:"network" enums:"local,bind,network"` // Type: local, bind mount, or network
	CreatedAt          time.Time              `json:"created_at" example:"2023-01-01T10:00:00Z"`
	Labels             map[string]string      `json:"labels,omitempty" example:"com.docker.compose.project:media"`
	Scope              string                 `json:"scope" example:"local"`
	Mountpoint         string                 `json:"mountpoint" example:"/var/lib/docker/volumes/tv-shows-readonly/_data"`
	SizeBytes          *int64                 `json:"size_bytes,omitempty" example:"1073741824"`
	LastScanAt         *time.Time             `json:"last_scan_at,omitempty" example:"2023-01-01T12:00:00Z"`
	Attachments        []AttachmentV1         `json:"attachments"`
	IsSystem           bool                   `json:"is_system" example:"false"`
	IsOrphaned         bool                   `json:"is_orphaned" example:"false"`
	Meta               map[string]interface{} `json:"meta,omitempty"`
	FilesystemCapacity *FilesystemCapacity    `json:"filesystem_capacity,omitempty"`
	// Scan status information
	ScanStatus   *string `json:"scan_status,omitempty" example:"completed"`       // Latest scan status: pending, running, completed, failed
	ScanProgress *int    `json:"scan_progress,omitempty" example:"100"`           // Latest scan progress (0-100)
	LastScanID   *string `json:"last_scan_id,omitempty" example:"scan_abc123def"` // Latest scan ID for tracking
	// Volume tracking status
	IsTracked   *bool      `json:"is_tracked,omitempty" example:"true"`                    // Whether the volume is being tracked
	TrackedAt   *time.Time `json:"tracked_at,omitempty" example:"2023-01-01T10:00:00Z"`   // When tracking was enabled
	UntrackedAt *time.Time `json:"untracked_at,omitempty" example:"2023-01-01T12:00:00Z"` // When tracking was disabled
} // @name VolumeDetailV1

// AttachmentV1 represents a container attachment to a volume
type AttachmentV1 struct {
	ContainerID   string    `json:"container_id" example:"abc123def456"`
	ContainerName string    `json:"container_name,omitempty" example:"media-server"`
	MountPath     string    `json:"mount_path" example:"/data/tv-shows"`
	RW            bool      `json:"rw" example:"false"`
	FirstSeen     time.Time `json:"first_seen,omitempty" example:"2023-01-01T10:00:00Z"`
	LastSeen      time.Time `json:"last_seen,omitempty" example:"2023-01-01T15:00:00Z"`
} // @name AttachmentV1

// AttachmentsListV1 represents a list of volume attachments
type AttachmentsListV1 struct {
	Data  []AttachmentV1 `json:"data"`
	Total int            `json:"total" example:"5"`
} // @name AttachmentsListV1

// FilesystemCapacity represents filesystem capacity and usage information
type FilesystemCapacity struct {
	TotalBytes     int64   `json:"total_bytes" example:"266978022830080"`     // Total filesystem capacity in bytes
	AvailableBytes int64   `json:"available_bytes" example:"114419344240640"` // Available space in bytes
	UsedBytes      int64   `json:"used_bytes" example:"152558678589440"`      // Used space in bytes
	UsagePercent   float64 `json:"usage_percent" example:"57.14"`             // Usage percentage (0-100)
	BlockSize      int64   `json:"block_size" example:"1024"`                 // Filesystem block size
	TotalBlocks    uint64  `json:"total_blocks" example:"260720725420"`       // Total blocks
	FreeBlocks     uint64  `json:"free_blocks" example:"111737640860"`        // Free blocks available
} // @name FilesystemCapacity

// OrphanedVolumeV1 represents an orphaned volume in the report
type OrphanedVolumeV1 struct {
	Name      string    `json:"name" example:"old-data-volume"`
	Driver    string    `json:"driver" example:"local"`
	SizeBytes int64     `json:"size_bytes" example:"2147483648"`
	CreatedAt time.Time `json:"created_at" example:"2022-06-01T10:00:00Z"`
	IsSystem  bool      `json:"is_system" example:"false"`
} // @name OrphanedVolumeV1

// ErrorDetailsV1 contains error details
type ErrorDetailsV1 struct {
	Code      string                 `json:"code" example:"VOLUME_NOT_FOUND"`
	Message   string                 `json:"message" example:"The requested volume could not be found"`
	Details   map[string]interface{} `json:"details,omitempty"`
	RequestID string                 `json:"request_id" example:"req-123-abc-456"`
} // @name ErrorDetailsV1
