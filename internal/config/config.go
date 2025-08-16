package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	storeconfig "github.com/mantonx/volumeviz/internal/store/config"
)

// Config holds application configuration
type Config struct {
	Server             ServerConfig
	Docker             DockerConfig
	Database           DatabaseConfig
	CORS               CORSConfig
	Auth               AuthConfig
	Security           SecurityConfig
	RateLimit          RateLimitConfig
	TLS                TLSConfig
	Lifecycle          LifecycleConfig
	Events             EventsConfig
	Scan               ScanConfig
	FilesystemIndexing FilesystemIndexingConfig
	MediaEnrichment    MediaEnrichmentConfig
	Alerts             AlertsConfig
}

// ServerConfig holds server-specific configuration
type ServerConfig struct {
	Host string
	Port string
	Mode string
}

// DockerConfig holds Docker-specific configuration
type DockerConfig struct {
	Host    string
	Timeout time.Duration
}

// DatabaseConfig holds database connection configuration
type DatabaseConfig struct {
	Type     string // "postgres" or "sqlite"
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
	Path     string // SQLite database file path
}

// CORSConfig holds CORS-specific configuration
type CORSConfig struct {
	AllowedOrigins []string
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	Enabled bool
	Secret  string
}

// SecurityConfig holds security headers configuration
type SecurityConfig struct {
	HideServerHeader      bool
	EnableHSTS            bool
	HSSTMaxAge            int
	ContentTypeOptions    string
	FrameOptions          string
	ReferrerPolicy        string
	ContentSecurityPolicy string
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	Enabled bool
	RPM     int
	Burst   int
}

// TLSConfig holds TLS/HTTPS configuration
type TLSConfig struct {
	Enabled  bool
	CertFile string
	KeyFile  string
}

// LifecycleConfig controls data retention and rollups
type LifecycleConfig struct {
	Enabled        bool
	MetricsTTLDays int
	SizesTTLDays   int
	RollupEnabled  bool
	Interval       time.Duration
	InitialDelay   time.Duration
}

// EventsConfig holds Docker events integration configuration
type EventsConfig struct {
	Enabled            bool
	QueueSize          int
	BackoffMinDuration time.Duration
	BackoffMaxDuration time.Duration
	ReconcileInterval  time.Duration
}

// ScanConfig holds scan scheduler configuration
type ScanConfig struct {
	Enabled           bool
	Interval          time.Duration
	Concurrency       int
	MaxPerVolume      int // VV_SCAN_MAX_PER_VOLUME (always 1 for this ticket)
	TimeoutPerVolume  time.Duration
	MethodsOrder      []string
	BindMountsEnabled bool
	BindAllowList     []string
	SkipPattern       string
}

// FilesystemIndexingConfig holds filesystem indexing configuration
type FilesystemIndexingConfig struct {
	// Enable/disable filesystem indexing
	Enabled bool `env:"VV_FILESYSTEM_INDEXING_ENABLED" envDefault:"false"`

	// Hashing configuration
	EnableHashing       bool   `env:"VV_ENABLE_HASHING" envDefault:"false"`
	MaxFileBytesForHash int64  `env:"VV_MAX_FILE_BYTES_FOR_HASH" envDefault:"10485760"` // 10MB
	HashAlgorithm       string `env:"VV_HASH_ALGO" envDefault:"sha256"`

	// Skip rules
	SkipPatterns []string `env:"VV_SKIP_PATTERNS" envSeparator:","`
	SkipHidden   bool     `env:"VV_SKIP_HIDDEN" envDefault:"true"`

	// Performance settings
	MaxDepth        int `env:"VV_MAX_DEPTH" envDefault:"20"`
	ConcurrentReads int `env:"VV_CONCURRENT_READS" envDefault:"5"`
	BatchSize       int `env:"VV_BATCH_SIZE" envDefault:"1000"`

	// Metadata collection
	CollectExtendedAttributes bool `env:"VV_COLLECT_EXTENDED_ATTRS" envDefault:"false"`
	DetectMimeTypes           bool `env:"VV_DETECT_MIME_TYPES" envDefault:"true"`
}

