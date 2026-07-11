package models

import "time"

// DailyStatV1 is one day's aggregate stats for a volume
type DailyStatV1 struct {
	Date               string `json:"date" example:"2026-07-10"`
	TotalBytes         int64  `json:"total_bytes" example:"10737418240"`
	FilesCount         int64  `json:"files_count" example:"4213"`
	AddedBytes         int64  `json:"added_bytes" example:"52428800"`
	RemovedBytes       int64  `json:"removed_bytes" example:"1048576"`
	AddedFiles         int64  `json:"added_files" example:"12"`
	RemovedFiles       int64  `json:"removed_files" example:"1"`
	DiskTotalBytes     *int64 `json:"disk_total_bytes,omitempty" example:"1000204886016"`
	DiskAvailableBytes *int64 `json:"disk_available_bytes,omitempty" example:"114419344240"`
} // @name DailyStatV1

// MediaKindCompositionV1 is the file-type breakdown for a volume over a period
type MediaKindCompositionV1 struct {
	MediaKind       *string `json:"media_kind" example:"video"`
	Date            string  `json:"date" example:"2026-07-10"`
	FilesCount      int64   `json:"files_count" example:"812"`
	TotalBytes      int64   `json:"total_bytes" example:"8589934592"`
	PercentOfVolume *string `json:"percent_of_volume,omitempty" example:"42.5"`
} // @name MediaKindCompositionV1

// TrendAnalysisV1 is a single day's trend analysis with growth calculations
type TrendAnalysisV1 struct {
	Date               string  `json:"date" example:"2026-07-10"`
	FilesCount         int64   `json:"files_count" example:"4213"`
	TotalBytes         int64   `json:"total_bytes" example:"10737418240"`
	BytesChange7d      *int64  `json:"bytes_change_7d,omitempty" example:"104857600"`
	FilesChange7d      *int64  `json:"files_change_7d,omitempty" example:"12"`
	BytesChange30d     *int64  `json:"bytes_change_30d,omitempty" example:"524288000"`
	FilesChange30d     *int64  `json:"files_change_30d,omitempty" example:"64"`
	BytesGrowthRate7d  *string `json:"bytes_growth_rate_7d,omitempty" example:"1.2"`
	BytesGrowthRate30d *string `json:"bytes_growth_rate_30d,omitempty" example:"5.4"`
} // @name TrendAnalysisV1

// TopGrowingFolderV1 is a folder with high growth in the analyzed period
type TopGrowingFolderV1 struct {
	FolderID           *int64  `json:"folder_id"`
	FolderName         string  `json:"folder_name" example:"movies"`
	FolderPath         string  `json:"folder_path" example:"/data/movies"`
	TotalAddedBytes    int64   `json:"total_added_bytes" example:"5368709120"`
	TotalAddedFiles    int64   `json:"total_added_files" example:"8"`
	AvgDailyAddedBytes *string `json:"avg_daily_added_bytes,omitempty"`
	DaysTracked        int64   `json:"days_tracked" example:"30"`
} // @name TopGrowingFolderV1

// CapacityForecastPointV1 is one projected day in a capacity forecast series
type CapacityForecastPointV1 struct {
	Date               time.Time `json:"date"`
	ProjectedSizeBytes int64     `json:"projected_size_bytes" example:"12884901888"`
} // @name CapacityForecastPointV1

// CapacityForecastV1 projects a volume's growth forward against its most
// recently observed host disk free space. DaysUntilCapacity and
// DiskAvailableBytes are omitted when no scan has yet captured disk capacity
// for this volume; DaysUntilCapacity is null when growth is flat or negative
// (no meaningful exhaustion date exists).
type CapacityForecastV1 struct {
	DailyGrowthBytes   float64                   `json:"daily_growth_bytes" example:"104857600"`
	CurrentSizeBytes   int64                     `json:"current_size_bytes" example:"10737418240"`
	Series             []CapacityForecastPointV1 `json:"series"`
	DiskAvailableBytes *int64                    `json:"disk_available_bytes,omitempty" example:"114419344240"`
	DaysUntilCapacity  *int                      `json:"days_until_capacity,omitempty" example:"42"`
} // @name CapacityForecastV1

