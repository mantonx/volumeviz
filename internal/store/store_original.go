// Package store provides database operations for file analytics using sqlc
// Supports both PostgreSQL and SQLite with optimized bulk operations
package store

import (
	"context"
	"time"
)

// FileEntry represents a file or directory entry in the filesystem
type FileEntry struct {
	ID          int64     `json:"id"`
	VolumeID    string    `json:"volume_id"`
	ParentDirID *int64    `json:"parent_dir_id,omitempty"`
	Name        string    `json:"name"`
	SizeBytes   int64     `json:"size_bytes"`
	Mtime       time.Time `json:"mtime"`
	Ctime       time.Time `json:"ctime"`
	Inode       *int64    `json:"inode,omitempty"`
	UID         *int32    `json:"uid,omitempty"`
	GID         *int32    `json:"gid,omitempty"`
	Type        string    `json:"type"` // "file", "dir", "symlink"
	Hidden      bool      `json:"hidden"`
	PathHash    []byte    `json:"path_hash"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// DirNode represents a directory in the filesystem hierarchy
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

// DirRollup represents aggregated statistics for a directory over time
type DirRollup struct {
	ID         int64     `json:"id"`
	DirID      int64     `json:"dir_id"`
	SizeBytes  int64     `json:"size_bytes"`
	FileCount  int64     `json:"file_count"`
	ComputedAt time.Time `json:"computed_at"`
	CreatedAt  time.Time `json:"created_at"`
}

// Volume represents a Docker volume
type Volume struct {
	ID         int64             `json:"id"`
	VolumeID   string            `json:"volume_id"`
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Labels     map[string]string `json:"labels,omitempty"`
	Options    map[string]string `json:"options,omitempty"`
	Scope      string            `json:"scope,omitempty"`
	Status     string            `json:"status,omitempty"`
	IsActive   bool              `json:"is_active"`
	CreatedAt  time.Time         `json:"created_at"`
	UpdatedAt  time.Time         `json:"updated_at"`
}

// Container represents a Docker container
type Container struct {
	ID          int64             `json:"id"`
	ContainerID string            `json:"container_id"`
	Name        string            `json:"name"`
	Image       string            `json:"image"`
	State       string            `json:"state"`
	Status      string            `json:"status,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	StartedAt   *time.Time        `json:"started_at,omitempty"`
	FinishedAt  *time.Time        `json:"finished_at,omitempty"`
	IsActive    bool              `json:"is_active"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// VolumeMount represents a volume mounted to a container
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

// VolumeFileStats represents aggregate statistics for a volume
type VolumeFileStats struct {
	TotalFiles   int64 `json:"total_files"`
	TotalSize    int64 `json:"total_size"`
	RegularFiles int64 `json:"regular_files"`
	Directories  int64 `json:"directories"`
	HiddenFiles  int64 `json:"hidden_files"`
}

// RollupStats represents aggregate statistics for rollups
type RollupStats struct {
	TotalRollups           int64      `json:"total_rollups"`
	DirectoriesWithRollups int64      `json:"directories_with_rollups"`
	OldestRollup           *time.Time `json:"oldest_rollup,omitempty"`
	NewestRollup           *time.Time `json:"newest_rollup,omitempty"`
}

// BulkInsertParams defines parameters for bulk insert operations
type BulkInsertParams struct {
	BatchSize int           // Number of records per batch
	Timeout   time.Duration // Operation timeout
}

// TxFunc is a function that executes within a transaction
type TxFunc func(ctx context.Context, tx Store) error

// Store provides operations for file analytics data
// Implementations should be optimized for bulk operations with large datasets
type Store interface {
	// File Entry Operations
	CreateFileEntry(ctx context.Context, entry *FileEntry) (*FileEntry, error)
	GetFileEntry(ctx context.Context, id int64, volumeID string) (*FileEntry, error)
	GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*FileEntry, error)
	GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*FileEntry, error)
	FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*FileEntry, error)
	UpsertFileEntry(ctx context.Context, entry *FileEntry) (*FileEntry, error)
	DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error
	CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error)
	GetVolumeFileStats(ctx context.Context, volumeID string) (*VolumeFileStats, error)

	// Directory Node Operations
	CreateDirNode(ctx context.Context, node *DirNode) (*DirNode, error)
	GetDirNode(ctx context.Context, id int64, volumeID string) (*DirNode, error)
	GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*DirNode, error)
	GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*DirNode, error)
	GetRootDirNodes(ctx context.Context, volumeID string) ([]*DirNode, error)
	GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*DirNode, error)
	GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*DirNode, error)
	UpsertDirNode(ctx context.Context, node *DirNode) (*DirNode, error)
	UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error
	DeleteDirNodesByVolume(ctx context.Context, volumeID string) error
	CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error)

	// Directory Rollup Operations
	CreateDirRollup(ctx context.Context, rollup *DirRollup) (*DirRollup, error)
	GetDirRollup(ctx context.Context, id int64) (*DirRollup, error)
	GetLatestDirRollup(ctx context.Context, dirID int64) (*DirRollup, error)
	GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*DirRollup, error)
	GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*DirRollup, error)
	DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error
	DeleteRollupsByDirID(ctx context.Context, dirID int64) error
	CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error)
	GetRollupStats(ctx context.Context) (*RollupStats, error)

	// Rollup Computation
	// Rollup computes directory rollups for a volume (idempotent & incremental)
	// Supports both full and incremental computation with touched directory tracking
	Rollup(ctx context.Context, volumeID string, opts *RollupOptions) (*RollupResult, error)

	// Bulk Operations (optimized for high-throughput scenarios)
	BulkInsertFileEntries(ctx context.Context, entries []*FileEntry, params BulkInsertParams) error
	BulkInsertDirNodes(ctx context.Context, nodes []*DirNode, params BulkInsertParams) error
	BulkInsertDirRollups(ctx context.Context, rollups []*DirRollup, params BulkInsertParams) error

	// Usage Snapshots Operations (for trends)
	CreateUsageSnapshot(ctx context.Context, params CreateUsageSnapshotParams) (*UsageSnapshot, error)
	GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*UsageSnapshot, error)
	Get7DayTrend(ctx context.Context, volumeID string) (*TrendData, error)
	Get30DayTrend(ctx context.Context, volumeID string) (*TrendData, error)
	GetGrowthDeltas(ctx context.Context, params GetGrowthDeltasParams) (*GrowthDeltasResult, error)
	GetVolumeStepSeries(ctx context.Context, params GetVolumeStepSeriesParams) ([]*StepSeriesPoint, error)
	GetTrendSlope(ctx context.Context, params GetTrendSlopeParams) (*TrendSlopeResult, error)

	// Volume operations  
	UpsertVolume(ctx context.Context, volume *Volume) error
	DeleteVolume(ctx context.Context, volumeID string) error
	GetVolumeByName(ctx context.Context, name string) (*Volume, error)
	ListAllVolumes(ctx context.Context) ([]*Volume, error)

	// Container operations
	UpsertContainer(ctx context.Context, container *Container) error
	DeleteContainer(ctx context.Context, containerID string) error
	GetContainerByID(ctx context.Context, containerID string) (*Container, error)
	ListAllContainers(ctx context.Context) ([]*Container, error)

	// Volume mount operations
	UpsertVolumeMount(ctx context.Context, mount *VolumeMount) error
	DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error
	GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*VolumeMount, error)
	GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*VolumeMount, error)
	DeactivateVolumeMounts(ctx context.Context, containerID string) error
	ListAllVolumeMounts(ctx context.Context) ([]*VolumeMount, error)

	// Transaction management
	Tx(ctx context.Context, fn TxFunc) error
	TxWithTimeout(ctx context.Context, timeout time.Duration, fn TxFunc) error
	ReadOnlyTx(ctx context.Context, fn TxFunc) error
	FastTx(ctx context.Context, fn TxFunc) error
	BulkTx(ctx context.Context, fn TxFunc) error

	// Connection management
	Close() error
	Health(ctx context.Context) error
	
	// Get facade for legacy compatibility
	GetFacade() *StoreFacade
}

// Usage Snapshots Types

// UsageSnapshot represents a snapshot of volume usage at a point in time
type UsageSnapshot struct {
	ID                    int64     `json:"id"`
	VolumeID              string    `json:"volume_id"`
	SnapshotDate          time.Time `json:"snapshot_date"`
	SnapshotType          string    `json:"snapshot_type"`
	TotalSize             int64     `json:"total_size"`
	FileCount             int64     `json:"file_count"`
	DirectoryCount        int64     `json:"directory_count"`
	LargestFile           int64     `json:"largest_file"`
	GrowthBytes           int64     `json:"growth_bytes"`
	GrowthFiles           int64     `json:"growth_files"`
	GrowthRateBytesPerDay float64   `json:"growth_rate_bytes_per_day"`
	ScanMethod            string    `json:"scan_method"`
	ScanDurationMs        int64     `json:"scan_duration_ms"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// CreateUsageSnapshotParams holds parameters for creating a usage snapshot
type CreateUsageSnapshotParams struct {
	VolumeID              string    `json:"volume_id"`
	SnapshotDate          time.Time `json:"snapshot_date"`
	SnapshotType          string    `json:"snapshot_type"`
	TotalSize             int64     `json:"total_size"`
	FileCount             int64     `json:"file_count"`
	DirectoryCount        int64     `json:"directory_count"`
	LargestFile           int64     `json:"largest_file"`
	GrowthBytes           int64     `json:"growth_bytes"`
	GrowthFiles           int64     `json:"growth_files"`
	GrowthRateBytesPerDay float64   `json:"growth_rate_bytes_per_day"`
	ScanMethod            string    `json:"scan_method"`
	ScanDurationMs        int64     `json:"scan_duration_ms"`
}

// TrendData represents trend analysis data
type TrendData struct {
	AvgGrowthRate float64    `json:"avg_growth_rate"`
	TotalGrowth   int64      `json:"total_growth"`
	DataPoints    int64      `json:"data_points"`
	PeriodStart   *time.Time `json:"period_start,omitempty"`
	PeriodEnd     *time.Time `json:"period_end,omitempty"`
}

// GrowthDeltasParams holds parameters for growth deltas query
type GetGrowthDeltasParams struct {
	VolumeID     string `json:"volume_id"`
	SnapshotType string `json:"snapshot_type"`
	Limit        int32  `json:"limit"`
}

// GrowthDeltasResult represents growth delta calculation results
type GrowthDeltasResult struct {
	TotalSizeChange      int64      `json:"total_size_change"`
	TotalFilesChange     int64      `json:"total_files_change"`
	AvgSizeChangePerDay  float64    `json:"avg_size_change_per_day"`
	AvgFilesChangePerDay float64    `json:"avg_files_change_per_day"`
	SnapshotCount        int64      `json:"snapshot_count"`
	PeriodStart          *time.Time `json:"period_start,omitempty"`
	PeriodEnd            *time.Time `json:"period_end,omitempty"`
}

// GetVolumeStepSeriesParams holds parameters for step series query
type GetVolumeStepSeriesParams struct {
	VolumeID     string    `json:"volume_id"`
	SnapshotType string    `json:"snapshot_type"`
	Date         time.Time `json:"date"`
}

// StepSeriesPoint represents a point in the step series
type StepSeriesPoint struct {
	Date       time.Time `json:"date"`
	TotalSize  int64     `json:"total_size"`
	FileCount  int64     `json:"file_count"`
	GrowthRate float64   `json:"growth_rate"`
}

// GetTrendSlopeParams holds parameters for trend slope calculation
type GetTrendSlopeParams struct {
	VolumeID     string    `json:"volume_id"`
	SnapshotType string    `json:"snapshot_type"`
	Date         time.Time `json:"date"`
}

// TrendSlopeResult represents trend slope calculation results
type TrendSlopeResult struct {
	Slope      float64 `json:"slope"`
	DataPoints int64   `json:"data_points"`
}

// DefaultBulkInsertParams returns sensible defaults for bulk operations
func DefaultBulkInsertParams() BulkInsertParams {
	return BulkInsertParams{
		BatchSize: 1000,
		Timeout:   5 * time.Minute,
	}
}
