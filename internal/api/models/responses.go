package models

import (
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
)

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string         `json:"error" example:"Volume not found"`
	Code    string         `json:"code,omitempty" example:"VOLUME_NOT_FOUND"`
	Details map[string]any `json:"details,omitempty"`
} // @name ErrorResponse

// HealthResponse represents a health check response
type HealthResponse struct {
	Status     string                 `json:"status" example:"ok"`
	Service    string                 `json:"service" example:"volumeviz"`
	Version    string                 `json:"version" example:"v1"`
	Timestamp  time.Time              `json:"timestamp"`
	Components map[string]interface{} `json:"components,omitempty"`
} // @name HealthResponse

// VolumeResponse represents a Docker volume
type VolumeResponse struct {
	ID         string            `json:"id" example:"tv-shows-readonly"`
	Name       string            `json:"name" example:"tv-shows-readonly"`
	Driver     string            `json:"driver" example:"local"`
	Mountpoint string            `json:"mountpoint" example:"/var/lib/docker/volumes/tv-shows-readonly/_data"`
	CreatedAt  time.Time         `json:"created_at"`
	Labels     map[string]string `json:"labels,omitempty"`
	Options    map[string]string `json:"options,omitempty"`
} // @name VolumeResponse

// VolumeListResponse represents a list of volumes
type VolumeListResponse struct {
	Volumes []VolumeResponse `json:"volumes"`
	Total   int              `json:"total" example:"1"`
} // @name VolumeListResponse

// ScanResult represents the result of a volume scan
type ScanResult struct {
	VolumeID       string        `json:"volume_id" example:"tv-shows-readonly"`
	TotalSize      int64         `json:"total_size" example:"70640394854400"`
	FileCount      int           `json:"file_count" example:"12543"`
	DirectoryCount int           `json:"directory_count" example:"1204"`
	LargestFile    int64         `json:"largest_file" example:"8589934592"`
	Method         string        `json:"method" example:"du"`
	ScannedAt      time.Time     `json:"scanned_at"`
	Duration       time.Duration `json:"duration" example:"13248000000"`
	CacheHit       bool          `json:"cache_hit" example:"false"`
	FilesystemType string        `json:"filesystem_type" example:"cifs"`
} // @name ScanResult

// ScanResponse represents a volume scan response
type ScanResponse struct {
	VolumeID string      `json:"volume_id" example:"tv-shows-readonly"`
	Result   *ScanResult `json:"result"`
	Cached   bool        `json:"cached" example:"false"`
} // @name ScanResponse

// AsyncScanResponse represents an async scan response
type AsyncScanResponse struct {
	ScanID   string `json:"scan_id" example:"scan_tv-shows-readonly_1640995200"`
	VolumeID string `json:"volume_id" example:"tv-shows-readonly"`
	Status   string `json:"status" example:"started"`
} // @name AsyncScanResponse

// ScanProgress represents the progress of an ongoing scan
type ScanProgress struct {
	ScanID             string        `json:"scan_id" example:"scan_tv-shows-readonly_1640995200"`
	VolumeID           string        `json:"volume_id" example:"tv-shows-readonly"`
	Status             string        `json:"status" example:"running" enums:"pending,running,completed,failed,canceled"`
	Progress           float64       `json:"progress" example:"0.75"`
	FilesScanned       int           `json:"files_scanned" example:"9407"`
	CurrentPath        string        `json:"current_path" example:"/mnt/tv-shows/Season 3"`
	EstimatedRemaining time.Duration `json:"estimated_remaining" example:"3300000000"`
	Method             string        `json:"method" example:"native"`
	StartedAt          time.Time     `json:"started_at"`
	Error              string        `json:"error,omitempty"`
} // @name ScanProgress

// BulkScanRequest represents a request to scan multiple volumes
type BulkScanRequest struct {
	VolumeIDs []string `json:"volume_ids" binding:"required" example:"tv-shows-readonly,movies-readonly"`
	Async     bool     `json:"async" example:"false"`
	Method    string   `json:"method,omitempty" example:"du"`
} // @name BulkScanRequest

