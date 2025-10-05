package scanner

import (
	"context"
	"errors"
	"testing"
	"time"

	coreModels "github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsRetryable(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error is not retryable",
			err:      nil,
			expected: false,
		},
		{
			name:     "explicit RetryableError is retryable",
			err:      NewRetryableError("network issue", errors.New("connection timeout")),
			expected: true,
		},
		{
			name:     "context.Canceled is not retryable",
			err:      context.Canceled,
			expected: false,
		},
		{
			name:     "context.DeadlineExceeded is not retryable",
			err:      context.DeadlineExceeded,
			expected: false,
		},
		{
			name: "network error is retryable",
			err: &coreModels.ScanError{
				Code:    coreModels.ErrorCodeNetworkError,
				Message: "network timeout",
			},
			expected: true,
		},
		{
			name: "temporary IO error is retryable",
			err: &coreModels.ScanError{
				Code:    coreModels.ErrorCodeTemporaryIOError,
				Message: "temporary IO issue",
			},
			expected: true,
		},
		{
			name: "resource busy is retryable",
			err: &coreModels.ScanError{
				Code:    coreModels.ErrorCodeResourceBusy,
				Message: "resource busy",
			},
			expected: true,
		},
		{
			name: "rate limit exceeded is retryable",
			err: &coreModels.ScanError{
				Code:    coreModels.ErrorCodeRateLimitExceeded,
				Message: "rate limit exceeded",
			},
			expected: true,
		},
		{
			name: "permission denied is not retryable",
			err: &coreModels.ScanError{
				Code:    coreModels.ErrorCodePermissionDenied,
				Message: "permission denied",
			},
			expected: false,
		},
		{
			name: "volume not found is not retryable",
			err: &coreModels.ScanError{
				Code:    coreModels.ErrorCodeVolumeNotFound,
				Message: "volume not found",
			},
			expected: false,
		},
		{
			name: "invalid path is not retryable",
			err: &coreModels.ScanError{
				Code:    coreModels.ErrorCodeInvalidPath,
				Message: "invalid path",
			},
			expected: false,
		},
		{
			name:     "unknown error is not retryable by default",
			err:      errors.New("unknown error"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsRetryable(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRetryWithBackoff_Success(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:       3,
		InitialBackoff:    10 * time.Millisecond,
		MaxBackoff:        100 * time.Millisecond,
		BackoffMultiplier: 2.0,
		JitterPercent:     0.0, // No jitter for predictable testing
	}

	attempts := 0
	fn := func() error {
		attempts++
		return nil
	}

	err := RetryWithBackoff(context.Background(), cfg, fn)

	require.NoError(t, err)
	assert.Equal(t, 1, attempts, "should succeed on first attempt")
}

func TestRetryWithBackoff_SuccessOnRetry(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:       3,
		InitialBackoff:    10 * time.Millisecond,
		MaxBackoff:        100 * time.Millisecond,
		BackoffMultiplier: 2.0,
		JitterPercent:     0.0,
	}

	attempts := 0
	fn := func() error {
		attempts++
		if attempts < 3 {
			return NewRetryableError("temporary failure", errors.New("network timeout"))
		}
		return nil
	}

	start := time.Now()
	err := RetryWithBackoff(context.Background(), cfg, fn)
	elapsed := time.Since(start)

	require.NoError(t, err)
	assert.Equal(t, 3, attempts, "should succeed on third attempt")
	// Should have slept approximately 10ms + 20ms = 30ms
	assert.Greater(t, elapsed, 25*time.Millisecond, "should have backoff delays")
	assert.Less(t, elapsed, 100*time.Millisecond, "should not exceed max backoff")
}

func TestRetryWithBackoff_MaxRetriesExceeded(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:       3,
		InitialBackoff:    10 * time.Millisecond,
		MaxBackoff:        100 * time.Millisecond,
		BackoffMultiplier: 2.0,
		JitterPercent:     0.0,
	}

	attempts := 0
	fn := func() error {
		attempts++
		return NewRetryableError("persistent failure", errors.New("always fails"))
	}

	err := RetryWithBackoff(context.Background(), cfg, fn)

	require.Error(t, err)
	assert.Equal(t, 3, attempts, "should attempt exactly MaxAttempts times")
	assert.Contains(t, err.Error(), "max retries (3) exceeded")
}

