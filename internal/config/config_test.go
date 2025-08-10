package config

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/mantonx/volumeviz/internal/database"
)

func TestLoad_DefaultValues(t *testing.T) {
	// Clear any existing env vars that might affect the test
	envVars := []string{
		"SERVER_HOST", "SERVER_PORT", "GIN_MODE",
		"DOCKER_HOST", "DOCKER_TIMEOUT",
		"DB_TYPE", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_SSLMODE", "DB_PATH",
		"ALLOW_ORIGINS", "AUTH_ENABLED", "AUTH_HS256_SECRET",
		"SECURITY_HIDE_SERVER", "SECURITY_ENABLE_HSTS", "SECURITY_HSTS_MAX_AGE",
		"SECURITY_CONTENT_TYPE_OPTIONS", "SECURITY_FRAME_OPTIONS", "SECURITY_REFERRER_POLICY", "SECURITY_CSP",
		"RATE_LIMIT_ENABLED", "RATE_LIMIT_RPM", "RATE_LIMIT_BURST",
		"TLS_CERT_FILE", "TLS_KEY_FILE",
		"LIFECYCLE_ENABLED", "VOLUME_METRICS_TTL_DAYS", "VOLUME_SIZES_TTL_DAYS", "VOLUME_ROLLUP_ENABLED",
		"LIFECYCLE_INTERVAL", "LIFECYCLE_INITIAL_DELAY",
		"EVENTS_ENABLED", "EVENTS_QUEUE_SIZE", "EVENTS_BACKOFF_MIN", "EVENTS_BACKOFF_MAX", "EVENTS_RECONCILE_INTERVAL",
		"SCAN_ENABLED", "SCAN_INTERVAL", "SCAN_CONCURRENCY", "SCAN_TIMEOUT_PER_VOLUME",
		"SCAN_METHODS_ORDER", "SCAN_BIND_MOUNTS_ENABLED", "SCAN_BIND_ALLOWLIST", "SCAN_SKIP_PATTERN",
		"NODE_ENV",
	}
	
	// Store original values and clear them
	originalValues := make(map[string]string)
	for _, envVar := range envVars {
		originalValues[envVar] = os.Getenv(envVar)
		os.Unsetenv(envVar)
	}
	
	// Restore original values after test
	defer func() {
		for envVar, value := range originalValues {
			if value != "" {
				os.Setenv(envVar, value)
			}
		}
	}()

	config := Load()

	// Test Server defaults
	assert.Equal(t, "0.0.0.0", config.Server.Host)
	assert.Equal(t, "8080", config.Server.Port)
	assert.Equal(t, "release", config.Server.Mode)

	// Test Docker defaults
	assert.Equal(t, "", config.Docker.Host)
	assert.Equal(t, 30*time.Second, config.Docker.Timeout)

	// Test Database defaults
	assert.Equal(t, "postgres", config.Database.Type)
	assert.Equal(t, "localhost", config.Database.Host)
	assert.Equal(t, "5432", config.Database.Port)
	assert.Equal(t, "volumeviz", config.Database.User)
	assert.Equal(t, "volumeviz", config.Database.Password)
	assert.Equal(t, "volumeviz", config.Database.Name)
	assert.Equal(t, "disable", config.Database.SSLMode)
	assert.Equal(t, "./volumeviz.db", config.Database.Path)

	// Test CORS defaults
	assert.Equal(t, []string{"http://localhost:3000"}, config.CORS.AllowedOrigins)

	// Test Auth defaults
	assert.False(t, config.Auth.Enabled)
	assert.Equal(t, "", config.Auth.Secret)

	// Test Security defaults
	assert.True(t, config.Security.HideServerHeader)
	assert.False(t, config.Security.EnableHSTS)
	assert.Equal(t, 31536000, config.Security.HSSTMaxAge)
	assert.Equal(t, "nosniff", config.Security.ContentTypeOptions)
	assert.Equal(t, "SAMEORIGIN", config.Security.FrameOptions)
	assert.Equal(t, "no-referrer", config.Security.ReferrerPolicy)
	assert.Equal(t, "default-src 'none'; frame-ancestors 'self';", config.Security.ContentSecurityPolicy)

	// Test RateLimit defaults
	assert.True(t, config.RateLimit.Enabled)
	assert.Equal(t, 60, config.RateLimit.RPM)
	assert.Equal(t, 30, config.RateLimit.Burst)

	// Test TLS defaults
	assert.False(t, config.TLS.Enabled)
	assert.Equal(t, "", config.TLS.CertFile)
	assert.Equal(t, "", config.TLS.KeyFile)

	// Test Lifecycle defaults
	assert.True(t, config.Lifecycle.Enabled)
	assert.Equal(t, 90, config.Lifecycle.MetricsTTLDays)
	assert.Equal(t, 90, config.Lifecycle.SizesTTLDays)
	assert.True(t, config.Lifecycle.RollupEnabled)
	assert.Equal(t, time.Hour, config.Lifecycle.Interval)
	assert.Equal(t, 30*time.Second, config.Lifecycle.InitialDelay)

	// Test Events defaults
	assert.True(t, config.Events.Enabled)
	assert.Equal(t, 1000, config.Events.QueueSize)
	assert.Equal(t, 1*time.Second, config.Events.BackoffMinDuration)
	assert.Equal(t, 30*time.Second, config.Events.BackoffMaxDuration)
	assert.Equal(t, 6*time.Hour, config.Events.ReconcileInterval)

	// Test Scan defaults (should be false in release mode)
	assert.False(t, config.Scan.Enabled)
	assert.Equal(t, 6*time.Hour, config.Scan.Interval)
	assert.Equal(t, 2, config.Scan.Concurrency)
	assert.Equal(t, 2*time.Minute, config.Scan.TimeoutPerVolume)
	assert.Equal(t, []string{"diskus", "du", "native"}, config.Scan.MethodsOrder)
	assert.False(t, config.Scan.BindMountsEnabled)
	assert.Equal(t, []string{}, config.Scan.BindAllowList)
	assert.Equal(t, "^docker_|^builder_|^containerd", config.Scan.SkipPattern)
}