// BulkScanResponse represents the response from a bulk scan operation
type BulkScanResponse struct {
	ScanID   string            `json:"scan_id,omitempty" example:"bulk_scan_1640995200"`
	Results  map[string]any    `json:"results"`
	Failed   map[string]string `json:"failed,omitempty"`
	Total    int               `json:"total" example:"2"`
	Success  int               `json:"success" example:"1"`
	Failures int               `json:"failures" example:"1"`
} // @name BulkScanResponse

// RefreshRequest represents a request to refresh volume size
type RefreshRequest struct {
	Async  bool   `json:"async" example:"false"`
	Method string `json:"method,omitempty" example:"du"`
} // @name RefreshRequest

// MethodInfo provides information about available scan methods
type MethodInfo struct {
	Name        string   `json:"name" example:"du"`
	Available   bool     `json:"available" example:"true"`
	Description string   `json:"description" example:"du-based volume scanning"`
	Performance string   `json:"performance" example:"medium" enums:"fast,medium,slow"`
	Accuracy    string   `json:"accuracy" example:"high" enums:"high,medium,basic"`
	Features    []string `json:"features" example:"reliable,standard_tool"`
} // @name MethodInfo

// SystemInfoResponse represents system information
type SystemInfoResponse struct {
	Docker struct {
		Version       string `json:"version" example:"24.0.6"`
		APIVersion    string `json:"api_version" example:"1.43"`
		ServerVersion string `json:"server_version" example:"24.0.6"`
		Connected     bool   `json:"connected" example:"true"`
	} `json:"docker"`
	VolumeViz struct {
		Version   string `json:"version" example:"1.0.0"`
		BuildTime string `json:"build_time" example:"2025-01-31T22:30:00Z"`
		GoVersion string `json:"go_version" example:"go1.24.5"`
	} `json:"volumeviz"`
	System struct {
		Platform     string `json:"platform" example:"linux"`
		Architecture string `json:"architecture" example:"amd64"`
		CPUs         int    `json:"cpus" example:"4"`
		Memory       int64  `json:"memory" example:"8589934592"`
	} `json:"system"`
} // @name SystemInfoResponse

// VolumeDetailResponse represents volume details with containers
type VolumeDetailResponse struct {
	Volume     VolumeResponse    `json:"volume"`
	Containers []VolumeContainer `json:"containers"`
} // @name VolumeDetailResponse

// VolumeContainer represents a container using a volume
type VolumeContainer struct {
	ID    string `json:"id" example:"abc123"`
	Name  string `json:"name" example:"my-container"`
	State string `json:"state" example:"running"`
} // @name VolumeContainer

// ConvertFromCoreInterfaces converts core interfaces to API models
func ConvertScanResult(result *interfaces.ScanResult) *ScanResult {
	if result == nil {
		return nil
	}
	return &ScanResult{
		VolumeID:       result.VolumeID,
		TotalSize:      result.TotalSize,
		FileCount:      result.FileCount,
		DirectoryCount: result.DirectoryCount,
		LargestFile:    result.LargestFile,
		Method:         result.Method,
		ScannedAt:      result.ScannedAt,
		Duration:       result.Duration,
		CacheHit:       result.CacheHit,
		FilesystemType: result.FilesystemType,
	}
}

func ConvertScanProgress(progress *interfaces.ScanProgress) *ScanProgress {
	if progress == nil {
		return nil
	}
	return &ScanProgress{
		ScanID:             progress.ScanID,
		VolumeID:           progress.VolumeID,
		Status:             progress.Status,
		Progress:           progress.Progress,
		FilesScanned:       progress.FilesScanned,
		CurrentPath:        progress.CurrentPath,
		EstimatedRemaining: progress.EstimatedRemaining,
		Method:             progress.Method,
		StartedAt:          progress.StartedAt,
		Error:              progress.Error,
	}
}

func ConvertMethodInfo(methods []interfaces.MethodInfo) []MethodInfo {
	result := make([]MethodInfo, len(methods))
	for i, method := range methods {
		result[i] = MethodInfo{
			Name:        method.Name,
			Available:   method.Available,
			Description: method.Description,
			Performance: method.Performance,
			Accuracy:    method.Accuracy,
			Features:    method.Features,
		}
	}
	return result
}