// MediaEnrichmentConfig holds media metadata enrichment configuration
type MediaEnrichmentConfig struct {
	// Global settings
	Enabled              bool          `env:"VV_ENABLE_ENRICHERS" envDefault:"true"`
	MaxConcurrentWorkers int           `env:"VV_MAX_CONCURRENT_ENRICHERS" envDefault:"3"`
	TimeoutPerFile       time.Duration `env:"VV_ENRICHER_TIMEOUT_PER_FILE" envDefault:"30s"`

	// FFprobe settings
	FFprobeEnabled bool          `env:"VV_ENABLE_FFPROBE" envDefault:"true"`
	FFprobePath    string        `env:"VV_FFPROBE_PATH" envDefault:"ffprobe"`
	FFprobeTimeout time.Duration `env:"VV_FFPROBE_TIMEOUT" envDefault:"15s"`

	// EXIF settings
	EXIFEnabled  bool `env:"VV_ENABLE_EXIF" envDefault:"true"`
	EnableGPS    bool `env:"VV_ENABLE_EXIF_GPS" envDefault:"false"`
	RedactGPS    bool `env:"VV_REDACT_GPS" envDefault:"true"`
	GPSPrecision int  `env:"VV_GPS_PRECISION" envDefault:"3"` // decimal places for GPS coordinates

	// Subtitle settings
	SubtitleEnabled bool `env:"VV_ENABLE_SUBTITLE_ENRICHMENT" envDefault:"true"`
}

// AlertsConfig holds alerts engine configuration
type AlertsConfig struct {
	Enabled                   bool `env:"ALERTS_ENABLED" envDefault:"false"`
	EvaluationIntervalMinutes int  `env:"ALERTS_EVALUATION_INTERVAL_MINUTES" envDefault:"1"`
	DeliveryWorkers           int  `env:"ALERTS_DELIVERY_WORKERS" envDefault:"3"`
}

