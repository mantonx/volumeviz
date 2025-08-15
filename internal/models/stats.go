package models

import (
	"time"
)

// DailyStat represents daily aggregate statistics for volumes/folders/media kinds
type DailyStat struct {
	ID            int64      `json:"id"`
	Date          time.Time  `json:"date"`
	VolumeID      string     `json:"volume_id"`
	FolderID      *int64     `json:"folder_id,omitempty"`
	MediaKind     *string    `json:"media_kind,omitempty"`
	FilesCount    int64      `json:"files_count"`
	TotalBytes    int64      `json:"total_bytes"`
	AddedBytes    int64      `json:"added_bytes"`
	RemovedBytes  int64      `json:"removed_bytes"`
	AddedFiles    int64      `json:"added_files"`
	RemovedFiles  int64      `json:"removed_files"`
	ComputedAt    time.Time  `json:"computed_at"`
	ScanID        *string    `json:"scan_id,omitempty"`
	JobDurationMs *int64     `json:"job_duration_ms,omitempty"`
}

// CreateDailyStatParams parameters for creating daily stats
type CreateDailyStatParams struct {
	Date          time.Time  `json:"date"`
	VolumeID      string     `json:"volume_id"`
	FolderID      *int64     `json:"folder_id,omitempty"`
	MediaKind     *string    `json:"media_kind,omitempty"`
	FilesCount    int64      `json:"files_count"`
	TotalBytes    int64      `json:"total_bytes"`
	AddedBytes    int64      `json:"added_bytes"`
	RemovedBytes  int64      `json:"removed_bytes"`
	AddedFiles    int64      `json:"added_files"`
	RemovedFiles  int64      `json:"removed_files"`
	ComputedAt    time.Time  `json:"computed_at"`
	ScanID        *string    `json:"scan_id,omitempty"`
	JobDurationMs *int64     `json:"job_duration_ms,omitempty"`
}

// FolderGrowthTrend represents folder growth data over time
type FolderGrowthTrend struct {
	FolderID     *int64    `json:"folder_id"`
	FolderName   string    `json:"folder_name"`
	FolderPath   string    `json:"folder_path"`
	Date         time.Time `json:"date"`
	TotalBytes   int64     `json:"total_bytes"`
	FilesCount   int64     `json:"files_count"`
	AddedBytes   int64     `json:"added_bytes"`
	RemovedBytes int64     `json:"removed_bytes"`
	AddedFiles   int64     `json:"added_files"`
	RemovedFiles int64     `json:"removed_files"`
}

// TopGrowingFolder represents folders with highest growth in a period
type TopGrowingFolder struct {
	FolderID            *int64  `json:"folder_id"`
	FolderName          string  `json:"folder_name"`
	FolderPath          string  `json:"folder_path"`
	TotalAddedBytes     int64   `json:"total_added_bytes"`
	TotalAddedFiles     int64   `json:"total_added_files"`
	AvgDailyAddedBytes  *string `json:"avg_daily_added_bytes,omitempty"`
	DaysTracked         int64   `json:"days_tracked"`
}

// MediaKindComposition represents media type breakdown over time
type MediaKindComposition struct {
	MediaKind       *string   `json:"media_kind"`
	Date            time.Time `json:"date"`
	FilesCount      int64     `json:"files_count"`
	TotalBytes      int64     `json:"total_bytes"`
	PercentOfVolume *string   `json:"percent_of_volume,omitempty"`
}

// TrendAnalysis represents trend analysis data with growth calculations
type TrendAnalysis struct {
	Date               time.Time  `json:"date"`
	VolumeID           string     `json:"volume_id"`
	FolderID           *int64     `json:"folder_id,omitempty"`
	MediaKind          *string    `json:"media_kind,omitempty"`
	FilesCount         int64      `json:"files_count"`
	TotalBytes         int64      `json:"total_bytes"`
	AddedBytes         int64      `json:"added_bytes"`
	RemovedBytes       int64      `json:"removed_bytes"`
	BytesChange7d      *int64     `json:"bytes_change_7d,omitempty"`
	FilesChange7d      *int64     `json:"files_change_7d,omitempty"`
	BytesChange30d     *int64     `json:"bytes_change_30d,omitempty"`
	FilesChange30d     *int64     `json:"files_change_30d,omitempty"`
	BytesGrowthRate7d  *string    `json:"bytes_growth_rate_7d,omitempty"`
	BytesGrowthRate30d *string    `json:"bytes_growth_rate_30d,omitempty"`
	ComputedAt         time.Time  `json:"computed_at"`
}