// TrendsSummaryStatsV1 is the current-value + growth summary for a volume
type TrendsSummaryStatsV1 struct {
	CurrentSize         int64   `json:"current_size" example:"10737418240"`
	CurrentFiles        int64   `json:"current_files" example:"4213"`
	TotalGrowthBytes    int64   `json:"total_growth_bytes" example:"1073741824"`
	TotalGrowthFiles    int64   `json:"total_growth_files" example:"120"`
	AvgDailyGrowthBytes float64 `json:"avg_daily_growth_bytes" example:"35791394.13"`
	AvgDailyGrowthFiles float64 `json:"avg_daily_growth_files" example:"4.0"`
} // @name TrendsSummaryStatsV1

// VolumeTrendsDataV1 is the response body for GET /api/v1/trends/volumes/{volumeId}
type VolumeTrendsDataV1 struct {
	VolumeID          string                   `json:"volume_id" example:"a1b2c3d4"`
	Aggregation       string                   `json:"aggregation" example:"day" enums:"day,week,month"`
	Period            TrendsPeriodV1           `json:"period"`
	GeneratedAt       time.Time                `json:"generated_at"`
	Summary           TrendsSummaryStatsV1     `json:"summary"`
	DailyStats        []DailyStatV1            `json:"daily_stats"`
	TrendAnalysis     []TrendAnalysisV1        `json:"trend_analysis,omitempty"`
	MediaComposition  []MediaKindCompositionV1 `json:"media_composition,omitempty"`
	TopGrowingFolders []TopGrowingFolderV1     `json:"top_growing_folders,omitempty"`
	CapacityForecast  *CapacityForecastV1      `json:"capacity_forecast,omitempty"`
} // @name VolumeTrendsDataV1

// VolumeTrendsSummaryEntryV1 is one volume's contribution to the all-volumes
// trends summary
type VolumeTrendsSummaryEntryV1 struct {
	VolumeID   string                     `json:"volume_id" example:"a1b2c3d4"`
	Statistics VolumeTrendsSummaryStatsV1 `json:"statistics"`
	DataPoints []VolumeTrendsDataPointV1  `json:"data_points"`
} // @name VolumeTrendsSummaryEntryV1

// VolumeTrendsSummaryStatsV1 is one volume's growth stats within the
// all-volumes trends summary
type VolumeTrendsSummaryStatsV1 struct {
	TotalGrowth       int64   `json:"total_growth" example:"1073741824"`
	GrowthRatePercent float64 `json:"growth_rate_percent" example:"5.2"`
	CurrentSize       int64   `json:"current_size" example:"10737418240"`
} // @name VolumeTrendsSummaryStatsV1

// VolumeTrendsDataPointV1 is one day's data point within the all-volumes
// trends summary
type VolumeTrendsDataPointV1 struct {
	Date      string `json:"date" example:"2026-07-10"`
	TotalSize int64  `json:"total_size" example:"10737418240"`
	FileCount int64  `json:"file_count" example:"4213"`
} // @name VolumeTrendsDataPointV1

// AllVolumesTrendsSummaryV1 is the response body for GET /api/v1/trends/summary
type AllVolumesTrendsSummaryV1 struct {
	TotalVolumesTracked int                          `json:"total_volumes_tracked" example:"12"`
	VolumesWithGrowth   int                          `json:"volumes_with_growth" example:"9"`
	VolumesWithDecline  int                          `json:"volumes_with_decline" example:"1"`
	AverageGrowthRate   float64                      `json:"average_growth_rate" example:"4.8"`
	TotalStorageGrowth  int64                        `json:"total_storage_growth" example:"12884901888"`
	Volumes             []VolumeTrendsSummaryEntryV1 `json:"volumes"`
	Period              TrendsPeriodV1               `json:"period"`
	GeneratedAt         time.Time                    `json:"generated_at"`
} // @name AllVolumesTrendsSummaryV1

// TrendsPeriodV1 describes the date range a trends response covers
type TrendsPeriodV1 struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
	Days  int       `json:"days" example:"30"`
} // @name TrendsPeriodV1