// Load loads configuration from environment variables with defaults
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
			Port: getEnv("SERVER_PORT", "8080"),
			Mode: getEnv("GIN_MODE", "release"),
		},
		Docker: DockerConfig{
			Host:    getEnv("DOCKER_HOST", ""),
			Timeout: getDurationEnv("DOCKER_TIMEOUT", 30*time.Second),
		},
		Database: DatabaseConfig{
			Type:     getEnv("DB_TYPE", "postgres"),
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "volumeviz"),
			Password: getEnv("DB_PASSWORD", "volumeviz"),
			Name:     getEnv("DB_NAME", "volumeviz"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
			Path:     getEnv("DB_PATH", "./volumeviz.db"),
		},
		CORS: CORSConfig{
			AllowedOrigins: getStringSliceEnv("ALLOW_ORIGINS", []string{"http://localhost:3000"}),
		},
		Auth: AuthConfig{
			Enabled: getBoolEnv("AUTH_ENABLED", false),
			Secret:  getEnv("AUTH_HS256_SECRET", ""),
		},
		Security: SecurityConfig{
			HideServerHeader:      getBoolEnv("SECURITY_HIDE_SERVER", true),
			EnableHSTS:            getBoolEnv("SECURITY_ENABLE_HSTS", false),
			HSSTMaxAge:            getIntEnv("SECURITY_HSTS_MAX_AGE", 31536000), // 1 year
			ContentTypeOptions:    getEnv("SECURITY_CONTENT_TYPE_OPTIONS", "nosniff"),
			FrameOptions:          getEnv("SECURITY_FRAME_OPTIONS", "SAMEORIGIN"),
			ReferrerPolicy:        getEnv("SECURITY_REFERRER_POLICY", "no-referrer"),
			ContentSecurityPolicy: getEnv("SECURITY_CSP", "default-src 'none'; frame-ancestors 'self';"),
		},
		RateLimit: RateLimitConfig{
			Enabled: getBoolEnv("RATE_LIMIT_ENABLED", true),
			RPM:     getIntEnv("RATE_LIMIT_RPM", 60),
			Burst:   getIntEnv("RATE_LIMIT_BURST", 30),
		},
		TLS: func() TLSConfig {
			certFile := getEnv("TLS_CERT_FILE", "")
			keyFile := getEnv("TLS_KEY_FILE", "")
			enabled := certFile != "" && keyFile != ""
			return TLSConfig{
				Enabled:  enabled,
				CertFile: certFile,
				KeyFile:  keyFile,
			}
		}(),
		Lifecycle: LifecycleConfig{
			Enabled:        getBoolEnv("LIFECYCLE_ENABLED", true),
			MetricsTTLDays: getIntEnv("VOLUME_METRICS_TTL_DAYS", 90),
			SizesTTLDays:   getIntEnv("VOLUME_SIZES_TTL_DAYS", 90),
			RollupEnabled:  getBoolEnv("VOLUME_ROLLUP_ENABLED", true),
			Interval:       getDurationEnv("LIFECYCLE_INTERVAL", time.Hour),
			InitialDelay:   getDurationEnv("LIFECYCLE_INITIAL_DELAY", 30*time.Second),
		},
		Events: EventsConfig{
			Enabled:            getBoolEnv("EVENTS_ENABLED", true),
			QueueSize:          getIntEnv("EVENTS_QUEUE_SIZE", 1000),
			BackoffMinDuration: getDurationEnv("EVENTS_BACKOFF_MIN", 1*time.Second),
			BackoffMaxDuration: getDurationEnv("EVENTS_BACKOFF_MAX", 30*time.Second),
			ReconcileInterval:  getDurationEnv("EVENTS_RECONCILE_INTERVAL", 6*time.Hour),
		},
		Scan: ScanConfig{
			Enabled:           getScanEnabledDefault(),
			Interval:          getDurationEnv("SCAN_INTERVAL", 6*time.Hour),
			Concurrency:       getIntEnv("VV_SCAN_MAX_CONCURRENCY", 2),
			MaxPerVolume:      getIntEnv("VV_SCAN_MAX_PER_VOLUME", 1),
			TimeoutPerVolume:  getDurationEnv("SCAN_TIMEOUT_PER_VOLUME", 2*time.Minute),
			MethodsOrder:      getStringSliceEnv("SCAN_METHODS_ORDER", []string{"diskus", "du", "native"}),
			BindMountsEnabled: getBoolEnv("SCAN_BIND_MOUNTS_ENABLED", false),
			BindAllowList:     getStringSliceEnv("SCAN_BIND_ALLOWLIST", []string{}),
			SkipPattern:       getEnv("SCAN_SKIP_PATTERN", "^docker_|^builder_|^containerd"),
		},
		FilesystemIndexing: FilesystemIndexingConfig{
			Enabled:                   true, // Always enabled - users expect files to be indexed
			EnableHashing:             getBoolEnv("VV_ENABLE_HASHING", false),
			MaxFileBytesForHash:       getInt64Env("VV_MAX_FILE_BYTES_FOR_HASH", 10485760), // 10MB
			HashAlgorithm:             getEnv("VV_HASH_ALGO", "sha256"),
			SkipPatterns:              getStringSliceEnv("VV_SKIP_PATTERNS", []string{`\.git`, `\.tmp$`, `node_modules`}),
			SkipHidden:                getBoolEnv("VV_SKIP_HIDDEN", true),
			MaxDepth:                  getIntEnv("VV_MAX_DEPTH", 20),
			ConcurrentReads:           getIntEnv("VV_CONCURRENT_READS", 5),
			BatchSize:                 getIntEnv("VV_BATCH_SIZE", 1000),
			CollectExtendedAttributes: getBoolEnv("VV_COLLECT_EXTENDED_ATTRS", false),
			DetectMimeTypes:           getBoolEnv("VV_DETECT_MIME_TYPES", true),
		},
		MediaEnrichment: MediaEnrichmentConfig{
			Enabled:              getBoolEnv("VV_ENABLE_ENRICHERS", true),
			MaxConcurrentWorkers: getIntEnv("VV_MAX_CONCURRENT_ENRICHERS", 3),
			TimeoutPerFile:       getDurationEnv("VV_ENRICHER_TIMEOUT_PER_FILE", 30*time.Second),
			FFprobeEnabled:       getBoolEnv("VV_ENABLE_FFPROBE", true),
			FFprobePath:          getEnv("VV_FFPROBE_PATH", "ffprobe"),
			FFprobeTimeout:       getDurationEnv("VV_FFPROBE_TIMEOUT", 15*time.Second),
			EXIFEnabled:          getBoolEnv("VV_ENABLE_EXIF", true),
			EnableGPS:            getBoolEnv("VV_ENABLE_EXIF_GPS", false),
			RedactGPS:            getBoolEnv("VV_REDACT_GPS", true),
			GPSPrecision:         getIntEnv("VV_GPS_PRECISION", 3),
			SubtitleEnabled:      getBoolEnv("VV_ENABLE_SUBTITLE_ENRICHMENT", true),
		},
		Alerts: AlertsConfig{
			Enabled:                   getBoolEnv("ALERTS_ENABLED", false),
			EvaluationIntervalMinutes: getIntEnv("ALERTS_EVALUATION_INTERVAL_MINUTES", 1),
			DeliveryWorkers:           getIntEnv("ALERTS_DELIVERY_WORKERS", 3),
		},
	}
}

