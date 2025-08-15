package models

// ScanStartRequest represents a request to start scanning a volume
type ScanStartRequest struct {
	VolumeID string      `json:"volume_id" example:"tv-shows-readonly" binding:"required"`
	FullScan bool        `json:"full_scan" example:"false"`
	Options  ScanOptions `json:"options,omitempty"`
} // @name ScanStartRequest

// ScanOptions represents scanning configuration options
type ScanOptions struct {
	IncludeHidden    bool     `json:"include_hidden" example:"false"`
	MaxDepth         int      `json:"max_depth,omitempty" example:"10"`
	ExcludePatterns  []string `json:"exclude_patterns,omitempty" example:"*.tmp,*.log"`
	IncludePatterns  []string `json:"include_patterns,omitempty" example:"*.mp4,*.mkv"`
	EnableMetadata   bool     `json:"enable_metadata" example:"true"`
	EnableThumbnails bool     `json:"enable_thumbnails" example:"false"`
} // @name ScanOptions

// FilesystemIndexingResponse represents filesystem indexing status
type FilesystemIndexingResponse struct {
	VolumeID       string  `json:"volume_id" example:"tv-shows"`
	Status         string  `json:"status" example:"running" enums:"pending,running,completed,failed"`
	Message        string  `json:"message,omitempty" example:"Indexing in progress"`
	StartedAt      *string `json:"started_at,omitempty" example:"2023-01-01T10:00:00Z"`
	LastUpdate     *string `json:"last_update,omitempty" example:"2023-01-01T10:30:00Z"`
	FoldersScanned int64   `json:"folders_scanned,omitempty" example:"150"`
	FilesScanned   int64   `json:"files_scanned,omitempty" example:"2500"`
	BytesProcessed int64   `json:"bytes_processed,omitempty" example:"1073741824"`
	ErrorsCount    int     `json:"errors_count,omitempty" example:"2"`
	CurrentPath    string  `json:"current_path,omitempty" example:"/data/movies/action"`
	CurrentDepth   int     `json:"current_depth,omitempty" example:"3"`
	FoldersPerSec  float64 `json:"folders_per_sec,omitempty" example:"10.5"`
	FilesPerSec    float64 `json:"files_per_sec,omitempty" example:"150.2"`
	LastError      string  `json:"last_error,omitempty" example:"Permission denied on /data/restricted"`
} // @name FilesystemIndexingResponse

// FilesystemIndexingRequest represents filesystem indexing request options
type FilesystemIndexingRequest struct {
	DeltaMode bool `json:"delta_mode" example:"false"`
	FullScan  bool `json:"full_scan" example:"true"`
} // @name FilesystemIndexingRequest

// FilesystemCapabilitiesResponse represents filesystem indexing capabilities
type FilesystemCapabilitiesResponse struct {
	Enabled                 bool            `json:"enabled" example:"true"`
	Features                map[string]bool `json:"features"`
	SupportedHashAlgorithms []string        `json:"supported_hash_algorithms,omitempty" example:"sha256,md5"`
	SupportedMediaKinds     []string        `json:"supported_media_kinds,omitempty" example:"image,video,audio"`
} // @name FilesystemCapabilitiesResponse

// MediaEnrichmentResponse represents media enrichment status
type MediaEnrichmentResponse struct {
	VolumeID       string  `json:"volume_id" example:"tv-shows"`
	Status         string  `json:"status" example:"running" enums:"pending,running,completed,failed"`
	Message        string  `json:"message,omitempty" example:"Enriching media files"`
	StartedAt      *string `json:"started_at,omitempty" example:"2023-01-01T10:00:00Z"`
	LastUpdate     *string `json:"last_update,omitempty" example:"2023-01-01T10:30:00Z"`
	FilesProcessed int64   `json:"files_processed,omitempty" example:"450"`
	TotalFiles     int64   `json:"total_files,omitempty" example:"1000"`
	ErrorsCount    int     `json:"errors_count,omitempty" example:"5"`
	CurrentFile    string  `json:"current_file,omitempty" example:"/data/movies/action/movie.mp4"`
	FilesPerSec    float64 `json:"files_per_sec,omitempty" example:"25.5"`
	LastError      string  `json:"last_error,omitempty" example:"Unsupported codec in file"`
} // @name MediaEnrichmentResponse

// MediaEnrichmentStatusResponse represents the status of media enrichment
type MediaEnrichmentStatusResponse struct {
	VolumeID       string  `json:"volume_id" example:"tv-shows"`
	Status         string  `json:"status" example:"completed" enums:"pending,running,completed,failed"`
	Progress       float64 `json:"progress" example:"85.5"`
	FilesProcessed int64   `json:"files_processed" example:"855"`
	TotalFiles     int64   `json:"total_files" example:"1000"`
	StartedAt      *string `json:"started_at,omitempty" example:"2023-01-01T10:00:00Z"`
	LastUpdate     *string `json:"last_update,omitempty" example:"2023-01-01T11:30:00Z"`
	ErrorsCount    int     `json:"errors_count,omitempty" example:"12"`
	Message        string  `json:"message,omitempty" example:"Enrichment completed with minor errors"`
} // @name MediaEnrichmentStatusResponse

// MediaCapabilitiesResponse represents media enrichment capabilities
type MediaCapabilitiesResponse struct {
	Enabled            bool     `json:"enabled" example:"true"`
	SupportedFormats   []string `json:"supported_formats,omitempty" example:"mp4,avi,mkv,jpg,png"`
	SupportedKinds     []string `json:"supported_kinds,omitempty" example:"video,image,audio"`
	MaxFileSize        int64    `json:"max_file_size,omitempty" example:"10737418240"`
	ThumbnailSupported bool     `json:"thumbnail_supported" example:"true"`
	MetadataSupported  bool     `json:"metadata_supported" example:"true"`
} // @name MediaCapabilitiesResponse
