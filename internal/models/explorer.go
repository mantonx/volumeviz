package models

import (
	"time"
)

// TreeNode represents a file or folder in the directory tree
type TreeNode struct {
	ID          int64     `json:"id" example:"123"`
	Name        string    `json:"name" example:"movies"`
	Path        string    `json:"path" example:"/media/movies"`
	Size        int64     `json:"size" example:"4294967296"`
	Modified    time.Time `json:"modified"`
	Type        string    `json:"type" example:"folder" enums:"file,folder"`
	HasChildren bool      `json:"has_children,omitempty" example:"true"`
	MimeType    string    `json:"mime_type,omitempty" example:"video/mp4"`
	Extension   string    `json:"extension,omitempty" example:"mp4"`
} // @name TreeNode

// FolderNode represents a folder in the directory tree
type FolderNode struct {
	ID       int64     `json:"id" example:"123"`
	Name     string    `json:"name" example:"movies"`
	Path     string    `json:"path" example:"/media/movies"`
	Size     int64     `json:"size" example:"4294967296"`
	Modified time.Time `json:"modified"`
	Type     string    `json:"type" example:"folder"`
} // @name FolderNode

// FileNode represents a file in the directory listing
type FileNode struct {
	ID        int64     `json:"id" example:"456"`
	Name      string    `json:"name" example:"movie.mp4"`
	Path      string    `json:"path" example:"/media/movies/movie.mp4"`
	Size      int64     `json:"size" example:"1073741824"`
	Modified  time.Time `json:"modified"`
	MimeType  string    `json:"mime_type" example:"video/mp4"`
	Extension string    `json:"extension" example:"mp4"`
	MediaKind string    `json:"media_kind,omitempty" example:"video"`
} // @name FileNode

// DirectoryListing represents the contents of a directory
type DirectoryListing struct {
	Volume     string             `json:"volume" example:"media-library"`
	Path       string             `json:"path" example:"/movies"`
	Parent     *FolderNode        `json:"parent,omitempty"`
	Children   []TreeNode         `json:"children"`
	Pagination PaginationResponse `json:"pagination"`
} // @name DirectoryListing

// FileListResponse represents a list of files
type FileListResponse struct {
	Volume     string             `json:"volume" example:"media-library"`
	Path       string             `json:"path" example:"/movies"`
	Files      []FileNode         `json:"files"`
	Pagination PaginationResponse `json:"pagination"`
	Filters    FileFilters        `json:"filters,omitempty"`
} // @name FileListResponse

// FileFilters represents file filtering options
type FileFilters struct {
	Extension string `json:"extension,omitempty" example:"mp4"`
	MimeType  string `json:"mime_type,omitempty" example:"video/mp4"`
	MinSize   *int64 `json:"min_size,omitempty" example:"1048576"`
	MaxSize   *int64 `json:"max_size,omitempty" example:"10737418240"`
} // @name FileFilters

// PaginationResponse represents pagination metadata
type PaginationResponse struct {
	Page     int   `json:"page" example:"1"`
	PageSize int   `json:"page_size" example:"50"`
	Total    int64 `json:"total" example:"1234"`
	Pages    int   `json:"pages" example:"25"`
} // @name PaginationResponse

// FileDetailsResponse represents detailed file information
type FileDetailsResponse struct {
	ID            int64             `json:"id" example:"123"`
	Name          string            `json:"name" example:"movie.mp4"`
	Path          string            `json:"path" example:"/media/movies/movie.mp4"`
	VolumeID      string            `json:"volume_id" example:"media-library"`
	Size          int64             `json:"size" example:"1073741824"`
	DiskUsage     int64             `json:"disk_usage" example:"1073741824"`
	MimeType      string            `json:"mime_type" example:"video/mp4"`
	MediaKind     string            `json:"media_kind,omitempty" example:"video"`
	Extension     string            `json:"extension" example:"mp4"`
	Modified      time.Time         `json:"modified"`
	Created       *time.Time        `json:"created,omitempty"`
	Permissions   *FilePermissions  `json:"permissions,omitempty"`
	Checksums     map[string]string `json:"checksums,omitempty"`
	IsSymlink     bool              `json:"is_symlink,omitempty"`
	SymlinkTarget string            `json:"symlink_target,omitempty"`
} // @name FileDetailsResponse

// FilePermissions represents file system permissions
type FilePermissions struct {
	Mode  int32  `json:"mode" example:"644"`
	Owner string `json:"owner,omitempty" example:"user"`
	Group string `json:"group,omitempty" example:"users"`
	UID   *int32 `json:"uid,omitempty" example:"1000"`
	GID   *int32 `json:"gid,omitempty" example:"1000"`
} // @name FilePermissions

