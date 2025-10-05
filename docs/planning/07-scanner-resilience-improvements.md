# Volume Scanner Resilience Improvements

**Date**: October 4, 2025
**Goal**: Transform scanner from happy-path implementation to production-grade resilient system
**Priority**: High - Required for production deployments
**Timeline**: 2-3 weeks (40-60 hours)

---

## Executive Summary

The volume scanner has a solid foundation with excellent progress tracking and error handling structure, but lacks critical resilience features needed for production use. This plan addresses:

- **No retry logic** for transient failures
- **No timeout handling** for long-running scans
- **No crash recovery** or checkpointing
- **Goroutine leak risks** from unrecovered panics
- **Inconsistent database state** from non-transactional writes

**Rating**: Current 6.5/10 → Target 9/10

---

## Current State Assessment

### ✅ Strengths

1. **Good Error Handling Structure**
   - Typed `ScanError` with error codes
   - Structured error context with metadata
   - Proper error wrapping

2. **Comprehensive Progress Tracking**
   - Multi-phase tracking (volume_scan, filesystem_indexing, media_enrichment)
   - Real-time WebSocket updates
   - Detailed metrics (files/sec, bytes/sec, errors/min)
   - Database-backed progress

3. **Resource Management**
   - Semaphore-based concurrency limiting
   - Context-aware cancellation
   - Proper mutex usage
   - Cache with configurable TTL

4. **Test Coverage**
   - 12 test files
   - Unit, integration, and performance tests

5. **Multi-Method Fallback**
   - Progressive degradation (diskus → du → native)
   - Availability checking

### ❌ Critical Gaps

1. **No Retry Logic**
   - Single attempt per method
   - No exponential backoff
   - No distinction between retryable vs. permanent errors
   - Network/IO errors treated same as fatal errors

2. **No Partial Scan Recovery**
   - No checkpointing of completed work
   - Crash during indexing = restart from beginning
   - Multi-hour scans can't resume

3. **No Timeout Handling**
   - Scans can run indefinitely
   - No per-method timeout
   - No overall scan timeout
   - Large volumes could hang forever

4. **Goroutine Leak Risk**
   - No panic recovery in async goroutines
   - No goroutine tracking
   - Silent failures

5. **Database Writes Without Transactions**
   - Multiple DB writes without atomicity
   - Process crash = inconsistent state

6. **Insufficient Error Context**
   - Missing volume ID, scan ID in some logs
   - Can't correlate errors in distributed systems

---

## Implementation Plan

### Phase 1: Retry Logic & Resilience (Week 1 - 20 hours)

**Goal**: Handle transient failures gracefully

#### 1.1 Create Retry Infrastructure (4 hours)

**File**: `internal/services/scanner/retry.go`

```go
package scanner

import (
	"context"
	"errors"
	"fmt"
	"time"
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
	var scanErr *ScanError
	if errors.As(err, &scanErr) {
		switch scanErr.Code {
		case ErrorCodeNetworkError,
			ErrorCodeTemporaryIOError,
			ErrorCodeResourceBusy,
			ErrorCodeRateLimitExceeded:
			return true
		case ErrorCodePermissionDenied,
			ErrorCodeVolumeNotFound,
			ErrorCodeInvalidPath:
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
```

**New Error Codes** (add to `internal/models/scan.go`):
```go
const (
	// Existing codes...

	// Retryable errors
	ErrorCodeNetworkError        = "NETWORK_ERROR"
	ErrorCodeTemporaryIOError    = "TEMPORARY_IO_ERROR"
	ErrorCodeResourceBusy        = "RESOURCE_BUSY"
	ErrorCodeRateLimitExceeded   = "RATE_LIMIT_EXCEEDED"
)
```

**Tests**: `internal/services/scanner/retry_test.go`
- Test retry with success on 2nd attempt
- Test max retries exceeded
- Test non-retryable error stops immediately
- Test context cancellation during retry
- Test backoff timing (with time mocking)
- Test jitter randomness

#### 1.2 Integrate Retry into Scanner (3 hours)

**File**: `internal/services/scanner/volume_scanner.go`

```go
// Add retry config to VolumeScanner struct
type VolumeScanner struct {
	// ... existing fields
	retryConfig RetryConfig
}

// Update NewVolumeScanner to accept retry config
func NewVolumeScanner(
	dockerService interfaces.DockerService,
	cache interfaces.Cache,
	metrics interfaces.MetricsCollector,
	logger *log.Logger,
	config coreModels.Config,
) interfaces.VolumeScanner {
	// ... existing code

	return &VolumeScanner{
		// ... existing fields
		retryConfig: DefaultRetryConfig(),
	}
}

// Add new method with retry support
func (vs *VolumeScanner) scanWithRetry(ctx context.Context, method interfaces.ScanMethod, volumeID, volumePath string) (*interfaces.ScanResult, error) {
	var result *interfaces.ScanResult

	err := RetryWithBackoff(ctx, vs.retryConfig, func() error {
		var attemptErr error
		result, attemptErr = vs.scanWithMethod(ctx, method, volumeID, volumePath)
		return attemptErr
	})

	return result, err
}

// Update ScanVolume to use scanWithRetry
func (vs *VolumeScanner) ScanVolume(ctx context.Context, volumeID string) (*interfaces.ScanResult, error) {
	// ... existing code (cache check, semaphore, volume path)

	// Try scan methods with retry
	var lastErr error
	for _, method := range vs.methods {
		if !method.Available() {
			continue
		}

		if vs.logger != nil {
			vs.logger.Printf("Starting volume scan with retry: volume=%s method=%s",
				volumeID, method.Name())
		}

		result, err := vs.scanWithRetry(ctx, method, volumeID, volumePath)
		if err != nil {
			if vs.logger != nil {
				vs.logger.Printf("Scan method %s failed after retries for volume %s: %v",
					method.Name(), volumeID, err)
			}
			lastErr = err
			continue
		}

		// ... existing success handling
		return result, nil
	}

	// All methods failed
	return nil, &coreModels.ScanError{
		VolumeID: volumeID,
		Code:     coreModels.ErrorCodeAllMethodsFailed,
		Message:  "all scan methods failed after retries",
		Err:      lastErr,
	}
}
```

