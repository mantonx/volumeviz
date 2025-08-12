package interfaces

import (
	"context"
	"time"
)

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

// RollupStats represents aggregate statistics for rollups
type RollupStats struct {
	TotalRollups           int64      `json:"total_rollups"`
	DirectoriesWithRollups int64      `json:"directories_with_rollups"`
	OldestRollup           *time.Time `json:"oldest_rollup,omitempty"`
	NewestRollup           *time.Time `json:"newest_rollup,omitempty"`
}

// DirectoryStore handles directory node operations
type DirectoryStore interface {
	// Basic CRUD operations
	CreateDirNode(ctx context.Context, node *DirNode) (*DirNode, error)
	GetDirNode(ctx context.Context, id int64, volumeID string) (*DirNode, error)
	UpsertDirNode(ctx context.Context, node *DirNode) (*DirNode, error)
	UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error
	
	// Query operations
	GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*DirNode, error)
	GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*DirNode, error)
	GetRootDirNodes(ctx context.Context, volumeID string) ([]*DirNode, error)
	GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*DirNode, error)
	GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*DirNode, error)
	
	// Bulk operations
	BulkInsertDirNodes(ctx context.Context, nodes []*DirNode, params BulkInsertParams) error
	DeleteDirNodesByVolume(ctx context.Context, volumeID string) error
	
	// Statistics
	CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error)
}

// RollupStore handles directory rollup operations
type RollupStore interface {
	// Basic CRUD operations
	CreateDirRollup(ctx context.Context, rollup *DirRollup) (*DirRollup, error)
	GetDirRollup(ctx context.Context, id int64) (*DirRollup, error)
	GetLatestDirRollup(ctx context.Context, dirID int64) (*DirRollup, error)
	
	// Query operations
	GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*DirRollup, error)
	GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*DirRollup, error)
	
	// Bulk operations
	BulkInsertDirRollups(ctx context.Context, rollups []*DirRollup, params BulkInsertParams) error
	DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error
	DeleteRollupsByDirID(ctx context.Context, dirID int64) error
	
	// Statistics
	CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error)
	GetRollupStats(ctx context.Context) (*RollupStats, error)
}