package models

import (
	"time"
)

// Volume represents a Docker volume with metadata
type Volume struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	CreatedAt  time.Time         `json:"created_at"`
	Labels     map[string]string `json:"labels"`
	Options    map[string]string `json:"options"`
	Scope      string            `json:"scope"`
	Status     map[string]string `json:"status,omitempty"`
	UsageData  *VolumeUsage      `json:"usage_data,omitempty"`
}

// VolumeUsage contains volume usage statistics
type VolumeUsage struct {
	RefCount int64 `json:"ref_count"`
	Size     int64 `json:"size"`
}

// VolumeContainer represents a container using a volume
type VolumeContainer struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	State       string `json:"state"`
	Status      string `json:"status"`
	MountPath   string `json:"mount_path"`
	MountType   string `json:"mount_type"`
	AccessMode  string `json:"access_mode"`
	Propagation string `json:"propagation,omitempty"`
}

// DockerHealth represents Docker daemon health status
type DockerHealth struct {
	Status      string `json:"status"`
	Message     string `json:"message,omitempty"`
	Version     string `json:"version,omitempty"`
	APIVersion  string `json:"api_version,omitempty"`
	GoVersion   string `json:"go_version,omitempty"`
	GitCommit   string `json:"git_commit,omitempty"`
	BuildTime   string `json:"build_time,omitempty"`
}

// VolumeListResponse represents the response for volume listing
type VolumeListResponse struct {
	Volumes []Volume `json:"volumes"`
	Total   int      `json:"total"`
}

// VolumeDetailResponse represents detailed volume information
type VolumeDetailResponse struct {
	Volume     Volume            `json:"volume"`
	Containers []VolumeContainer `json:"containers"`
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}