**Configuration** (add to `internal/config/config.go`):
```go
type ScanningConfig struct {
	// ... existing fields

	// Retry configuration
	RetryEnabled       bool          `yaml:"retry_enabled" env:"RETRY_ENABLED" envDefault:"true"`
	RetryMaxAttempts   int           `yaml:"retry_max_attempts" env:"RETRY_MAX_ATTEMPTS" envDefault:"3"`
	RetryInitialBackoff time.Duration `yaml:"retry_initial_backoff" env:"RETRY_INITIAL_BACKOFF" envDefault:"1s"`
	RetryMaxBackoff    time.Duration `yaml:"retry_max_backoff" env:"RETRY_MAX_BACKOFF" envDefault:"30s"`
}
```

**Update `.env.example`**:
```bash
# SCAN RETRY CONFIGURATION
RETRY_ENABLED=true
RETRY_MAX_ATTEMPTS=3
RETRY_INITIAL_BACKOFF=1s
RETRY_MAX_BACKOFF=30s
```

#### 1.3 Add Timeout Handling (3 hours)

**File**: `internal/services/scanner/timeout.go`

```go
package scanner

import (
	"context"
	"time"
)

// TimeoutConfig holds timeout configuration
type TimeoutConfig struct {
	PerMethodTimeout time.Duration // Timeout for individual scan methods
	OverallTimeout   time.Duration // Total timeout for entire scan
	IndexingTimeout  time.Duration // Timeout for filesystem indexing
}

// DefaultTimeoutConfig returns sensible defaults
func DefaultTimeoutConfig() TimeoutConfig {
	return TimeoutConfig{
		PerMethodTimeout: 30 * time.Minute,
		OverallTimeout:   2 * time.Hour,
		IndexingTimeout:  4 * time.Hour,
	}
}

// EstimateTimeout estimates scan timeout based on volume characteristics
func (vs *VolumeScanner) estimateTimeout(volumeID string) time.Duration {
	// Try to get volume metadata for size estimation
	volume, err := vs.dockerService.GetVolume(context.Background(), volumeID)
	if err != nil {
		return vs.timeoutConfig.OverallTimeout
	}

	// Estimate based on volume size (if available from previous scans)
	if cachedResult := vs.cache.Get(volumeID); cachedResult != nil {
		// Rough heuristic: 1 hour per TB of data
		sizeInTB := float64(cachedResult.TotalSize) / (1024 * 1024 * 1024 * 1024)
		estimatedDuration := time.Duration(sizeInTB * float64(time.Hour))

		// Add 50% buffer
		estimatedDuration = time.Duration(float64(estimatedDuration) * 1.5)

		// Cap between min and max
		if estimatedDuration < 30*time.Minute {
			return 30 * time.Minute
		}
		if estimatedDuration > 8*time.Hour {
			return 8 * time.Hour
		}

		return estimatedDuration
	}

	// Default timeout
	return vs.timeoutConfig.OverallTimeout
}
```

**Update `async_scanner.go`**:
```go
func (vs *VolumeScanner) ScanVolumeAsync(ctx context.Context, volumeID string) (string, error) {
	scanID := fmt.Sprintf("scan_%s_%d", volumeID, time.Now().Unix())

	// Initialize progress
	if vs.progressManager != nil {
		vs.progressManager.StartScan(scanID, volumeID)
	}

	// Estimate timeout
	timeout := vs.estimateTimeout(volumeID)

	if vs.logger != nil {
		vs.logger.Printf("Starting async scan: scan_id=%s volume=%s timeout=%v",
			scanID, volumeID, timeout)
	}

	// Start scan with timeout
	go func() {
		// Add panic recovery
		defer func() {
			if r := recover(); r != nil {
				vs.logger.Printf("PANIC in scan goroutine: scan_id=%s volume=%s panic=%v\nStack: %s",
					scanID, volumeID, r, debug.Stack())

				if vs.progressManager != nil {
					vs.progressManager.FinishPhase(scanID, "volume_scan", false,
						fmt.Sprintf("panic: %v", r))
				}

				// Update database
				if vs.store != nil {
					vs.store.Scans().FailScanJob(context.Background(), scanID,
						fmt.Sprintf("panic: %v", r))
				}
			}
		}()

		// Create context with timeout
		scanCtx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		// Add scan ID to context
		scanCtx = context.WithValue(scanCtx, scanIDKey, scanID)

		result, err := vs.ScanVolume(scanCtx, volumeID)

		// Check for timeout specifically
		if errors.Is(err, context.DeadlineExceeded) {
			vs.logger.Printf("Scan timeout: scan_id=%s volume=%s timeout=%v",
				scanID, volumeID, timeout)

			if vs.progressManager != nil {
				vs.progressManager.FinishPhase(scanID, "volume_scan", false,
					fmt.Sprintf("timeout after %v", timeout))
			}

			if vs.store != nil {
				vs.store.Scans().FailScanJob(context.Background(), scanID,
					fmt.Sprintf("timeout after %v", timeout))
			}
			return
		}

		// ... existing error/success handling
	}()

	return scanID, nil
}
```

**Configuration** (add to `config.go`):
```go
type ScanningConfig struct {
	// ... existing fields

	// Timeout configuration
	PerMethodTimeout time.Duration `yaml:"per_method_timeout" env:"PER_METHOD_TIMEOUT" envDefault:"30m"`
	OverallTimeout   time.Duration `yaml:"overall_timeout" env:"OVERALL_TIMEOUT" envDefault:"2h"`
	IndexingTimeout  time.Duration `yaml:"indexing_timeout" env:"INDEXING_TIMEOUT" envDefault:"4h"`
}
```

#### 1.4 Add Panic Recovery (2 hours)

Already covered in 1.3 above, but add additional panic recovery in:
- `performFilesystemIndexing`
- Any worker pool goroutines
- Preview generation goroutines

