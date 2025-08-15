package models

// DailyStats represents daily volume statistics for API responses
type DailyStats struct {
	Date        string  `json:"date" example:"2023-01-01"`
	VolumeID    string  `json:"volume_id" example:"tv-shows-readonly"`
	SizeBytes   int64   `json:"size_bytes" example:"1073741824"`
	FileCount   int64   `json:"file_count" example:"2500"`
	FolderCount int64   `json:"folder_count" example:"150"`
	Growth      int64   `json:"growth" example:"52428800"`
	GrowthRate  float64 `json:"growth_rate" example:"5.12"`
} // @name DailyStats

// VolumeStatsResponse represents volume statistics over time
type VolumeStatsResponse struct {
	VolumeID   string       `json:"volume_id" example:"tv-shows-readonly"`
	Period     string       `json:"period" example:"30d" enums:"7d,30d,90d,365d"`
	DailyStats []DailyStats `json:"daily_stats"`
	Summary    StatsSummary `json:"summary"`
} // @name VolumeStatsResponse

// StatsSummary represents aggregated statistics
type StatsSummary struct {
	TotalSize     int64   `json:"total_size" example:"1073741824"`
	TotalFiles    int64   `json:"total_files" example:"2500"`
	TotalFolders  int64   `json:"total_folders" example:"150"`
	AverageGrowth float64 `json:"average_growth" example:"1048576"`
	GrowthTrend   string  `json:"growth_trend" example:"increasing" enums:"increasing,decreasing,stable"`
} // @name StatsSummary

// TopFoldersResponse represents the largest folders in a volume
type TopFoldersResponse struct {
	VolumeID string           `json:"volume_id" example:"tv-shows-readonly"`
	Folders  []FolderSizeInfo `json:"folders"`
} // @name TopFoldersResponse

// FolderSizeInfo represents folder size information for API responses
type FolderSizeInfo struct {
	ID                      int64   `json:"id" example:"123"`
	Name                    string  `json:"name" example:"Season 1"`
	Path                    string  `json:"path" example:"/data/tv-shows/Series/Season 1"`
	SizeBytesRecursive      int64   `json:"size_bytes_recursive" example:"5368709120"`
	DiskUsageBytesRecursive int64   `json:"disk_usage_bytes_recursive" example:"5368709120"`
	FileCount               int64   `json:"file_count" example:"24"`
	DirCount                int64   `json:"dir_count" example:"1"`
	PercentageOfVolume      float64 `json:"percentage_of_volume" example:"25.5"`
} // @name FolderSizeInfo