// StatsJob represents a stats computation job
type StatsJob struct {
	ID             int64      `json:"id"`
	JobType        string     `json:"job_type"`
	VolumeID       *string    `json:"volume_id,omitempty"`
	StartedAt      time.Time  `json:"started_at"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	DurationMs     *int64     `json:"duration_ms,omitempty"`
	Status         string     `json:"status"`
	ErrorMessage   *string    `json:"error_message,omitempty"`
	ProcessedDates *int32     `json:"processed_dates,omitempty"`
	RecordsCreated *int32     `json:"records_created,omitempty"`
	RecordsUpdated *int32     `json:"records_updated,omitempty"`
}

// UpdateStatsJobParams parameters for updating job status
type UpdateStatsJobParams struct {
	ID             int64      `json:"id"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	DurationMs     *int64     `json:"duration_ms,omitempty"`
	Status         string     `json:"status"`
	ErrorMessage   *string    `json:"error_message,omitempty"`
	ProcessedDates *int32     `json:"processed_dates,omitempty"`
	RecordsCreated *int32     `json:"records_created,omitempty"`
	RecordsUpdated *int32     `json:"records_updated,omitempty"`
}

// JobMetrics represents aggregated job performance metrics
type JobMetrics struct {
	TotalJobs       int64      `json:"total_jobs"`
	SuccessfulJobs  int64      `json:"successful_jobs"`
	FailedJobs      int64      `json:"failed_jobs"`
	AvgDurationMs   *string    `json:"avg_duration_ms,omitempty"`
	LastJobStarted  *time.Time `json:"last_job_started,omitempty"`
	LastSuccess     *time.Time `json:"last_success,omitempty"`
}

// StatsRequest represents a request for computing stats
type StatsRequest struct {
	VolumeID  string     `json:"volume_id"`
	Date      time.Time  `json:"date"`
	ScanID    *string    `json:"scan_id,omitempty"`
	JobType   string     `json:"job_type"`
	StartTime time.Time  `json:"start_time"`
}

// StatsResponse represents the response from stats computation
type StatsResponse struct {
	Success        bool          `json:"success"`
	JobID          int64         `json:"job_id"`
	ProcessedDates int32         `json:"processed_dates"`
	RecordsCreated int32         `json:"records_created"`
	RecordsUpdated int32         `json:"records_updated"`
	Duration       time.Duration `json:"duration"`
	Error          *string       `json:"error,omitempty"`
}

// StatsSummary provides high-level volume statistics
type StatsSummary struct {
	VolumeID              string    `json:"volume_id"`
	LatestDate            time.Time `json:"latest_date"`
	TotalFiles            int64     `json:"total_files"`
	TotalBytes            int64     `json:"total_bytes"`
	FilesAdded7d          int64     `json:"files_added_7d"`
	BytesAdded7d          int64     `json:"bytes_added_7d"`
	FilesAdded30d         int64     `json:"files_added_30d"`
	BytesAdded30d         int64     `json:"bytes_added_30d"`
	GrowthRate7d          *float64  `json:"growth_rate_7d,omitempty"`
	GrowthRate30d         *float64  `json:"growth_rate_30d,omitempty"`
	TopMediaKind          *string   `json:"top_media_kind,omitempty"`
	TopMediaKindBytes     int64     `json:"top_media_kind_bytes"`
	TopMediaKindPercent   *float64  `json:"top_media_kind_percent,omitempty"`
	ActiveFolders         int64     `json:"active_folders"`
	LastComputedAt        time.Time `json:"last_computed_at"`
}

// FolderSizeInfo represents folder size statistics
type FolderSizeInfo struct {
	ID                      int64  `json:"id"`
	Name                    string `json:"name"`
	Path                    string `json:"path"`
	SizeBytesRecursive      int64  `json:"size_bytes_recursive"`
	DiskUsageBytesRecursive int64  `json:"disk_usage_bytes_recursive"`
	FileCount               int64  `json:"file_count"`
	DirCount                int64  `json:"dir_count"`
}