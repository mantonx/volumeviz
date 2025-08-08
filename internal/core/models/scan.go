package models

import (
	"fmt"
	"time"
)

// ScanError represents detailed error information for scan operations
type ScanError struct {
	VolumeID string         `json:"volume_id"`
	Method   string         `json:"method"`
	Path     string         `json:"path"`
	Err      error          `json:"-"`
	Message  string         `json:"message"`
	Context  map[string]any `json:"context"`
	Code     string         `json:"code"`
}

func (e *ScanError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("scan error [%s]: %s - %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("scan error [%s]: %s", e.Code, e.Message)
}

func (e *ScanError) Unwrap() error {
	return e.Err
}

// BulkScanRequest represents a request to scan multiple volumes
type BulkScanRequest struct {
	VolumeIDs []string `json:"volume_ids" binding:"required"`
	Async     bool     `json:"async"`
	Method    string   `json:"method,omitempty"`
}

// BulkScanResponse represents the response from a bulk scan operation
type BulkScanResponse struct {
	ScanID   string            `json:"scan_id,omitempty"`
	Results  map[string]any    `json:"results"`
	Failed   map[string]string `json:"failed,omitempty"`
	Total    int               `json:"total"`
	Success  int               `json:"success"`
	Failures int               `json:"failures"`
}

// RefreshRequest represents a request to refresh volume size
type RefreshRequest struct {
	Async  bool   `json:"async"`
	Method string `json:"method,omitempty"`
}

// ScanConfig holds configuration for scanning operations
type ScanConfig struct {
	DefaultTimeout    time.Duration `yaml:"default_timeout"`
	MaxConcurrent     int           `yaml:"max_concurrent"`
	PreferredMethods  []string      `yaml:"preferred_methods"`
	ProgressReporting bool          `yaml:"progress_reporting"`
}

// CacheConfig holds configuration for caching
type CacheConfig struct {
	Type     string        `yaml:"type"` // "memory" or "redis"
	TTL      time.Duration `yaml:"ttl"`
	MaxSize  int           `yaml:"max_size"`
	RedisURL string        `yaml:"redis_url"`
}

// Config holds all scanner configuration
type Config struct {
	Scanning ScanConfig  `yaml:"scanning"`
	Cache    CacheConfig `yaml:"cache"`
}

// DefaultConfig returns a default configuration
func DefaultConfig() Config {
	return Config{
		Scanning: ScanConfig{
			DefaultTimeout:    5 * time.Minute,
			MaxConcurrent:     5,
			PreferredMethods:  []string{"diskus", "du", "native"},
			ProgressReporting: true,
		},
		Cache: CacheConfig{
			Type:    "memory",
			TTL:     5 * time.Minute,
			MaxSize: 1000,
		},
	}
}

// ErrorCodes defines standard error codes for scan operations
const (
	ErrorCodeScanQueueTimeout       = "SCAN_QUEUE_TIMEOUT"
	ErrorCodeVolumePathError        = "VOLUME_PATH_ERROR"
	ErrorCodeAllMethodsFailed       = "ALL_METHODS_FAILED"
	ErrorCodePathValidationFailed   = "PATH_VALIDATION_FAILED"
	ErrorCodeResultValidationFailed = "RESULT_VALIDATION_FAILED"
	ErrorCodePermissionDenied       = "PERMISSION_DENIED"
	ErrorCodeVolumeNotFound         = "VOLUME_NOT_FOUND"
	ErrorCodeScanCanceled           = "SCAN_CANCELED"
	ErrorCodeMethodUnavailable      = "METHOD_UNAVAILABLE"
	ErrorCodePathNotFound           = "PATH_NOT_FOUND"
	ErrorCodeInsufficientSpace      = "INSUFFICIENT_SPACE"
	ErrorCodeScanTimeout            = "SCAN_TIMEOUT"
	ErrorCodeUnknown                = "UNKNOWN"
)

// ScanStatus represents the possible states of a scan operation
const (
	ScanStatusPending   = "pending"
	ScanStatusRunning   = "running"
	ScanStatusCompleted = "completed"
	ScanStatusFailed    = "failed"
	ScanStatusCanceled  = "canceled"
)
