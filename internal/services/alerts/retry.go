// Package alerts implements retry logic with exponential backoff
package alerts

import (
	"fmt"
	"math"
	"os"
	"strconv"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// RetryConfig holds configuration for retry logic
type RetryConfig struct {
	MaxRetries    int           `json:"max_retries"`
	BaseDelay     time.Duration `json:"base_delay"`
	MaxDelay      time.Duration `json:"max_delay"`
	BackoffFactor float64       `json:"backoff_factor"`
	Jitter        bool          `json:"jitter"`
}

// DefaultRetryConfig returns default retry configuration
func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries:    getEnvInt("VV_ALERT_RETRY_MAX", 3),
		BaseDelay:     getEnvDuration("VV_ALERT_RETRY_BASE_MS", 1000) * time.Millisecond,
		MaxDelay:      getEnvDuration("VV_ALERT_RETRY_MAX_MS", 300000) * time.Millisecond, // 5 minutes
		BackoffFactor: getEnvFloat("VV_ALERT_RETRY_BACKOFF_FACTOR", 2.0),
		Jitter:        getEnvBool("VV_ALERT_RETRY_JITTER", true),
	}
}

// RetryManager manages retry logic for alert deliveries
type RetryManager struct {
	config *RetryConfig
}

// NewRetryManager creates a new retry manager
func NewRetryManager(config *RetryConfig) *RetryManager {
	if config == nil {
		config = DefaultRetryConfig()
	}
	return &RetryManager{config: config}
}

// ShouldRetry determines if a delivery should be retried
func (rm *RetryManager) ShouldRetry(delivery *models.AlertDelivery, err error) bool {
	// Don't retry if we've exceeded max attempts
	if delivery.AttemptCount >= delivery.MaxAttempts {
		return false
	}
	
	// Don't retry certain types of errors
	if !rm.isRetriableError(err) {
		return false
	}
	
	return true
}

// CalculateNextAttempt calculates when the next retry attempt should occur
func (rm *RetryManager) CalculateNextAttempt(delivery *models.AlertDelivery) time.Time {
	// Calculate delay using exponential backoff
	delay := rm.calculateDelay(delivery.AttemptCount)
	
	// Add jitter if enabled
	if rm.config.Jitter {
		delay = rm.addJitter(delay)
	}
	
	// Ensure delay doesn't exceed maximum
	if delay > rm.config.MaxDelay {
		delay = rm.config.MaxDelay
	}
	
	return time.Now().Add(delay)
}

// calculateDelay calculates the base delay for a given attempt
func (rm *RetryManager) calculateDelay(attemptCount int32) time.Duration {
	// Exponential backoff: baseDelay * (backoffFactor ^ attemptCount)
	multiplier := math.Pow(rm.config.BackoffFactor, float64(attemptCount))
	delay := time.Duration(float64(rm.config.BaseDelay) * multiplier)
	
	return delay
}

// addJitter adds randomization to prevent thundering herd
func (rm *RetryManager) addJitter(delay time.Duration) time.Duration {
	// Add up to 25% jitter
	jitterRange := float64(delay) * 0.25
	jitter := time.Duration(jitterRange * (2*math.Mod(float64(time.Now().UnixNano()), 1) - 1))
	
	result := delay + jitter
	if result < 0 {
		result = delay
	}
	
	return result
}

// isRetriableError determines if an error is retriable
func (rm *RetryManager) isRetriableError(err error) bool {
	if err == nil {
		return false
	}
	
	errorMessage := err.Error()
	
	// Non-retriable errors (4xx HTTP status codes, auth failures, etc.)
	nonRetriablePatterns := []string{
		"400", "401", "403", "404", "405", "406", "410", "422", "429",
		"authentication failed",
		"authorization failed",
		"invalid token",
		"invalid webhook url",
		"invalid configuration",
		"malformed request",
		"bad request",
	}
	
	for _, pattern := range nonRetriablePatterns {
		if contains(errorMessage, pattern) {
			return false
		}
	}
	
	// Retriable errors (5xx HTTP status codes, network issues, timeouts)
	retriablePatterns := []string{
		"500", "502", "503", "504",
		"timeout",
		"connection refused",
		"connection reset",
		"network error",
		"temporary failure",
		"service unavailable",
		"internal server error",
		"bad gateway",
		"gateway timeout",
	}
	
	for _, pattern := range retriablePatterns {
		if contains(errorMessage, pattern) {
			return true
		}
	}
	
	// Default to retriable for unknown errors
	return true
}

