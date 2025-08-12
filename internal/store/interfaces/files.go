package interfaces

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

// VolumeFileStats represents aggregate statistics for a volume
type VolumeFileStats struct {
	TotalFiles   int64 `json:"total_files"`
	TotalSize    int64 `json:"total_size"`
	RegularFiles int64 `json:"regular_files"`
	Directories  int64 `json:"directories"`
	HiddenFiles  int64 `json:"hidden_files"`
}

// FileStore handles file entry operations
type FileStore interface {
	// Basic CRUD operations
	CreateFileEntry(ctx context.Context, entry *FileEntry) (*FileEntry, error)
	GetFileEntry(ctx context.Context, id int64, volumeID string) (*FileEntry, error)
	UpsertFileEntry(ctx context.Context, entry *FileEntry) (*FileEntry, error)
	
	// Query operations
	GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*FileEntry, error)
	GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*FileEntry, error)
	FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*FileEntry, error)
	
	// Bulk operations
	BulkInsertFileEntries(ctx context.Context, entries []*FileEntry, params BulkInsertParams) error
	DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error
	
	// Statistics
	CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error)
	GetVolumeFileStats(ctx context.Context, volumeID string) (*VolumeFileStats, error)
}

// BulkInsertParams defines parameters for bulk insert operations
type BulkInsertParams struct {
	BatchSize int           // Number of records per batch
	Timeout   time.Duration // Operation timeout
}