func TestRetryWithBackoff_NonRetryableError(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:       3,
		InitialBackoff:    10 * time.Millisecond,
		MaxBackoff:        100 * time.Millisecond,
		BackoffMultiplier: 2.0,
		JitterPercent:     0.0,
	}

	attempts := 0
	nonRetryableErr := &coreModels.ScanError{
		Code:    coreModels.ErrorCodePermissionDenied,
		Message: "permission denied",
	}

	fn := func() error {
		attempts++
		return nonRetryableErr
	}

	start := time.Now()
	err := RetryWithBackoff(context.Background(), cfg, fn)
	elapsed := time.Since(start)

	require.Error(t, err)
	assert.Equal(t, 1, attempts, "should not retry non-retryable errors")
	assert.ErrorIs(t, err, nonRetryableErr)
	assert.Less(t, elapsed, 10*time.Millisecond, "should fail immediately without backoff")
}

func TestRetryWithBackoff_ContextCanceled(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:       5,
		InitialBackoff:    100 * time.Millisecond,
		MaxBackoff:        1 * time.Second,
		BackoffMultiplier: 2.0,
		JitterPercent:     0.0,
	}

	ctx, cancel := context.WithCancel(context.Background())

	attempts := 0
	fn := func() error {
		attempts++
		if attempts == 2 {
			// Cancel context during second attempt
			cancel()
		}
		return NewRetryableError("temporary failure", errors.New("network timeout"))
	}

	err := RetryWithBackoff(ctx, cfg, fn)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "retry canceled")
	assert.GreaterOrEqual(t, attempts, 2, "should attempt at least twice before cancellation")
	assert.LessOrEqual(t, attempts, 3, "should stop quickly after cancellation")
}

func TestRetryWithBackoff_BackoffProgression(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:       4,
		InitialBackoff:    10 * time.Millisecond,
		MaxBackoff:        50 * time.Millisecond,
		BackoffMultiplier: 2.0,
		JitterPercent:     0.0,
	}

	attempts := 0
	var delays []time.Duration
	lastAttempt := time.Now()

	fn := func() error {
		now := time.Now()
		if attempts > 0 {
			delays = append(delays, now.Sub(lastAttempt))
		}
		lastAttempt = now
		attempts++
		return NewRetryableError("temporary failure", errors.New("network timeout"))
	}

	_ = RetryWithBackoff(context.Background(), cfg, fn)

	assert.Equal(t, 4, attempts)
	assert.Len(t, delays, 3, "should have 3 delays between 4 attempts")

	// Check backoff progression: ~10ms, ~20ms, ~40ms (capped at 50ms)
	assert.Greater(t, delays[0], 8*time.Millisecond)
	assert.Less(t, delays[0], 15*time.Millisecond)

	assert.Greater(t, delays[1], 18*time.Millisecond)
	assert.Less(t, delays[1], 25*time.Millisecond)

	// Third delay should be capped at MaxBackoff (50ms)
	assert.Greater(t, delays[2], 35*time.Millisecond)
	assert.Less(t, delays[2], 60*time.Millisecond)
}

func TestRetryWithBackoff_Jitter(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:       10,
		InitialBackoff:    50 * time.Millisecond,
		MaxBackoff:        200 * time.Millisecond,
		BackoffMultiplier: 2.0,
		JitterPercent:     0.2, // 20% jitter
	}

	attempts := 0
	var delays []time.Duration
	lastAttempt := time.Now()

	fn := func() error {
		now := time.Now()
		if attempts > 0 {
			delays = append(delays, now.Sub(lastAttempt))
		}
		lastAttempt = now
		attempts++
		return NewRetryableError("temporary failure", errors.New("network timeout"))
	}

	_ = RetryWithBackoff(context.Background(), cfg, fn)

	// With jitter, delays should vary
	// Check that not all delays are identical
	if len(delays) >= 3 {
		allSame := true
		firstDelay := delays[0]
		for _, d := range delays[1:] {
			if d != firstDelay {
				allSame = false
				break
			}
		}
		assert.False(t, allSame, "jitter should cause varying delays")
	}
}

func TestRetryableError_Error(t *testing.T) {
	err := NewRetryableError("network issue", errors.New("connection timeout"))
	assert.Contains(t, err.Error(), "retryable error")
	assert.Contains(t, err.Error(), "network issue")
	assert.Contains(t, err.Error(), "connection timeout")
}

func TestRetryableError_Unwrap(t *testing.T) {
	innerErr := errors.New("connection timeout")
	err := NewRetryableError("network issue", innerErr)

	unwrapped := errors.Unwrap(err)
	assert.Equal(t, innerErr, unwrapped)
}

func TestDefaultRetryConfig(t *testing.T) {
	cfg := DefaultRetryConfig()

	assert.Equal(t, 3, cfg.MaxAttempts)
	assert.Equal(t, 1*time.Second, cfg.InitialBackoff)
	assert.Equal(t, 30*time.Second, cfg.MaxBackoff)
	assert.Equal(t, 2.0, cfg.BackoffMultiplier)
	assert.Equal(t, 0.1, cfg.JitterPercent)
}