**File**: `internal/services/scanner/panic_handler.go`

```go
package scanner

import (
	"fmt"
	"log"
	"runtime/debug"
)

// SafeGo runs a function in a goroutine with panic recovery
func SafeGo(logger *log.Logger, name string, fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				if logger != nil {
					logger.Printf("PANIC in goroutine %s: %v\nStack: %s",
						name, r, debug.Stack())
				}
			}
		}()

		fn()
	}()
}

// RecoverPanic is a defer function that recovers from panics and logs them
func RecoverPanic(logger *log.Logger, context string) {
	if r := recover(); r != nil {
		if logger != nil {
			logger.Printf("PANIC in %s: %v\nStack: %s",
				context, r, debug.Stack())
		}
	}
}
```

**Usage**:
```go
// Replace all bare `go func()` with SafeGo
SafeGo(vs.logger, "filesystem-indexing", func() {
	vs.performFilesystemIndexing(ctx, volumeID, volumePath, scanID)
})
```

#### 1.5 Add Circuit Breaker (4 hours)

**File**: `internal/services/scanner/circuit_breaker.go`

```go
package scanner

import (
	"errors"
	"sync"
	"time"
)

var (
	ErrCircuitOpen = errors.New("circuit breaker is open")
)

// CircuitBreakerState represents the state of a circuit breaker
type CircuitBreakerState string

const (
	StateClosed   CircuitBreakerState = "closed"
	StateOpen     CircuitBreakerState = "open"
	StateHalfOpen CircuitBreakerState = "half-open"
)

// CircuitBreaker prevents cascading failures by stopping requests after threshold
type CircuitBreaker struct {
	mu sync.RWMutex

	// Configuration
	failureThreshold int
	successThreshold int
	resetTimeout     time.Duration

	// State
	state           CircuitBreakerState
	failures        int
	successes       int
	lastFailureTime time.Time
	lastStateChange time.Time
}

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(failureThreshold, successThreshold int, resetTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		failureThreshold: failureThreshold,
		successThreshold: successThreshold,
		resetTimeout:     resetTimeout,
		state:           StateClosed,
		lastStateChange: time.Now(),
	}
}

// Call executes the function if circuit is closed
func (cb *CircuitBreaker) Call(fn func() error) error {
	cb.mu.Lock()

	// Check if we should transition from open to half-open
	if cb.state == StateOpen {
		if time.Since(cb.lastFailureTime) > cb.resetTimeout {
			cb.state = StateHalfOpen
			cb.successes = 0
			cb.lastStateChange = time.Now()
		} else {
			cb.mu.Unlock()
			return ErrCircuitOpen
		}
	}

	cb.mu.Unlock()

	// Execute function
	err := fn()

	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		cb.onFailure()
		return err
	}

	cb.onSuccess()
	return nil
}

func (cb *CircuitBreaker) onFailure() {
	cb.failures++
	cb.lastFailureTime = time.Now()

	if cb.state == StateHalfOpen {
		// Failed in half-open state, go back to open
		cb.state = StateOpen
		cb.failures = 0
		cb.lastStateChange = time.Now()
		return
	}

	if cb.failures >= cb.failureThreshold {
		cb.state = StateOpen
		cb.lastStateChange = time.Now()
	}
}

func (cb *CircuitBreaker) onSuccess() {
	cb.failures = 0

	if cb.state == StateHalfOpen {
		cb.successes++
		if cb.successes >= cb.successThreshold {
			cb.state = StateClosed
			cb.successes = 0
			cb.lastStateChange = time.Now()
		}
	}
}

// GetState returns current circuit breaker state
func (cb *CircuitBreaker) GetState() CircuitBreakerState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Reset manually resets the circuit breaker
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.state = StateClosed
	cb.failures = 0
	cb.successes = 0
	cb.lastStateChange = time.Now()
}
```

**Integration** (update `volume_scanner.go`):
```go
type VolumeScanner struct {
	// ... existing fields
	circuitBreaker *CircuitBreaker
}

func NewVolumeScanner(...) interfaces.VolumeScanner {
	// ... existing code

	return &VolumeScanner{
		// ... existing fields
		circuitBreaker: NewCircuitBreaker(
			5,              // Open after 5 failures
			2,              // Close after 2 successes
			1 * time.Minute, // Try again after 1 minute
		),
	}
}

func (vs *VolumeScanner) ScanVolume(ctx context.Context, volumeID string) (*interfaces.ScanResult, error) {
	// Check circuit breaker
	err := vs.circuitBreaker.Call(func() error {
		// Existing scan logic moved here
		return nil
	})

	if errors.Is(err, ErrCircuitOpen) {
		return nil, &coreModels.ScanError{
			VolumeID: volumeID,
			Code:     "CIRCUIT_BREAKER_OPEN",
			Message:  "circuit breaker is open, too many recent failures",
		}
	}

	return nil, err
}
```

#### 1.6 Improve Error Context & Logging (4 hours)

**File**: `internal/services/scanner/structured_logging.go`

```go
package scanner

import (
	"context"
	"log"
)

// LogFields represents structured log fields
type LogFields map[string]interface{}

// StructuredLogger wraps standard logger with structured logging
type StructuredLogger struct {
	logger *log.Logger
}

func NewStructuredLogger(logger *log.Logger) *StructuredLogger {
	return &StructuredLogger{logger: logger}
}

func (sl *StructuredLogger) Info(msg string, fields LogFields) {
	sl.logger.Printf("[INFO] %s %v", msg, fields)
}

func (sl *StructuredLogger) Error(msg string, err error, fields LogFields) {
	if fields == nil {
		fields = LogFields{}
	}
	fields["error"] = err.Error()
	sl.logger.Printf("[ERROR] %s %v", msg, fields)
}

func (sl *StructuredLogger) Warn(msg string, fields LogFields) {
	sl.logger.Printf("[WARN] %s %v", msg, fields)
}
```

