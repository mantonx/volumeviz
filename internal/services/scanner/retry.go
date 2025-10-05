package scanner

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"

	coreModels "github.com/mantonx/volumeviz/internal/models"
)

// RetryConfig holds retry behavior configuration
type RetryConfig struct {
	MaxAttempts       int
	InitialBackoff    time.Duration
	MaxBackoff        time.Duration
	BackoffMultiplier float64
	JitterPercent     float64 // Add randomness to prevent thundering herd
}

// DefaultRetryConfig returns sensible defaults
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:       3,
		InitialBackoff:    1 * time.Second,
		MaxBackoff:        30 * time.Second,
		BackoffMultiplier: 2.0,
		JitterPercent:     0.1, // 10% jitter
	}
}

// RetryableError indicates an error that can be retried
type RetryableError struct {
	Err     error
	Message string
}

func (e *RetryableError) Error() string {
	return fmt.Sprintf("retryable error: %s: %v", e.Message, e.Err)
}

func (e *RetryableError) Unwrap() error {
	return e.Err
}

// NewRetryableError creates a new retryable error
func NewRetryableError(message string, err error) *RetryableError {
	return &RetryableError{
		Message: message,
		Err:     err,
	}
}

// IsRetryable determines if an error should be retried
func IsRetryable(err error) bool {
	if err == nil {
		return false
	}

	// Check for explicit RetryableError
	var retryable *RetryableError
	if errors.As(err, &retryable) {
		return true
	}

	// Check for context errors (don't retry)
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}

	// Check for specific error codes that are retryable
	var scanErr *coreModels.ScanError
	if errors.As(err, &scanErr) {
		switch scanErr.Code {
		case coreModels.ErrorCodeNetworkError,
			coreModels.ErrorCodeTemporaryIOError,
			coreModels.ErrorCodeResourceBusy,
			coreModels.ErrorCodeRateLimitExceeded:
			return true
		case coreModels.ErrorCodePermissionDenied,
			coreModels.ErrorCodeVolumeNotFound,
			coreModels.ErrorCodeInvalidPath,
			coreModels.ErrorCodeAllMethodsFailed:
			return false
		}
	}

	// Default: don't retry unknown errors
	return false
}

// RetryWithBackoff executes a function with exponential backoff
func RetryWithBackoff(ctx context.Context, cfg RetryConfig, fn func() error) error {
	var lastErr error
	backoff := cfg.InitialBackoff

	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		// Execute function
		err := fn()
		if err == nil {
			return nil
		}

		// Check if error is retryable
		if !IsRetryable(err) {
			return err
		}

		lastErr = err

		// Don't sleep after last attempt
		if attempt >= cfg.MaxAttempts {
			break
		}

		// Calculate backoff with jitter
		jitter := time.Duration(float64(backoff) * cfg.JitterPercent * (2*rand.Float64() - 1))
		sleepDuration := backoff + jitter

		// Cap at max backoff
		if sleepDuration > cfg.MaxBackoff {
			sleepDuration = cfg.MaxBackoff
		}

		// Sleep with context cancellation
		select {
		case <-time.After(sleepDuration):
			// Continue to next attempt
		case <-ctx.Done():
			return fmt.Errorf("retry canceled: %w", ctx.Err())
		}

		// Increase backoff for next attempt
		backoff = time.Duration(float64(backoff) * cfg.BackoffMultiplier)
	}

	return fmt.Errorf("max retries (%d) exceeded: %w", cfg.MaxAttempts, lastErr)
}
