package models

import (
	"time"
)

// VolumeV1 represents a volume in the v1 API format
type VolumeV1 struct {
	Name             string            `json:"name"`
	Driver           string            `json:"driver"`
	CreatedAt        time.Time         `json:"created_at"`
	Labels           map[string]string `json:"labels,omitempty"`
	Scope            string            `json:"scope"`
	Mountpoint       string            `json:"mountpoint"`
	SizeBytes        *int64            `json:"size_bytes,omitempty"`
	LastScanAt       *time.Time        `json:"last_scan_at,omitempty"`
	AttachmentsCount int               `json:"attachments_count"`
	IsSystem         bool              `json:"is_system"`
	IsOrphaned       bool              `json:"is_orphaned"`
}

// VolumeDetailV1 represents detailed volume information
type VolumeDetailV1 struct {
	Name             string                 `json:"name"`
	Driver           string                 `json:"driver"`
	CreatedAt        time.Time              `json:"created_at"`
	Labels           map[string]string      `json:"labels,omitempty"`
	Scope            string                 `json:"scope"`
	Mountpoint       string                 `json:"mountpoint"`
	SizeBytes        *int64                 `json:"size_bytes,omitempty"`
	LastScanAt       *time.Time             `json:"last_scan_at,omitempty"`
	Attachments      []AttachmentV1         `json:"attachments"`
	IsSystem         bool                   `json:"is_system"`
	IsOrphaned       bool                   `json:"is_orphaned"`
	Meta             map[string]interface{} `json:"meta,omitempty"`
}

// AttachmentV1 represents a container attachment to a volume
type AttachmentV1 struct {
	ContainerID   string    `json:"container_id"`
	ContainerName string    `json:"container_name,omitempty"`
	MountPath     string    `json:"mount_path"`
	RW            bool      `json:"rw"`
	FirstSeen     time.Time `json:"first_seen,omitempty"`
	LastSeen      time.Time `json:"last_seen,omitempty"`
}

// AttachmentsListV1 represents a list of volume attachments
type AttachmentsListV1 struct {
	Data  []AttachmentV1 `json:"data"`
	Total int            `json:"total"`
}

// OrphanedVolumeV1 represents an orphaned volume in the report
type OrphanedVolumeV1 struct {
	Name      string    `json:"name"`
	Driver    string    `json:"driver"`
	SizeBytes int64     `json:"size_bytes"`
	CreatedAt time.Time `json:"created_at"`
	IsSystem  bool      `json:"is_system"`
}

// ErrorV1 represents the uniform error response format
type ErrorV1 struct {
	Error ErrorDetailsV1 `json:"error"`
}

// ErrorDetailsV1 contains error details
type ErrorDetailsV1 struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
	RequestID string                 `json:"request_id"`
}