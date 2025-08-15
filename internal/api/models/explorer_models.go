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