**Update scanner logging**:
```go
// Replace all logger.Printf with structured logging
vs.structuredLogger.Error("Scan method failed", err, LogFields{
	"scan_id":   scanID,
	"volume_id": volumeID,
	"method":    method.Name(),
	"attempt":   attempt,
	"retryable": IsRetryable(err),
})
```

---

### Phase 2: Checkpoint & Recovery (Week 2 - 20 hours)

**Goal**: Enable scans to resume after crashes or interruptions

#### 2.1 Design Checkpoint Schema (2 hours)

**Migration**: `migrations/postgresql/000009_add_scan_checkpoints.up.sql`

```sql
-- Scan checkpoints for crash recovery
CREATE TABLE scan_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    volume_id TEXT NOT NULL,
    checkpoint_type TEXT NOT NULL, -- 'volume_scan', 'filesystem_indexing', 'enrichment'

    -- Progress state
    phase TEXT NOT NULL,
    progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    -- Counters
    items_processed BIGINT NOT NULL DEFAULT 0,
    bytes_processed BIGINT NOT NULL DEFAULT 0,
    errors_count BIGINT NOT NULL DEFAULT 0,

    -- Current position for resume
    last_path TEXT,
    last_depth INTEGER,
    resume_data JSONB, -- Method-specific resume data

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexes
    CONSTRAINT unique_scan_checkpoint UNIQUE (scan_id, checkpoint_type)
);

CREATE INDEX idx_scan_checkpoints_scan_id ON scan_checkpoints(scan_id);
CREATE INDEX idx_scan_checkpoints_volume_id ON scan_checkpoints(volume_id);
CREATE INDEX idx_scan_checkpoints_created_at ON scan_checkpoints(created_at);

-- Cleanup old checkpoints (retention policy)
CREATE INDEX idx_scan_checkpoints_cleanup ON scan_checkpoints(created_at)
WHERE created_at < NOW() - INTERVAL '7 days';
```

#### 2.2 Implement Checkpoint Repository (4 hours)

**File**: `internal/repo/queries-postgresql/checkpoints.sql`

```sql
-- name: CreateCheckpoint :one
INSERT INTO scan_checkpoints (
    scan_id, volume_id, checkpoint_type, phase, progress,
    items_processed, bytes_processed, errors_count,
    last_path, last_depth, resume_data
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
ON CONFLICT (scan_id, checkpoint_type)
DO UPDATE SET
    phase = EXCLUDED.phase,
    progress = EXCLUDED.progress,
    items_processed = EXCLUDED.items_processed,
    bytes_processed = EXCLUDED.bytes_processed,
    errors_count = EXCLUDED.errors_count,
    last_path = EXCLUDED.last_path,
    last_depth = EXCLUDED.last_depth,
    resume_data = EXCLUDED.resume_data,
    created_at = NOW()
RETURNING *;

-- name: GetCheckpoint :one
SELECT * FROM scan_checkpoints
WHERE scan_id = $1 AND checkpoint_type = $2
ORDER BY created_at DESC
LIMIT 1;

-- name: GetLatestCheckpoints :many
SELECT * FROM scan_checkpoints
WHERE scan_id = $1
ORDER BY created_at DESC;

-- name: DeleteCheckpoint :exec
DELETE FROM scan_checkpoints
WHERE scan_id = $1 AND checkpoint_type = $2;

-- name: DeleteOldCheckpoints :exec
DELETE FROM scan_checkpoints
WHERE created_at < $1;
```

**Generate SQLC**: `sqlc generate`

**File**: `internal/repo/checkpoint_repo.go`

```go
package repo

import (
	"context"
	"encoding/json"
	"time"

	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

type CheckpointRepo interface {
	SaveCheckpoint(ctx context.Context, checkpoint ScanCheckpoint) error
	LoadCheckpoint(ctx context.Context, scanID, checkpointType string) (*ScanCheckpoint, error)
	DeleteCheckpoint(ctx context.Context, scanID, checkpointType string) error
	CleanupOldCheckpoints(ctx context.Context, olderThan time.Time) error
}

type ScanCheckpoint struct {
	ScanID         string
	VolumeID       string
	CheckpointType string
	Phase          string
	Progress       float64
	ItemsProcessed int64
	BytesProcessed int64
	ErrorsCount    int64
	LastPath       string
	LastDepth      int
	ResumeData     map[string]interface{}
	CreatedAt      time.Time
}

type checkpointRepo struct {
	queries *sqlc.Queries
}

func NewCheckpointRepo(queries *sqlc.Queries) CheckpointRepo {
	return &checkpointRepo{queries: queries}
}

func (r *checkpointRepo) SaveCheckpoint(ctx context.Context, checkpoint ScanCheckpoint) error {
	resumeDataJSON, err := json.Marshal(checkpoint.ResumeData)
	if err != nil {
		return err
	}

	_, err = r.queries.CreateCheckpoint(ctx, sqlc.CreateCheckpointParams{
		ScanID:         checkpoint.ScanID,
		VolumeID:       checkpoint.VolumeID,
		CheckpointType: checkpoint.CheckpointType,
		Phase:          checkpoint.Phase,
		Progress:       checkpoint.Progress,
		ItemsProcessed: checkpoint.ItemsProcessed,
		BytesProcessed: checkpoint.BytesProcessed,
		ErrorsCount:    checkpoint.ErrorsCount,
		LastPath:       sql.NullString{String: checkpoint.LastPath, Valid: checkpoint.LastPath != ""},
		LastDepth:      sql.NullInt32{Int32: int32(checkpoint.LastDepth), Valid: checkpoint.LastDepth > 0},
		ResumeData:     resumeDataJSON,
	})

	return err
}

func (r *checkpointRepo) LoadCheckpoint(ctx context.Context, scanID, checkpointType string) (*ScanCheckpoint, error) {
	row, err := r.queries.GetCheckpoint(ctx, sqlc.GetCheckpointParams{
		ScanID:         scanID,
		CheckpointType: checkpointType,
	})
	if err != nil {
		return nil, err
	}

	var resumeData map[string]interface{}
	if err := json.Unmarshal(row.ResumeData, &resumeData); err != nil {
		return nil, err
	}

	return &ScanCheckpoint{
		ScanID:         row.ScanID,
		VolumeID:       row.VolumeID,
		CheckpointType: row.CheckpointType,
		Phase:          row.Phase,
		Progress:       row.Progress,
		ItemsProcessed: row.ItemsProcessed,
		BytesProcessed: row.BytesProcessed,
		ErrorsCount:    row.ErrorsCount,
		LastPath:       row.LastPath.String,
		LastDepth:      int(row.LastDepth.Int32),
		ResumeData:     resumeData,
		CreatedAt:      row.CreatedAt,
	}, nil
}
```

