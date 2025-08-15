// Package models contains domain models - these are the types that services work with
// These models are independent of database implementation details
package models

import (
	"time"
)

// ==============================================================================
// CORE DOMAIN MODELS
// ==============================================================================

// Volume represents a Docker volume in the domain
// GENERAL API MODELS
// ==============================================================================

// ErrorResponse represents a generic error response for API endpoints
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}

// DockerHealth represents Docker daemon health status
type DockerHealth struct {
	Status     string `json:"status"`
	Message    string `json:"message,omitempty"`
	Version    string `json:"version,omitempty"`
	APIVersion string `json:"api_version,omitempty"`
	GoVersion  string `json:"go_version,omitempty"`
	GitCommit  string `json:"git_commit,omitempty"`
	BuildTime  string `json:"build_time,omitempty"`
}

// ==============================================================================
// FILESYSTEM INDEXING MODELS
// ==============================================================================

// FilesystemIndexingResponse represents filesystem indexing status
type FilesystemIndexingResponse struct {
	VolumeID       string  `json:"volume_id"`
	Status         string  `json:"status"`
	Message        string  `json:"message,omitempty"`
	StartedAt      *string `json:"started_at,omitempty"`
	LastUpdate     *string `json:"last_update,omitempty"`
	FoldersScanned int64   `json:"folders_scanned,omitempty"`
	FilesScanned   int64   `json:"files_scanned,omitempty"`
	BytesProcessed int64   `json:"bytes_processed,omitempty"`
	ErrorsCount    int     `json:"errors_count,omitempty"`
	CurrentPath    string  `json:"current_path,omitempty"`
	CurrentDepth   int     `json:"current_depth,omitempty"`
	FoldersPerSec  float64 `json:"folders_per_sec,omitempty"`
	FilesPerSec    float64 `json:"files_per_sec,omitempty"`
	LastError      string  `json:"last_error,omitempty"`
}

// FilesystemIndexingRequest represents filesystem indexing request options
type FilesystemIndexingRequest struct {
	DeltaMode bool `json:"delta_mode"`
	FullScan  bool `json:"full_scan"`
}

// FilesystemCapabilitiesResponse represents filesystem indexing capabilities
type FilesystemCapabilitiesResponse struct {
	Enabled                 bool            `json:"enabled"`
	Features                map[string]bool `json:"features"`
	SupportedHashAlgorithms []string        `json:"supported_hash_algorithms,omitempty"`
	SupportedMediaKinds     []string        `json:"supported_media_kinds,omitempty"`
}

// ==============================================================================
// MEDIA ENRICHMENT MODELS
// ==============================================================================

// MediaEnrichmentResponse represents media enrichment status
type MediaEnrichmentResponse struct {
	VolumeID       string  `json:"volume_id"`
	Status         string  `json:"status"`
	Message        string  `json:"message,omitempty"`
	StartedAt      *string `json:"started_at,omitempty"`
	LastUpdate     *string `json:"last_update,omitempty"`
	FilesProcessed int64   `json:"files_processed,omitempty"`
	TotalFiles     int64   `json:"total_files,omitempty"`
	ErrorsCount    int     `json:"errors_count,omitempty"`
	CurrentFile    string  `json:"current_file,omitempty"`
	FilesPerSec    float64 `json:"files_per_sec,omitempty"`
	LastError      string  `json:"last_error,omitempty"`
}

