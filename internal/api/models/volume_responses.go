package models

import (
	"time"
)

// VolumeV1 represents a volume in the v1 API format
type VolumeV1 struct {
	Name             string            `json:"name" example:"tv-shows-readonly"`
	Driver           string            `json:"driver" example:"local"`
	CreatedAt        time.Time         `json:"created_at" example:"2023-01-01T10:00:00Z"`
	Labels           map[string]string `json:"labels,omitempty" example:"com.docker.compose.project:media"`
	Scope            string            `json:"scope" example:"local"`
	Mountpoint       string            `json:"mountpoint" example:"/var/lib/docker/volumes/tv-shows-readonly/_data"`
	SizeBytes        *int64            `json:"size_bytes,omitempty" example:"1073741824"`
	LastScanAt       *time.Time        `json:"last_scan_at,omitempty" example:"2023-01-01T12:00:00Z"`
	AttachmentsCount int               `json:"attachments_count" example:"2"`
	IsSystem         bool              `json:"is_system" example:"false"`
	IsOrphaned       bool              `json:"is_orphaned" example:"false"`
} // @name VolumeV1

// VolumeDetailV1 represents detailed volume information
type VolumeDetailV1 struct {
	Name        string                 `json:"name" example:"tv-shows-readonly"`
	Driver      string                 `json:"driver" example:"local"`
	CreatedAt   time.Time              `json:"created_at" example:"2023-01-01T10:00:00Z"`
	Labels      map[string]string      `json:"labels,omitempty" example:"com.docker.compose.project:media"`
	Scope       string                 `json:"scope" example:"local"`
	Mountpoint  string                 `json:"mountpoint" example:"/var/lib/docker/volumes/tv-shows-readonly/_data"`
	SizeBytes   *int64                 `json:"size_bytes,omitempty" example:"1073741824"`
	LastScanAt  *time.Time             `json:"last_scan_at,omitempty" example:"2023-01-01T12:00:00Z"`
	Attachments []AttachmentV1         `json:"attachments"`
	IsSystem    bool                   `json:"is_system" example:"false"`
	IsOrphaned  bool                   `json:"is_orphaned" example:"false"`
	Meta        map[string]interface{} `json:"meta,omitempty"`
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
