package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/database"
)

// Config holds application configuration
type Config struct {
	Server    ServerConfig
	Docker    DockerConfig
	Database  DatabaseConfig
	CORS      CORSConfig
	Auth      AuthConfig
	Security  SecurityConfig
	RateLimit RateLimitConfig
	TLS       TLSConfig
	Lifecycle LifecycleConfig
	Events    EventsConfig
	Scan      ScanConfig
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
	Enabled              bool
	Interval             time.Duration
	Concurrency          int
	TimeoutPerVolume     time.Duration
	MethodsOrder         []string
	BindMountsEnabled    bool
	BindAllowList        []string
	SkipPattern          string
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
			Enabled:              getScanEnabledDefault(),
			Interval:             getDurationEnv("SCAN_INTERVAL", 6*time.Hour),
			Concurrency:          getIntEnv("SCAN_CONCURRENCY", 2),
			TimeoutPerVolume:     getDurationEnv("SCAN_TIMEOUT_PER_VOLUME", 2*time.Minute),
			MethodsOrder:         getStringSliceEnv("SCAN_METHODS_ORDER", []string{"diskus", "du", "native"}),
			BindMountsEnabled:    getBoolEnv("SCAN_BIND_MOUNTS_ENABLED", false),
			BindAllowList:        getStringSliceEnv("SCAN_BIND_ALLOWLIST", []string{}),
			SkipPattern:          getEnv("SCAN_SKIP_PATTERN", "^docker_|^builder_|^containerd"),
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

// getScanEnabledDefault returns the default value for scan enabled based on environment
func getScanEnabledDefault() bool {
	// Check for explicit setting first
	if value := os.Getenv("SCAN_ENABLED"); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	
	// Default based on environment: true in dev/debug, false in production
	ginMode := getEnv("GIN_MODE", "release")
	isDev := ginMode == "debug" || ginMode == "test" || os.Getenv("NODE_ENV") == "development"
	return isDev
}

// ToDatabaseConfig converts the config.DatabaseConfig to database.Config
func (dc *DatabaseConfig) ToDatabaseConfig() *database.Config {
	var dbType database.DatabaseType
	switch dc.Type {
	case "sqlite":
		dbType = database.DatabaseTypeSQLite
	case "postgres", "postgresql":
		dbType = database.DatabaseTypePostgreSQL
	default:
		dbType = database.DatabaseTypePostgreSQL // Default to PostgreSQL
	}

	// Convert port string to int
	port := 5432
	if portInt, err := strconv.Atoi(dc.Port); err == nil {
		port = portInt
	}

	return &database.Config{
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