// FileMetadataResponse represents rich media metadata for a file
type FileMetadataResponse struct {
	FileID    int64                  `json:"file_id" example:"123"`
	Metadata  map[string]interface{} `json:"metadata"`
	Enriched  bool                   `json:"enriched" example:"true"`
	UpdatedAt time.Time              `json:"updated_at"`
} // @name FileMetadataResponse

// FilterMetadataResponse represents available filter options
type FilterMetadataResponse struct {
	MimeTypes  []MimeTypeOption  `json:"mime_types"`
	MediaKinds []MediaKindOption `json:"media_kinds"`
	Extensions []ExtensionOption `json:"extensions"`
} // @name FilterMetadataResponse

// MimeTypeOption represents a MIME type option with metadata
type MimeTypeOption struct {
	Value     string `json:"value" example:"video/mp4"`
	Label     string `json:"label" example:"MP4 Video"`
	FileCount int    `json:"file_count" example:"1250"`
} // @name MimeTypeOption

// MediaKindOption represents a media kind option with metadata
type MediaKindOption struct {
	Value     string `json:"value" example:"video"`
	Label     string `json:"label" example:"Video"`
	FileCount int    `json:"file_count" example:"5000"`
} // @name MediaKindOption

// ExtensionOption represents a file extension option with metadata
type ExtensionOption struct {
	Value     string `json:"value" example:"mp4"`
	Label     string `json:"label" example:"MP4 Files"`
	FileCount int    `json:"file_count" example:"1250"`
} // @name ExtensionOption

// AggregateTreeNode represents a node with aggregated file system data
type AggregateTreeNode struct {
	ID         string              `json:"id" example:"node-123"`
	Name       string              `json:"name" example:"movies"`
	Path       string              `json:"path" example:"/media/movies"`
	ParentPath string              `json:"parent_path,omitempty" example:"/media"`
	Type       string              `json:"type" example:"directory" enums:"file,directory"`
	Size       int64               `json:"size" example:"4294967296"`
	Count      int                 `json:"count" example:"42"`
	Extension  string              `json:"extension,omitempty" example:"mp4"`
	MimeType   string              `json:"mime_type,omitempty" example:"video/mp4"`
	Modified   time.Time           `json:"modified"`
	Created    *time.Time          `json:"created,omitempty"`
	Children   []AggregateTreeNode `json:"children,omitempty"`
	Depth      int                 `json:"depth" example:"2"`
	Color      string              `json:"color,omitempty" example:"#3b82f6"`
	Opacity    float64             `json:"opacity,omitempty" example:"0.8"`
} // @name AggregateTreeNode

// AggregateStats provides statistics for aggregated data
type AggregateStats struct {
	TotalSize    int64      `json:"total_size" example:"10737418240"`
	TotalCount   int        `json:"total_count" example:"1234"`
	FileCount    int        `json:"file_count" example:"1000"`
	DirCount     int        `json:"dir_count" example:"234"`
	MaxDepth     int        `json:"max_depth" example:"5"`
	AvgFileSize  int64      `json:"avg_file_size" example:"10485760"`
	MedianSize   int64      `json:"median_size" example:"5242880"`
	LargestFile  *FileRef   `json:"largest_file,omitempty"`
	LastModified time.Time  `json:"last_modified"`
} // @name AggregateStats

// FileRef is a reference to a specific file
type FileRef struct {
	ID   string `json:"id" example:"file-456"`
	Name string `json:"name" example:"large-video.mp4"`
	Path string `json:"path" example:"/media/movies/large-video.mp4"`
	Size int64  `json:"size" example:"5368709120"`
} // @name FileRef

// AggregateResponse is the response for aggregate endpoint
type AggregateResponse struct {
	Nodes    []AggregateTreeNode  `json:"nodes"`
	Stats    AggregateStats       `json:"stats"`
	Metadata AggregateMetadata    `json:"metadata"`
} // @name AggregateResponse

// AggregateMetadata provides metadata about the aggregate response
type AggregateMetadata struct {
	CacheHit      bool      `json:"cache_hit" example:"false"`
	ComputeTimeMs int64     `json:"compute_time_ms" example:"125"`
	Timestamp     time.Time `json:"timestamp"`
	Truncated     bool      `json:"truncated" example:"false"`
} // @name AggregateMetadata

