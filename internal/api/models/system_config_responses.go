package models

// SystemConfigResponse is the response body for GET /api/v1/system/config.
// It surfaces the process's real, currently-active configuration for
// operator visibility - every value here is read once from the environment
// at process startup, so none of it is editable from the running app;
// changing any of it means setting the corresponding env var and restarting.
type SystemConfigResponse struct {
	Server    SystemConfigServer    `json:"server"`
	Auth      SystemConfigAuth      `json:"auth"`
	RateLimit SystemConfigRateLimit `json:"rate_limit"`
	CORS      SystemConfigCORS      `json:"cors"`
	Scan      SystemConfigScan      `json:"scan"`
	Retention SystemConfigRetention `json:"retention"`
	Alerts    SystemConfigAlerts    `json:"alerts"`
} // @name SystemConfigResponse

type SystemConfigServer struct {
	Mode         string `json:"mode" example:"release"`
	DatabaseType string `json:"database_type" example:"postgres"`
} // @name SystemConfigServer

type SystemConfigAuth struct {
	Enabled bool `json:"enabled" example:"true"`
} // @name SystemConfigAuth

type SystemConfigRateLimit struct {
	Enabled bool `json:"enabled" example:"true"`
	RPM     int  `json:"requests_per_minute" example:"60"`
	Burst   int  `json:"burst" example:"30"`
} // @name SystemConfigRateLimit

type SystemConfigCORS struct {
	AllowedOrigins []string `json:"allowed_origins" example:"http://localhost:3000"`
} // @name SystemConfigCORS

type SystemConfigScan struct {
	Enabled           bool `json:"enabled" example:"true"`
	IntervalSeconds   int  `json:"interval_seconds" example:"21600"`
	Concurrency       int  `json:"concurrency" example:"3"`
	BindMountsEnabled bool `json:"bind_mounts_enabled" example:"false"`
} // @name SystemConfigScan

type SystemConfigRetention struct {
	Enabled                    bool `json:"enabled" example:"true"`
	ScanJobsRetentionDays      int  `json:"scan_jobs_days" example:"30"`
	ScanMetricsRetentionDays   int  `json:"scan_metrics_days" example:"90"`
	ScanPhasesRetentionDays    int  `json:"scan_phases_days" example:"7"`
	FileMetadataRetentionDays  int  `json:"file_metadata_days" example:"180"`
	InactiveFilesRetentionDays int  `json:"inactive_files_days" example:"60"`
} // @name SystemConfigRetention

type SystemConfigAlerts struct {
	Enabled                   bool `json:"enabled" example:"false"`
	EvaluationIntervalMinutes int  `json:"evaluation_interval_minutes" example:"1"`
} // @name SystemConfigAlerts