// getEnv gets environment variable with default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getDurationEnv gets duration environment variable with default value
func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
		// Try parsing as seconds if duration parsing fails
		if seconds, err := strconv.Atoi(value); err == nil {
			return time.Duration(seconds) * time.Second
		}
	}
	return defaultValue
}

// getStringSliceEnv gets comma-separated string environment variable as slice with default value
func getStringSliceEnv(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}

// getBoolEnv gets boolean environment variable with default value
func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

// getIntEnv gets integer environment variable with default value
func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

// getInt64Env gets int64 environment variable with default value
func getInt64Env(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseInt(value, 10, 64); err == nil {
			return parsed
		}
	}
	return defaultValue
}

// getScanEnabledDefault returns the default value for scan enabled based on environment
func getScanEnabledDefault() bool {
	// Check for explicit setting first
	if value := os.Getenv("SCAN_ENABLED"); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}

	// Default: always enabled - volumes should be automatically scanned
	return true
}

// ToStoreConfig converts the config.DatabaseConfig to store config.Config
func (dc *DatabaseConfig) ToStoreConfig() *storeconfig.Config {
	var dbType storeconfig.DatabaseType
	switch dc.Type {
	case "sqlite":
		dbType = storeconfig.DatabaseTypeSQLite
	case "postgres", "postgresql":
		dbType = storeconfig.DatabaseTypePostgreSQL
	default:
		dbType = storeconfig.DatabaseTypePostgreSQL // Default to PostgreSQL
	}

	// Convert port string to int
	port := 5432
	if portInt, err := strconv.Atoi(dc.Port); err == nil {
		port = portInt
	}

	return &storeconfig.Config{
		Type:         dbType,
		Host:         dc.Host,
		Port:         port,
		User:         dc.User,
		Password:     dc.Password,
		Database:     dc.Name,
		SSLMode:      dc.SSLMode,
		Path:         dc.Path,
		MaxOpenConns: 25,
		MaxIdleConns: 10,
		ConnMaxLife:  30 * time.Minute,
		Timeout:      30 * time.Second,
	}
}

// ToIndexerConfig converts FilesystemIndexingConfig to services.IndexerConfig
func (fic *FilesystemIndexingConfig) ToIndexerConfig() interface{} {
	// Note: This would need to import the services package, but that would create a circular dependency.
	// Instead, this method is just for documentation. The actual conversion would be done in the main app.
	return map[string]interface{}{
		"enable_hashing":              fic.EnableHashing,
		"max_file_bytes_for_hash":     fic.MaxFileBytesForHash,
		"hash_algorithm":              fic.HashAlgorithm,
		"skip_patterns":               fic.SkipPatterns,
		"skip_hidden":                 fic.SkipHidden,
		"max_depth":                   fic.MaxDepth,
		"concurrent_reads":            fic.ConcurrentReads,
		"batch_size":                  fic.BatchSize,
		"collect_extended_attributes": fic.CollectExtendedAttributes,
		"detect_mime_types":           fic.DetectMimeTypes,
	}
}

// ToEnricherConfig converts MediaEnrichmentConfig to enrichers.EnricherConfig
func (mec *MediaEnrichmentConfig) ToEnricherConfig() interface{} {
	// Note: This would need to import the enrichers package, but that would create a circular dependency.
	// Instead, this method is just for documentation. The actual conversion would be done in the main app.
	return map[string]interface{}{
		"enabled":                mec.Enabled,
		"max_concurrent_workers": mec.MaxConcurrentWorkers,
		"timeout_per_file":       mec.TimeoutPerFile,
		"ffprobe_enabled":        mec.FFprobeEnabled,
		"ffprobe_path":           mec.FFprobePath,
		"ffprobe_timeout":        mec.FFprobeTimeout,
		"exif_enabled":           mec.EXIFEnabled,
		"enable_gps":             mec.EnableGPS,
		"redact_gps":             mec.RedactGPS,
		"gps_precision":          mec.GPSPrecision,
		"subtitle_enabled":       mec.SubtitleEnabled,
	}
}