#### 2.3 Implement Checkpointing in Scanner (6 hours)

**File**: `internal/services/scanner/checkpointing.go`

```go
package scanner

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/repo"
)

// CheckpointInterval determines how often to save checkpoints
const CheckpointInterval = 5 * time.Minute

// StartCheckpointing begins periodic checkpointing for a scan
func (vs *VolumeScanner) StartCheckpointing(ctx context.Context, scanID, volumeID string) {
	ticker := time.NewTicker(CheckpointInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			vs.saveCheckpoint(ctx, scanID, volumeID)
		case <-ctx.Done():
			// Save final checkpoint before exit
			vs.saveCheckpoint(context.Background(), scanID, volumeID)
			return
		}
	}
}

func (vs *VolumeScanner) saveCheckpoint(ctx context.Context, scanID, volumeID string) {
	if vs.store == nil {
		return
	}

	// Get current progress
	progress, err := vs.GetScanProgress(scanID)
	if err != nil {
		if vs.logger != nil {
			vs.logger.Printf("Failed to get progress for checkpoint: scan_id=%s error=%v",
				scanID, err)
		}
		return
	}

	checkpointRepo := vs.store.Checkpoints()

	// Save volume scan checkpoint
	if err := checkpointRepo.SaveCheckpoint(ctx, repo.ScanCheckpoint{
		ScanID:         scanID,
		VolumeID:       volumeID,
		CheckpointType: "volume_scan",
		Phase:          progress.Phase,
		Progress:       progress.Progress,
		ItemsProcessed: progress.FilesScanned,
		BytesProcessed: progress.BytesProcessed,
		ErrorsCount:    progress.ErrorsCount,
		ResumeData: map[string]interface{}{
			"method":       progress.Method,
			"started_at":   progress.StartedAt,
			"files_scanned": progress.FilesScanned,
		},
	}); err != nil && vs.logger != nil {
		vs.logger.Printf("Failed to save checkpoint: scan_id=%s error=%v", scanID, err)
	}

	// Save filesystem indexing checkpoint if active
	if progress.Phase == "filesystem_indexing" {
		if err := checkpointRepo.SaveCheckpoint(ctx, repo.ScanCheckpoint{
			ScanID:         scanID,
			VolumeID:       volumeID,
			CheckpointType: "filesystem_indexing",
			Phase:          progress.Phase,
			Progress:       progress.PhaseProgress,
			ItemsProcessed: progress.FilesScanned,
			BytesProcessed: progress.BytesProcessed,
			ErrorsCount:    progress.ErrorsCount,
			LastPath:       progress.CurrentPath,
			LastDepth:      progress.CurrentDepth,
			ResumeData: map[string]interface{}{
				"folders_scanned": progress.FoldersScanned,
				"files_scanned":   progress.FilesScanned,
			},
		}); err != nil && vs.logger != nil {
			vs.logger.Printf("Failed to save indexing checkpoint: scan_id=%s error=%v", scanID, err)
		}
	}
}

// ResumeScan attempts to resume a scan from checkpoint
func (vs *VolumeScanner) ResumeScan(ctx context.Context, scanID string) error {
	if vs.store == nil {
		return fmt.Errorf("cannot resume scan: store not available")
	}

	checkpointRepo := vs.store.Checkpoints()

	// Load volume scan checkpoint
	checkpoint, err := checkpointRepo.LoadCheckpoint(ctx, scanID, "volume_scan")
	if err != nil {
		return fmt.Errorf("failed to load checkpoint: %w", err)
	}

	if vs.logger != nil {
		vs.logger.Printf("Resuming scan from checkpoint: scan_id=%s progress=%.2f%%",
			scanID, checkpoint.Progress*100)
	}

	// Reinitialize progress manager with checkpoint data
	if vs.progressManager != nil {
		vs.progressManager.StartScan(scanID, checkpoint.VolumeID)
		vs.progressManager.UpdateProgress(scanID, ProgressUpdate{
			Type:           "volume_scan",
			Progress:       checkpoint.Progress,
			ItemsProcessed: checkpoint.ItemsProcessed,
		})
	}

	// Continue scan from checkpoint
	// Implementation depends on scan phase
	switch checkpoint.Phase {
	case "volume_scan":
		// Volume scan completed, start indexing
		return vs.resumeFilesystemIndexing(ctx, scanID, checkpoint.VolumeID)
	case "filesystem_indexing":
		return vs.resumeFilesystemIndexing(ctx, scanID, checkpoint.VolumeID)
	default:
		return fmt.Errorf("unknown checkpoint phase: %s", checkpoint.Phase)
	}
}

func (vs *VolumeScanner) resumeFilesystemIndexing(ctx context.Context, scanID, volumeID string) error {
	// Load indexing checkpoint
	checkpointRepo := vs.store.Checkpoints()
	checkpoint, err := checkpointRepo.LoadCheckpoint(ctx, scanID, "filesystem_indexing")
	if err != nil {
		// No indexing checkpoint, start from beginning
		return vs.startFilesystemIndexing(ctx, scanID, volumeID)
	}

	// Resume indexing from last known position
	if vs.filesystemIndexer != nil {
		return vs.filesystemIndexer.ResumeIndexing(ctx, volumeID, checkpoint.LastPath)
	}

	return nil
}
```

#### 2.4 Update Async Scanner for Auto-Resume (4 hours)