// MediaEnrichmentStatusResponse represents the status of media enrichment
type MediaEnrichmentStatusResponse struct {
	VolumeID       string  `json:"volume_id"`
	Status         string  `json:"status"`
	Progress       float64 `json:"progress"`
	FilesProcessed int64   `json:"files_processed"`
	TotalFiles     int64   `json:"total_files"`
	StartedAt      *string `json:"started_at,omitempty"`
	LastUpdate     *string `json:"last_update,omitempty"`
	ErrorsCount    int     `json:"errors_count,omitempty"`
	Message        string  `json:"message,omitempty"`
} // Volume represents a Docker volume in the domain
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
	ID          int64     `json:"id"`
	VolumeID    string    `json:"volume_id"`
	ParentDirID *int64    `json:"parent_dir_id,omitempty"`
	Name        string    `json:"name"`
	SizeBytes   int64     `json:"size_bytes"`
	Mtime       time.Time `json:"mtime"`
	Ctime       time.Time `json:"ctime"`
	Inode       *int64    `json:"inode,omitempty"`
	Uid         *int32    `json:"uid,omitempty"`
	Gid         *int32    `json:"gid,omitempty"`
	Type        string    `json:"type"`
	Hidden      bool      `json:"hidden"`
	PathHash    []byte    `json:"path_hash"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
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
	VolumeID    string    `json:"volume_id"`
	ParentDirID *int64    `json:"parent_dir_id,omitempty"`
	Name        string    `json:"name"`
	SizeBytes   int64     `json:"size_bytes"`
	Mtime       time.Time `json:"mtime"`
	Ctime       time.Time `json:"ctime"`
	Inode       *int64    `json:"inode,omitempty"`
	Uid         *int32    `json:"uid,omitempty"`
	Gid         *int32    `json:"gid,omitempty"`
	Type        string    `json:"type"`
	Hidden      bool      `json:"hidden"`
	PathHash    []byte    `json:"path_hash"`
}

// ==============================================================================
// FILESYSTEM INDEXER DOMAIN MODELS
// ==============================================================================

// Folder represents a directory in the filesystem with rich metadata
type Folder struct {
	ID                      int64      `json:"id"`
	ParentID                *int64     `json:"parent_id,omitempty"`
	VolumeID                string     `json:"volume_id"`
	Name                    string     `json:"name"`
	Path                    string     `json:"path"`
	PathHash                []byte     `json:"path_hash"`
	SizeBytesRecursive      int64      `json:"size_bytes_recursive"`
	DiskUsageBytesRecursive int64      `json:"disk_usage_bytes_recursive"`
	FileCount               int64      `json:"file_count"`
	DirCount                int64      `json:"dir_count"`
	Depth                   int32      `json:"depth"`
	Mtime                   *time.Time `json:"mtime,omitempty"`
	Ctime                   *time.Time `json:"ctime,omitempty"`
	Uid                     *int32     `json:"uid,omitempty"`
	Gid                     *int32     `json:"gid,omitempty"`
	Mode                    *int32     `json:"mode,omitempty"`
	IsSymlink               bool       `json:"is_symlink"`
	SymlinkTarget           *string    `json:"symlink_target,omitempty"`
	CreatedAt               time.Time  `json:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at"`
}