// GetRetryInfo returns information about retry configuration and status
func (rm *RetryManager) GetRetryInfo(delivery *models.AlertDelivery) *RetryInfo {
	info := &RetryInfo{
		AttemptCount:    delivery.AttemptCount,
		MaxAttempts:     delivery.MaxAttempts,
		NextAttemptAt:   delivery.NextAttemptAt,
		CanRetry:        delivery.AttemptCount < delivery.MaxAttempts,
		RetryConfig:     rm.config,
	}
	
	if info.CanRetry {
		info.NextDelay = rm.calculateDelay(delivery.AttemptCount)
		info.NextAttemptCalculated = rm.CalculateNextAttempt(delivery)
	}
	
	return info
}

// RetryInfo provides information about retry status and configuration
type RetryInfo struct {
	AttemptCount           int32           `json:"attempt_count"`
	MaxAttempts            int32           `json:"max_attempts"`
	NextAttemptAt          *time.Time      `json:"next_attempt_at,omitempty"`
	NextAttemptCalculated  time.Time       `json:"next_attempt_calculated,omitempty"`
	NextDelay              time.Duration   `json:"next_delay,omitempty"`
	CanRetry               bool            `json:"can_retry"`
	RetryConfig            *RetryConfig    `json:"retry_config"`
}

// BackoffSchedule represents a complete backoff schedule
type BackoffSchedule struct {
	Attempts []ScheduledAttempt `json:"attempts"`
}

// ScheduledAttempt represents a single scheduled attempt
type ScheduledAttempt struct {
	AttemptNumber int           `json:"attempt_number"`
	Delay         time.Duration `json:"delay"`
	CumulativeDelay time.Duration `json:"cumulative_delay"`
}

// GenerateBackoffSchedule generates a complete backoff schedule for preview
func (rm *RetryManager) GenerateBackoffSchedule(maxAttempts int32) *BackoffSchedule {
	schedule := &BackoffSchedule{
		Attempts: make([]ScheduledAttempt, maxAttempts),
	}
	
	var cumulativeDelay time.Duration
	
	for i := int32(0); i < maxAttempts; i++ {
		delay := rm.calculateDelay(i)
		if delay > rm.config.MaxDelay {
			delay = rm.config.MaxDelay
		}
		
		if i > 0 {
			cumulativeDelay += delay
		}
		
		schedule.Attempts[i] = ScheduledAttempt{
			AttemptNumber:   int(i + 1),
			Delay:          delay,
			CumulativeDelay: cumulativeDelay,
		}
	}
	
	return schedule
}

// ValidateRetryConfig validates retry configuration
func ValidateRetryConfig(config *RetryConfig) error {
	if config.MaxRetries < 0 {
		return fmt.Errorf("max_retries must be non-negative")
	}
	
	if config.MaxRetries > 10 {
		return fmt.Errorf("max_retries cannot exceed 10 for safety")
	}
	
	if config.BaseDelay <= 0 {
		return fmt.Errorf("base_delay must be positive")
	}
	
	if config.MaxDelay <= 0 {
		return fmt.Errorf("max_delay must be positive")
	}
	
	if config.BaseDelay > config.MaxDelay {
		return fmt.Errorf("base_delay cannot be greater than max_delay")
	}
	
	if config.BackoffFactor <= 1.0 {
		return fmt.Errorf("backoff_factor must be greater than 1.0")
	}
	
	if config.BackoffFactor > 10.0 {
		return fmt.Errorf("backoff_factor cannot exceed 10.0 for safety")
	}
	
	return nil
}

// Utility functions for environment variable parsing

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultMs int) time.Duration {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return time.Duration(parsed)
		}
	}
	return time.Duration(defaultMs)
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseFloat(value, 64); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && 
		   (s == substr || 
			(len(s) > len(substr) && 
			 (s[:len(substr)] == substr || 
			  s[len(s)-len(substr):] == substr ||
			  containsSubstring(s, substr))))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}