**File**: Update `async_scanner.go`

```go
func (vs *VolumeScanner) ScanVolumeAsync(ctx context.Context, volumeID string) (string, error) {
	// Check if there's an existing incomplete scan we can resume
	if existingScanID := vs.findResumableScan(volumeID); existingScanID != "" {
		if vs.logger != nil {
			vs.logger.Printf("Found resumable scan: scan_id=%s volume=%s", existingScanID, volumeID)
		}

		// Resume existing scan
		go func() {
			defer RecoverPanic(vs.logger, fmt.Sprintf("resume-scan-%s", existingScanID))

			if err := vs.ResumeScan(context.Background(), existingScanID); err != nil {
				vs.logger.Printf("Failed to resume scan: scan_id=%s error=%v", existingScanID, err)
				// Fall back to new scan
			}
		}()

		return existingScanID, nil
	}

	// Start new scan
	scanID := fmt.Sprintf("scan_%s_%d", volumeID, time.Now().Unix())

	// ... existing code

	go func() {
		defer RecoverPanic(vs.logger, fmt.Sprintf("scan-%s", scanID))

		// Start checkpointing
		checkpointCtx, cancelCheckpoint := context.WithCancel(context.Background())
		defer cancelCheckpoint()

		SafeGo(vs.logger, fmt.Sprintf("checkpointing-%s", scanID), func() {
			vs.StartCheckpointing(checkpointCtx, scanID, volumeID)
		})

		// ... existing scan logic
	}()

	return scanID, nil
}

func (vs *VolumeScanner) findResumableScan(volumeID string) string {
	if vs.store == nil {
		return ""
	}

	// Query for incomplete scans for this volume
	scansRepo := vs.store.Scans()
	scans, err := scansRepo.GetIncompleteScansByVolume(context.Background(), volumeID)
	if err != nil || len(scans) == 0 {
		return ""
	}

	// Return most recent incomplete scan
	return scans[0].ScanID
}
```

#### 2.5 Add Cleanup Job for Old Checkpoints (2 hours)

**File**: `internal/services/scanner/checkpoint_cleanup_job.go`

```go
package scanner

import (
	"context"
	"time"
)

type CheckpointCleanupJob struct {
	store store.Store
}

func NewCheckpointCleanupJob(store store.Store) *CheckpointCleanupJob {
	return &CheckpointCleanupJob{store: store}
}

func (j *CheckpointCleanupJob) Name() string {
	return "checkpoint-cleanup"
}

func (j *CheckpointCleanupJob) Description() string {
	return "Clean up old scan checkpoints (older than 7 days)"
}

func (j *CheckpointCleanupJob) Run(ctx context.Context) error {
	cutoff := time.Now().Add(-7 * 24 * time.Hour)
	return j.store.Checkpoints().CleanupOldCheckpoints(ctx, cutoff)
}
```

**Register in scheduler** (update `router.go`):
```go
// Register checkpoint cleanup job
checkpointCleanup := scanner.NewCheckpointCleanupJob(storeInstance)
sched.Register(checkpointCleanup, 24*time.Hour, false)
```

#### 2.6 Add Tests (2 hours)

**File**: `internal/services/scanner/checkpointing_test.go`
- Test checkpoint save/load
- Test resume from checkpoint
- Test checkpoint cleanup
- Test concurrent checkpoint writes

---

### Phase 3: Transaction Safety & Database Consistency (Week 3 - 12 hours)

**Goal**: Ensure database state remains consistent across crashes

#### 3.1 Add Transaction Wrapper (4 hours)

**File**: `internal/store/transaction.go`

```go
package store

import (
	"context"
	"database/sql"
	"fmt"
)

// TxFunc is a function that runs within a transaction
type TxFunc func(context.Context, *sql.Tx) error

// WithTransaction executes a function within a database transaction
func (s *StoreImpl) WithTransaction(ctx context.Context, fn TxFunc) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p) // Re-throw panic after rollback
		}
	}()

	if err := fn(ctx, tx); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("transaction error: %v, rollback error: %w", err, rbErr)
		}
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
```

#### 3.2 Update Scan Initialization to Use Transactions (4 hours)

**Update `async_scanner.go`**:
```go
// Initialize database progress tracking with transaction
if vs.store != nil {
	go func() {
		ctx := context.Background()

		// Use transaction to ensure atomicity
		err := vs.store.WithTransaction(ctx, func(ctx context.Context, tx *sql.Tx) error {
			// Create scan job
			scansRepo := vs.store.Scans()
			scanJob := coreModels.CreateScanJobParams{
				ScanID:   scanID,
				VolumeID: volumeID,
				Status:   "pending",
				Method:   "async",
			}

			if _, err := scansRepo.CreateScanJob(ctx, scanJob); err != nil {
				return fmt.Errorf("failed to create scan job: %w", err)
			}

			// Initialize progress tracking
			if err := vs.initializeDatabaseProgress(ctx, scanID, volumeID); err != nil {
				return fmt.Errorf("failed to initialize progress: %w", err)
			}

			return nil
		})

		if err != nil && vs.logger != nil {
			vs.logger.Printf("Failed to initialize scan in database: scan_id=%s error=%v",
				scanID, err)
		}
	}()
}
```

#### 3.3 Add Idempotency Keys (2 hours)

**Migration**: `migrations/postgresql/000010_add_idempotency.up.sql`

```sql
-- Add idempotency key to prevent duplicate operations
ALTER TABLE scan_jobs ADD COLUMN idempotency_key TEXT UNIQUE;
CREATE INDEX idx_scan_jobs_idempotency_key ON scan_jobs(idempotency_key);
```

**Usage**:
```go
// Generate idempotency key from request
idempotencyKey := fmt.Sprintf("%s:%s:%d", operation, volumeID, timestamp)

// Check if operation already completed
if existingResult := checkIdempotency(idempotencyKey); existingResult != nil {
	return existingResult, nil
}
```

#### 3.4 Add Distributed Lock (2 hours)

**File**: `internal/services/scanner/distributed_lock.go`