// DuplicateFile represents a file for duplicate detection
type DuplicateFile struct {
	ID           string    `json:"id" example:"file-123"`
	Path         string    `json:"path" example:"/media/photos/img1.jpg"`
	Name         string    `json:"name" example:"img1.jpg"`
	Size         int64     `json:"size" example:"2048000"`
	Hash         string    `json:"hash,omitempty" example:"d41d8cd98f00b204e9800998ecf8427e"`
	ModifiedTime time.Time `json:"modified_time" example:"2024-01-15T10:30:00Z"`
	VolumeID     string    `json:"volume_id" example:"media-library"`
} // @name DuplicateFile

// Operation represents a tracked file system operation for undo/rollback
type Operation struct {
	ID          string              `json:"id" example:"op-123"`
	Type        OperationType       `json:"type" example:"delete"`
	Status      OperationStatus     `json:"status" example:"completed"`
	VolumeID    string              `json:"volume_id" example:"media-library"`
	Description string              `json:"description" example:"Delete 5 duplicate files"`
	CreatedAt   time.Time           `json:"created_at"`
	CompletedAt *time.Time          `json:"completed_at,omitempty"`
	Actions     []OperationAction   `json:"actions"`
	Metadata    OperationMetadata   `json:"metadata,omitempty"`
} // @name Operation

// OperationType represents the type of operation
type OperationType string

const (
	OperationTypeDelete OperationType = "delete"
	OperationTypeMove   OperationType = "move"
	OperationTypeCopy   OperationType = "copy"
	OperationTypeRename OperationType = "rename"
) // @name OperationType

// OperationStatus represents the status of an operation
type OperationStatus string

const (
	OperationStatusPending    OperationStatus = "pending"
	OperationStatusInProgress OperationStatus = "in_progress"
	OperationStatusCompleted  OperationStatus = "completed"
	OperationStatusFailed     OperationStatus = "failed"
	OperationStatusRolledBack OperationStatus = "rolled_back"
) // @name OperationStatus

// OperationAction represents an individual action within an operation
type OperationAction struct {
	ID           string        `json:"id" example:"action-456"`
	Type         OperationType `json:"type" example:"delete"`
	SourcePath   string        `json:"source_path" example:"/media/photos/img1.jpg"`
	TargetPath   string        `json:"target_path,omitempty" example:"/media/photos/backup/img1.jpg"`
	FileSize     int64         `json:"file_size" example:"2048000"`
	Status       string        `json:"status" example:"completed"`
	ExecutedAt   *time.Time    `json:"executed_at,omitempty"`
	BackupPath   string        `json:"backup_path,omitempty" example:"/tmp/volumeviz-backup/img1.jpg"`
	ErrorMessage string        `json:"error_message,omitempty"`
} // @name OperationAction

// OperationMetadata contains additional metadata for operations
type OperationMetadata struct {
	TotalFiles      int    `json:"total_files" example:"5"`
	ProcessedFiles  int    `json:"processed_files" example:"3"`
	TotalSizeBytes  int64  `json:"total_size_bytes" example:"10240000"`
	SavedSpaceBytes int64  `json:"saved_space_bytes,omitempty" example:"8192000"`
	WorkflowID      string `json:"workflow_id,omitempty" example:"cleanup-workflow-789"`
	RiskLevel       string `json:"risk_level,omitempty" example:"medium"`
} // @name OperationMetadata

// RollbackRequest represents a request to rollback an operation
type RollbackRequest struct {
	OperationID string   `json:"operation_id" example:"op-123"`
	ActionIDs   []string `json:"action_ids,omitempty" example:"[\"action-456\", \"action-789\"]"`
	Reason      string   `json:"reason,omitempty" example:"User requested rollback"`
} // @name RollbackRequest

// RollbackResponse represents the response from a rollback operation
type RollbackResponse struct {
	Success       bool                    `json:"success" example:"true"`
	RolledBack    []string                `json:"rolled_back" example:"[\"action-456\", \"action-789\"]"`
	Failed        []RollbackFailure       `json:"failed,omitempty"`
	OperationID   string                  `json:"operation_id" example:"rollback-op-321"`
	CompletedAt   time.Time               `json:"completed_at"`
} // @name RollbackResponse

// RollbackFailure represents a failed rollback action
type RollbackFailure struct {
	ActionID     string `json:"action_id" example:"action-456"`
	ErrorMessage string `json:"error_message" example:"Source file no longer exists"`
	Reason       string `json:"reason" example:"backup_missing"`
} // @name RollbackFailure

// OperationHistory represents paginated operation history
type OperationHistory struct {
	Operations []Operation        `json:"operations"`
	Pagination PaginationResponse `json:"pagination"`
} // @name OperationHistory