func TestLoad_CustomEnvValues(t *testing.T) {
	// Set custom environment variables
	os.Setenv("SERVER_HOST", "127.0.0.1")
	os.Setenv("SERVER_PORT", "9090")
	os.Setenv("GIN_MODE", "debug")
	os.Setenv("DOCKER_HOST", "unix:///var/run/docker.sock")
	os.Setenv("DOCKER_TIMEOUT", "60s")
	os.Setenv("DB_TYPE", "sqlite")
	os.Setenv("DB_HOST", "database.example.com")
	os.Setenv("DB_PORT", "3306")
	os.Setenv("DB_USER", "testuser")
	os.Setenv("DB_PASSWORD", "testpass")
	os.Setenv("DB_NAME", "testdb")
	os.Setenv("DB_SSLMODE", "require")
	os.Setenv("DB_PATH", "/tmp/test.db")
	os.Setenv("ALLOW_ORIGINS", "http://localhost:8080,https://example.com")
	os.Setenv("AUTH_ENABLED", "true")
	os.Setenv("AUTH_HS256_SECRET", "secret123")
	os.Setenv("TLS_CERT_FILE", "/path/to/cert.pem")
	os.Setenv("TLS_KEY_FILE", "/path/to/key.pem")
	
	defer func() {
		// Clean up environment variables
		envVars := []string{
			"SERVER_HOST", "SERVER_PORT", "GIN_MODE", "DOCKER_HOST", "DOCKER_TIMEOUT",
			"DB_TYPE", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_SSLMODE", "DB_PATH",
			"ALLOW_ORIGINS", "AUTH_ENABLED", "AUTH_HS256_SECRET", "TLS_CERT_FILE", "TLS_KEY_FILE",
		}
		for _, envVar := range envVars {
			os.Unsetenv(envVar)
		}
	}()

	config := Load()

	// Test Server custom values
	assert.Equal(t, "127.0.0.1", config.Server.Host)
	assert.Equal(t, "9090", config.Server.Port)
	assert.Equal(t, "debug", config.Server.Mode)

	// Test Docker custom values
	assert.Equal(t, "unix:///var/run/docker.sock", config.Docker.Host)
	assert.Equal(t, 60*time.Second, config.Docker.Timeout)

	// Test Database custom values
	assert.Equal(t, "sqlite", config.Database.Type)
	assert.Equal(t, "database.example.com", config.Database.Host)
	assert.Equal(t, "3306", config.Database.Port)
	assert.Equal(t, "testuser", config.Database.User)
	assert.Equal(t, "testpass", config.Database.Password)
	assert.Equal(t, "testdb", config.Database.Name)
	assert.Equal(t, "require", config.Database.SSLMode)
	assert.Equal(t, "/tmp/test.db", config.Database.Path)

	// Test CORS custom values
	assert.Equal(t, []string{"http://localhost:8080", "https://example.com"}, config.CORS.AllowedOrigins)

	// Test Auth custom values
	assert.True(t, config.Auth.Enabled)
	assert.Equal(t, "secret123", config.Auth.Secret)

	// Test TLS custom values
	assert.True(t, config.TLS.Enabled) // Should be true when both cert and key are set
	assert.Equal(t, "/path/to/cert.pem", config.TLS.CertFile)
	assert.Equal(t, "/path/to/key.pem", config.TLS.KeyFile)
}