```go
package scanner

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// DistributedLock provides database-backed distributed locking
type DistributedLock struct {
	db      *sql.DB
	lockKey string
	timeout time.Duration
}

func NewDistributedLock(db *sql.DB, lockKey string, timeout time.Duration) *DistributedLock {
	return &DistributedLock{
		db:      db,
		lockKey: lockKey,
		timeout: timeout,
	}
}

// Acquire attempts to acquire the lock
func (dl *DistributedLock) Acquire(ctx context.Context) (bool, error) {
	// PostgreSQL advisory lock
	var acquired bool
	query := `SELECT pg_try_advisory_lock($1)`

	lockID := hashLockKey(dl.lockKey)
	err := dl.db.QueryRowContext(ctx, query, lockID).Scan(&acquired)
	if err != nil {
		return false, fmt.Errorf("failed to acquire lock: %w", err)
	}

	return acquired, nil
}

// Release releases the lock
func (dl *DistributedLock) Release(ctx context.Context) error {
	query := `SELECT pg_advisory_unlock($1)`
	lockID := hashLockKey(dl.lockKey)

	var released bool
	err := dl.db.QueryRowContext(ctx, query, lockID).Scan(&released)
	if err != nil {
		return fmt.Errorf("failed to release lock: %w", err)
	}

	if !released {
		return fmt.Errorf("lock was not held")
	}

	return nil
}

func hashLockKey(key string) int64 {
	// Simple hash function for lock key
	h := fnv.New64a()
	h.Write([]byte(key))
	return int64(h.Sum64())
}
```

**Usage** (prevent duplicate scans):
```go
func (vs *VolumeScanner) ScanVolumeAsync(ctx context.Context, volumeID string) (string, error) {
	// Try to acquire lock for this volume
	lock := NewDistributedLock(vs.store.DB(), fmt.Sprintf("scan:%s", volumeID), 5*time.Second)

	acquired, err := lock.Acquire(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to acquire scan lock: %w", err)
	}

	if !acquired {
		return "", &coreModels.ScanError{
			VolumeID: volumeID,
			Code:     "SCAN_ALREADY_RUNNING",
			Message:  "scan is already running for this volume",
		}
	}

	defer lock.Release(context.Background())

	// ... continue with scan
}
```

---

### Phase 4: Testing & Documentation (Week 3 cont. - 8 hours)

#### 4.1 Integration Tests (4 hours)

**File**: `internal/services/scanner/resilience_integration_test.go`

```go
package scanner

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRetryOnTransientFailure(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	// Simulate transient failure that succeeds on retry
	attempts := 0
	mockMethod := &MockScanMethod{
		ScanFunc: func(ctx context.Context, path string) (*ScanResult, error) {
			attempts++
			if attempts < 3 {
				return nil, &RetryableError{
					Err:     errors.New("network timeout"),
					Message: "temporary network issue",
				}
			}
			return &ScanResult{TotalSize: 1000}, nil
		},
	}

	scanner.methods = []ScanMethod{mockMethod}

	result, err := scanner.ScanVolume(context.Background(), "test-volume")

	require.NoError(t, err)
	assert.Equal(t, 3, attempts)
	assert.Equal(t, int64(1000), result.TotalSize)
}

func TestTimeoutHandling(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	// Simulate long-running scan
	mockMethod := &MockScanMethod{
		ScanFunc: func(ctx context.Context, path string) (*ScanResult, error) {
			select {
			case <-time.After(10 * time.Second):
				return &ScanResult{}, nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		},
	}

	scanner.methods = []ScanMethod{mockMethod}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	_, err := scanner.ScanVolume(ctx, "test-volume")

	assert.Error(t, err)
	assert.True(t, errors.Is(err, context.DeadlineExceeded))
}

func TestCheckpointAndResume(t *testing.T) {
	scanner, store := setupTestScannerWithDB(t)

	// Start scan
	scanID, err := scanner.ScanVolumeAsync(context.Background(), "test-volume")
	require.NoError(t, err)

	// Wait for checkpoint
	time.Sleep(CheckpointInterval + 1*time.Second)

	// Simulate crash - get checkpoint
	checkpoint, err := store.Checkpoints().LoadCheckpoint(context.Background(), scanID, "volume_scan")
	require.NoError(t, err)
	assert.NotNil(t, checkpoint)

	// Resume scan
	err = scanner.ResumeScan(context.Background(), scanID)
	assert.NoError(t, err)
}

func TestCircuitBreakerOpensAfterFailures(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	// Simulate repeated failures
	mockMethod := &MockScanMethod{
		ScanFunc: func(ctx context.Context, path string) (*ScanResult, error) {
			return nil, &RetryableError{
				Err:     errors.New("service unavailable"),
				Message: "downstream service down",
			}
		},
	}

	scanner.methods = []ScanMethod{mockMethod}

	// First 5 attempts should fail with retry
	for i := 0; i < 5; i++ {
		_, err := scanner.ScanVolume(context.Background(), "test-volume")
		assert.Error(t, err)
	}

	// Circuit breaker should now be open
	assert.Equal(t, StateOpen, scanner.circuitBreaker.GetState())

	// Next attempt should fail immediately
	_, err := scanner.ScanVolume(context.Background(), "test-volume")
	assert.True(t, errors.Is(err, ErrCircuitOpen))
}

func TestPanicRecovery(t *testing.T) {
	scanner, _, _, _ := setupTestScanner()

	// Simulate panic in scan goroutine
	mockMethod := &MockScanMethod{
		ScanFunc: func(ctx context.Context, path string) (*ScanResult, error) {
			panic("unexpected error")
		},
	}

	scanner.methods = []ScanMethod{mockMethod}

	// Should not crash the test
	scanID, err := scanner.ScanVolumeAsync(context.Background(), "test-volume")
	require.NoError(t, err)

	// Wait for panic to be caught
	time.Sleep(1 * time.Second)

	// Check that scan is marked as failed
	progress, err := scanner.GetScanProgress(scanID)
	require.NoError(t, err)
	assert.Equal(t, "failed", progress.Status)
	assert.Contains(t, progress.Error, "panic")
}
```

