package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds application configuration
type Config struct {
	Server   ServerConfig
	Docker   DockerConfig
	Database DatabaseConfig
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
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
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
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "volumeviz"),
			Password: getEnv("DB_PASSWORD", "volumeviz"),
			Name:     getEnv("DB_NAME", "volumeviz"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
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