func TestGetEnv(t *testing.T) {
	// Test with existing environment variable
	os.Setenv("TEST_ENV_VAR", "test_value")
	defer os.Unsetenv("TEST_ENV_VAR")
	
	result := getEnv("TEST_ENV_VAR", "default_value")
	assert.Equal(t, "test_value", result)

	// Test with non-existing environment variable
	result = getEnv("NON_EXISTING_VAR", "default_value")
	assert.Equal(t, "default_value", result)

	// Test with empty environment variable
	os.Setenv("EMPTY_ENV_VAR", "")
	defer os.Unsetenv("EMPTY_ENV_VAR")
	
	result = getEnv("EMPTY_ENV_VAR", "default_value")
	assert.Equal(t, "default_value", result)
}

func TestGetDurationEnv(t *testing.T) {
	// Test with valid duration string
	os.Setenv("TEST_DURATION", "5m30s")
	defer os.Unsetenv("TEST_DURATION")
	
	result := getDurationEnv("TEST_DURATION", 1*time.Minute)
	assert.Equal(t, 5*time.Minute+30*time.Second, result)

	// Test with integer seconds
	os.Setenv("TEST_DURATION_SECONDS", "120")
	defer os.Unsetenv("TEST_DURATION_SECONDS")
	
	result = getDurationEnv("TEST_DURATION_SECONDS", 1*time.Minute)
	assert.Equal(t, 2*time.Minute, result)

	// Test with non-existing environment variable
	result = getDurationEnv("NON_EXISTING_DURATION", 1*time.Minute)
	assert.Equal(t, 1*time.Minute, result)

	// Test with invalid duration
	os.Setenv("INVALID_DURATION", "invalid")
	defer os.Unsetenv("INVALID_DURATION")
	
	result = getDurationEnv("INVALID_DURATION", 1*time.Minute)
	assert.Equal(t, 1*time.Minute, result)
}

func TestGetStringSliceEnv(t *testing.T) {
	// Test with existing environment variable
	os.Setenv("TEST_STRING_SLICE", "value1,value2,value3")
	defer os.Unsetenv("TEST_STRING_SLICE")
	
	result := getStringSliceEnv("TEST_STRING_SLICE", []string{"default"})
	assert.Equal(t, []string{"value1", "value2", "value3"}, result)

	// Test with non-existing environment variable
	result = getStringSliceEnv("NON_EXISTING_SLICE", []string{"default1", "default2"})
	assert.Equal(t, []string{"default1", "default2"}, result)

	// Test with single value
	os.Setenv("SINGLE_VALUE", "single")
	defer os.Unsetenv("SINGLE_VALUE")
	
	result = getStringSliceEnv("SINGLE_VALUE", []string{"default"})
	assert.Equal(t, []string{"single"}, result)
}

func TestGetBoolEnv(t *testing.T) {
	// Test with "true"
	os.Setenv("TEST_BOOL_TRUE", "true")
	defer os.Unsetenv("TEST_BOOL_TRUE")
	
	result := getBoolEnv("TEST_BOOL_TRUE", false)
	assert.True(t, result)

	// Test with "false"
	os.Setenv("TEST_BOOL_FALSE", "false")
	defer os.Unsetenv("TEST_BOOL_FALSE")
	
	result = getBoolEnv("TEST_BOOL_FALSE", true)
	assert.False(t, result)

	// Test with "1"
	os.Setenv("TEST_BOOL_ONE", "1")
	defer os.Unsetenv("TEST_BOOL_ONE")
	
	result = getBoolEnv("TEST_BOOL_ONE", false)
	assert.True(t, result)

	// Test with "0"
	os.Setenv("TEST_BOOL_ZERO", "0")
	defer os.Unsetenv("TEST_BOOL_ZERO")
	
	result = getBoolEnv("TEST_BOOL_ZERO", true)
	assert.False(t, result)

	// Test with non-existing environment variable
	result = getBoolEnv("NON_EXISTING_BOOL", true)
	assert.True(t, result)

	// Test with invalid boolean
	os.Setenv("INVALID_BOOL", "invalid")
	defer os.Unsetenv("INVALID_BOOL")
	
	result = getBoolEnv("INVALID_BOOL", true)
	assert.True(t, result)
}