// File represents a file in the filesystem with rich metadata
type File struct {
	ID             int64      `json:"id"`
	FolderID       int64      `json:"folder_id"`
	VolumeID       string     `json:"volume_id"`
	Name           string     `json:"name"`
	Path           string     `json:"path"`
	Extension      *string    `json:"extension,omitempty"`
	SizeBytes      int64      `json:"size_bytes"`
	DiskUsageBytes int64      `json:"disk_usage_bytes"`
	Mtime          *time.Time `json:"mtime,omitempty"`
	Ctime          *time.Time `json:"ctime,omitempty"`
	Birthtime      *time.Time `json:"birthtime,omitempty"`
	Uid            *int32     `json:"uid,omitempty"`
	Gid            *int32     `json:"gid,omitempty"`
	Mode           *int32     `json:"mode,omitempty"`
	Inode          *int64     `json:"inode,omitempty"`
	Device         *string    `json:"device,omitempty"`
	IsSymlink      bool       `json:"is_symlink"`
	SymlinkTarget  *string    `json:"symlink_target,omitempty"`
	Mime           *string    `json:"mime,omitempty"`
	MediaKind      *string    `json:"media_kind,omitempty"`
	Encoding       *string    `json:"encoding,omitempty"`
	HashAlgo       *string    `json:"hash_algo,omitempty"`
	Hash           []byte     `json:"hash,omitempty"`
	PathHash       []byte     `json:"path_hash"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// CreateFolderParams represents parameters for creating a folder
type CreateFolderParams struct {
	ParentID      *int64     `json:"parent_id,omitempty"`
	VolumeID      string     `json:"volume_id"`
	Name          string     `json:"name"`
	Path          string     `json:"path"`
	PathHash      []byte     `json:"path_hash"`
	Depth         int32      `json:"depth"`
	Mtime         *time.Time `json:"mtime,omitempty"`
	Ctime         *time.Time `json:"ctime,omitempty"`
	Uid           *int32     `json:"uid,omitempty"`
	Gid           *int32     `json:"gid,omitempty"`
	Mode          *int32     `json:"mode,omitempty"`
	IsSymlink     bool       `json:"is_symlink"`
	SymlinkTarget *string    `json:"symlink_target,omitempty"`
}

// CreateFileParams represents parameters for creating a file
type CreateFileParams struct {
	FolderID       int64      `json:"folder_id"`
	VolumeID       string     `json:"volume_id"`
	Name           string     `json:"name"`
	Path           string     `json:"path"`
	Extension      *string    `json:"extension,omitempty"`
	SizeBytes      int64      `json:"size_bytes"`
	DiskUsageBytes int64      `json:"disk_usage_bytes"`
	Mtime          *time.Time `json:"mtime,omitempty"`
	Ctime          *time.Time `json:"ctime,omitempty"`
	Birthtime      *time.Time `json:"birthtime,omitempty"`
	Uid            *int32     `json:"uid,omitempty"`
	Gid            *int32     `json:"gid,omitempty"`
	Mode           *int32     `json:"mode,omitempty"`
	Inode          *int64     `json:"inode,omitempty"`
	Device         *string    `json:"device,omitempty"`
	IsSymlink      bool       `json:"is_symlink"`
	SymlinkTarget  *string    `json:"symlink_target,omitempty"`
	Mime           *string    `json:"mime,omitempty"`
	MediaKind      *string    `json:"media_kind,omitempty"`
	Encoding       *string    `json:"encoding,omitempty"`
	HashAlgo       *string    `json:"hash_algo,omitempty"`
	Hash           []byte     `json:"hash,omitempty"`
	PathHash       []byte     `json:"path_hash"`
}

// FolderStats represents folder statistics
type FolderStats struct {
	TotalFolders      int64    `json:"total_folders"`
	RootFolders       int64    `json:"root_folders"`
	MaxDepth          *int32   `json:"max_depth,omitempty"`
	AvgFilesPerFolder *float64 `json:"avg_files_per_folder,omitempty"`
	TotalSize         *int64   `json:"total_size,omitempty"`
	LargestFolderSize *int64   `json:"largest_folder_size,omitempty"`
}

// FileStats represents file statistics
type FileStats struct {
	TotalFiles       int64    `json:"total_files"`
	TotalSize        *int64   `json:"total_size,omitempty"`
	AvgFileSize      *float64 `json:"avg_file_size,omitempty"`
	LargestFile      *int64   `json:"largest_file,omitempty"`
	UniqueExtensions int64    `json:"unique_extensions"`
	UniqueMediaKinds int64    `json:"unique_media_kinds"`
	HashedFiles      int64    `json:"hashed_files"`
}

// MediaKindStat represents statistics for a media kind
type MediaKindStat struct {
	MediaKind *string  `json:"media_kind"`
	FileCount int64    `json:"file_count"`
	TotalSize int64    `json:"total_size"`
	AvgSize   *float64 `json:"avg_size,omitempty"`
}

// ExtensionStat represents statistics for a file extension
type ExtensionStat struct {
	Extension *string  `json:"extension"`
	FileCount int64    `json:"file_count"`
	TotalSize int64    `json:"total_size"`
	AvgSize   *float64 `json:"avg_size,omitempty"`
}

// MediaKind constants for classification
const (
	MediaKindDocument = "document"
	MediaKindImage    = "image"
	MediaKindVideo    = "video"
	MediaKindAudio    = "audio"
	MediaKindArchive  = "archive"
	MediaKindCode     = "code"
	MediaKindData     = "data"
	MediaKindBinary   = "binary"
	MediaKindOther    = "other"
)

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
