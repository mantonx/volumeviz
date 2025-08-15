package models

import "time"

// FileExplorerResponse represents the file explorer tree view response
type FileExplorerResponse struct {
	VolumeID     string     `json:"volume_id" example:"tv-shows-readonly"`
	CurrentPath  string     `json:"current_path" example:"/data/tv-shows"`
	Breadcrumbs  []PathItem `json:"breadcrumbs"`
	Contents     []FileItem `json:"contents"`
	Pagination   Pagination `json:"pagination"`
} // @name FileExplorerResponse

// PathItem represents a breadcrumb path item
type PathItem struct {
	Name string `json:"name" example:"tv-shows"`
	Path string `json:"path" example:"/data/tv-shows"`
} // @name PathItem

// FileItem represents a file or folder in the explorer
type FileItem struct {
	ID          int64     `json:"id" example:"123"`
	Name        string    `json:"name" example:"Season 1"`
	Type        string    `json:"type" example:"folder" enums:"file,folder"`
	Size        int64     `json:"size" example:"5368709120"`
	Modified    time.Time `json:"modified" example:"2023-01-01T15:30:00Z"`
	Extension   string    `json:"extension,omitempty" example:"mp4"`
	MimeType    string    `json:"mime_type,omitempty" example:"video/mp4"`
	HasChildren bool      `json:"has_children,omitempty" example:"true"`
	IsHidden    bool      `json:"is_hidden" example:"false"`
	Permissions string    `json:"permissions,omitempty" example:"rwxr-xr-x"`
} // @name FileItem

// Pagination represents pagination information
type Pagination struct {
	Page       int   `json:"page" example:"1"`
	PerPage    int   `json:"per_page" example:"100"`
	Total      int64 `json:"total" example:"1500"`
	TotalPages int   `json:"total_pages" example:"15"`
} // @name Pagination

// FileSearchResponse represents search results
type FileSearchResponse struct {
	VolumeID string     `json:"volume_id" example:"tv-shows-readonly"`
	Query    string     `json:"query" example:"*.mp4"`
	Results  []FileItem `json:"results"`
	Duration string     `json:"duration" example:"125ms"`
} // @name FileSearchResponse

// FolderStatsResponse represents detailed folder statistics
type FolderStatsResponse struct {
	FolderID        int64              `json:"folder_id" example:"123"`
	Path            string             `json:"path" example:"/data/tv-shows/Series"`
	TotalSize       int64              `json:"total_size" example:"10737418240"`
	FileCount       int64              `json:"file_count" example:"48"`
	FolderCount     int64              `json:"folder_count" example:"2"`
	MediaBreakdown  map[string]int64   `json:"media_breakdown"`
	LargestFiles    []FileItem         `json:"largest_files"`
	RecentActivity  []ActivityItem     `json:"recent_activity"`
} // @name FolderStatsResponse

// ActivityItem represents recent file activity
type ActivityItem struct {
	Type      string    `json:"type" example:"added" enums:"added,modified,deleted"`
	File      string    `json:"file" example:"new-episode.mp4"`
	Timestamp time.Time `json:"timestamp" example:"2023-01-01T15:30:00Z"`
	Size      int64     `json:"size,omitempty" example:"2147483648"`
} // @name ActivityItem