#### 4.2 Load Testing (2 hours)

**File**: `internal/services/scanner/load_test.go`

```go
package scanner

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestConcurrentScans(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping load test in short mode")
	}

	scanner, _, _, _ := setupTestScanner()

	// Start 20 concurrent scans
	var wg sync.WaitGroup
	errors := make(chan error, 20)

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(volumeID string) {
			defer wg.Done()

			scanID, err := scanner.ScanVolumeAsync(context.Background(), volumeID)
			if err != nil {
				errors <- err
				return
			}

			// Wait for completion (with timeout)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			ticker := time.NewTicker(1 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case <-ticker.C:
					progress, err := scanner.GetScanProgress(scanID)
					if err != nil {
						errors <- err
						return
					}

					if progress.Status == "completed" || progress.Status == "failed" {
						return
					}
				case <-ctx.Done():
					errors <- ctx.Err()
					return
				}
			}
		}(fmt.Sprintf("volume-%d", i))
	}

	wg.Wait()
	close(errors)

	// Check for errors
	var errorCount int
	for err := range errors {
		t.Logf("Scan error: %v", err)
		errorCount++
	}

	assert.Equal(t, 0, errorCount, "Expected no errors in concurrent scans")
}
```

#### 4.3 Documentation (2 hours)

**File**: `docs/scanner-resilience.md`

```markdown
# Volume Scanner Resilience Guide

## Overview

The VolumeViz scanner includes production-grade resilience features:

- **Retry Logic**: Automatic retries with exponential backoff
- **Timeout Handling**: Configurable timeouts per method and overall
- **Crash Recovery**: Checkpoint-based resume capability
- **Panic Recovery**: Graceful handling of unexpected errors
- **Circuit Breaker**: Prevent cascading failures
- **Transaction Safety**: ACID guarantees for database operations

## Configuration

### Retry Configuration

```bash
RETRY_ENABLED=true
RETRY_MAX_ATTEMPTS=3
RETRY_INITIAL_BACKOFF=1s
RETRY_MAX_BACKOFF=30s
```

### Timeout Configuration

```bash
PER_METHOD_TIMEOUT=30m
OVERALL_TIMEOUT=2h
INDEXING_TIMEOUT=4h
```

### Circuit Breaker

The circuit breaker opens after 5 consecutive failures and resets after 1 minute.

## Checkpoint & Resume

Scans are automatically checkpointed every 5 minutes. If a scan fails or is interrupted:

1. Checkpoint is saved to database
2. Next scan attempt detects existing checkpoint
3. Scan resumes from last known position

### Manual Resume

```bash
# Find incomplete scans
GET /api/v1/scans?status=incomplete

# Resume specific scan
POST /api/v1/scans/{scan_id}/resume
```

## Monitoring

### Metrics

- `scan_retries_total`: Count of retry attempts
- `scan_timeouts_total`: Count of timeout errors
- `circuit_breaker_state`: Current circuit breaker state (0=closed, 1=open, 2=half-open)
- `checkpoint_save_duration`: Time to save checkpoints

### Logs

All resilience events are logged with structured fields:

```
[INFO] Retrying scan: scan_id=scan_123 volume_id=vol_456 attempt=2 backoff=2s
[WARN] Circuit breaker opened: failure_count=5
[INFO] Resuming scan from checkpoint: scan_id=scan_123 progress=45%
```

## Best Practices

1. **Large Volumes**: Set higher timeouts for multi-TB volumes
2. **Unreliable Networks**: Increase retry attempts and backoff
3. **Production**: Enable checkpointing for crash recovery
4. **Monitoring**: Alert on circuit breaker open state

## Troubleshooting

### Scans Timing Out

Increase `OVERALL_TIMEOUT` or `INDEXING_TIMEOUT` based on volume size.

### Circuit Breaker Open

Check logs for underlying error. Reset circuit breaker:

```bash
POST /api/v1/scanner/circuit-breaker/reset
```

### Resume Failing

Check checkpoint table for corruption:

```sql
SELECT * FROM scan_checkpoints WHERE scan_id = 'scan_123';
```
```

---

## Success Criteria

After implementation, the scanner should:

1. ✅ **Retry transient failures** automatically (3 attempts with exponential backoff)
2. ✅ **Timeout gracefully** after configured duration
3. ✅ **Resume after crashes** using checkpoints (5-minute intervals)
4. ✅ **Never crash from panics** (all goroutines have recovery)
5. ✅ **Maintain consistency** (transactional database writes)
6. ✅ **Prevent cascading failures** (circuit breaker after 5 failures)
7. ✅ **Log with context** (scan_id, volume_id in all log entries)

---

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| Transient failure handling | ❌ Fails immediately | ✅ Retries 3x |
| Large scan timeout | ❌ Runs forever | ✅ 2hr default timeout |
| Crash recovery | ❌ Restart from 0% | ✅ Resume from checkpoint |
| Panic handling | ❌ Silent goroutine death | ✅ Logged & tracked |
| DB consistency | ⚠️ Partial writes | ✅ Transactional |
| Cascading failures | ❌ No protection | ✅ Circuit breaker |
| **Overall Rating** | 6.5/10 | 9/10 |

---

## Rollout Plan

1. **Week 1**: Implement & test retry + timeout logic
2. **Week 2**: Implement & test checkpoint/resume
3. **Week 3**: Transaction safety + load testing
4. **Week 4**: Deployment to staging, monitoring, production rollout

---

## Future Enhancements (Post-MVP)

- **Adaptive timeouts** based on volume size and historical data
- **Priority queuing** for critical volumes
- **Distributed tracing** integration (OpenTelemetry)
- **Rate limiting** per Docker host
- **Smart retry strategies** (retry different method on failure)
- **Checkpoint compression** for large resume data

---

*Created: October 4, 2025*
*Owner: Engineering Team*
*Timeline: 3 weeks (40-60 hours)*
*Status: Planned*