func TestGetIntEnv(t *testing.T) {
	// Test with valid integer
	os.Setenv("TEST_INT", "42")
	defer os.Unsetenv("TEST_INT")
	
	result := getIntEnv("TEST_INT", 10)
	assert.Equal(t, 42, result)

	// Test with non-existing environment variable
	result = getIntEnv("NON_EXISTING_INT", 10)
	assert.Equal(t, 10, result)

	// Test with invalid integer
	os.Setenv("INVALID_INT", "invalid")
	defer os.Unsetenv("INVALID_INT")
	
	result = getIntEnv("INVALID_INT", 10)
	assert.Equal(t, 10, result)
}

func TestGetScanEnabledDefault(t *testing.T) {
	// Clear environment variables
	os.Unsetenv("SCAN_ENABLED")
	os.Unsetenv("GIN_MODE")
	os.Unsetenv("NODE_ENV")

	// Test explicit SCAN_ENABLED=true
	os.Setenv("SCAN_ENABLED", "true")
	result := getScanEnabledDefault()
	assert.True(t, result)
	os.Unsetenv("SCAN_ENABLED")

	// Test explicit SCAN_ENABLED=false
	os.Setenv("SCAN_ENABLED", "false")
	result = getScanEnabledDefault()
	assert.False(t, result)
	os.Unsetenv("SCAN_ENABLED")

	// Test debug mode (should be true)
	os.Setenv("GIN_MODE", "debug")
	result = getScanEnabledDefault()
	assert.True(t, result)
	os.Unsetenv("GIN_MODE")

	// Test test mode (should be true)
	os.Setenv("GIN_MODE", "test")
	result = getScanEnabledDefault()
	assert.True(t, result)
	os.Unsetenv("GIN_MODE")

	// Test NODE_ENV=development (should be true)
	os.Setenv("NODE_ENV", "development")
	result = getScanEnabledDefault()
	assert.True(t, result)
	os.Unsetenv("NODE_ENV")

	// Test release mode (should be false)
	os.Setenv("GIN_MODE", "release")
	result = getScanEnabledDefault()
	assert.False(t, result)
	os.Unsetenv("GIN_MODE")

	// Test default (no env vars, should be false)
	result = getScanEnabledDefault()
	assert.False(t, result)
}

func TestToDatabaseConfig(t *testing.T) {
	// Test PostgreSQL conversion
	dbConfig := &DatabaseConfig{
		Type:     "postgres",
		Host:     "localhost",
		Port:     "5432",
		User:     "user",
		Password: "pass",
		Name:     "db",
		SSLMode:  "disable",
		Path:     "/path/to/db",
	}

	result := dbConfig.ToDatabaseConfig()
	
	assert.Equal(t, database.DatabaseTypePostgreSQL, result.Type)
	assert.Equal(t, "localhost", result.Host)
	assert.Equal(t, 5432, result.Port)
	assert.Equal(t, "user", result.User)
	assert.Equal(t, "pass", result.Password)
	assert.Equal(t, "db", result.Database)
	assert.Equal(t, "disable", result.SSLMode)
	assert.Equal(t, "/path/to/db", result.Path)
	assert.Equal(t, 25, result.MaxOpenConns)
	assert.Equal(t, 10, result.MaxIdleConns)
	assert.Equal(t, 30*time.Minute, result.ConnMaxLife)
	assert.Equal(t, 30*time.Second, result.Timeout)

	// Test SQLite conversion
	dbConfig.Type = "sqlite"
	result = dbConfig.ToDatabaseConfig()
	assert.Equal(t, database.DatabaseTypeSQLite, result.Type)

	// Test postgresql alias
	dbConfig.Type = "postgresql"
	result = dbConfig.ToDatabaseConfig()
	assert.Equal(t, database.DatabaseTypePostgreSQL, result.Type)

	// Test unknown type (should default to PostgreSQL)
	dbConfig.Type = "unknown"
	result = dbConfig.ToDatabaseConfig()
	assert.Equal(t, database.DatabaseTypePostgreSQL, result.Type)

	// Test invalid port (should default to 5432)
	dbConfig.Port = "invalid"
	result = dbConfig.ToDatabaseConfig()
	assert.Equal(t, 5432, result.Port)
}