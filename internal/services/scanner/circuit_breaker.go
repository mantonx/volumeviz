package scanner

import (
	"errors"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
)

var (
	// ErrCircuitOpen is returned when the circuit breaker is open
	ErrCircuitOpen = errors.New("circuit breaker is open")
)

// CircuitBreakerState represents the state of a circuit breaker
type CircuitBreakerState string

const (
	// StateClosed means requests pass through normally
	StateClosed CircuitBreakerState = "closed"
	// StateOpen means requests are blocked
	StateOpen CircuitBreakerState = "open"
	// StateHalfOpen means limited requests are allowed to test recovery
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
		state:            StateClosed,
		lastStateChange:  time.Now(),
	}
}

// Call executes the function if circuit is closed or half-open
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

// onFailure handles a failed request
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

// onSuccess handles a successful request
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

// GetStats returns current circuit breaker statistics
func (cb *CircuitBreaker) GetStats() map[string]interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	return map[string]interface{}{
		"state":             string(cb.state),
		"failures":          cb.failures,
		"successes":         cb.successes,
		"last_failure_time": cb.lastFailureTime,
		"last_state_change": cb.lastStateChange,
		"failure_threshold": cb.failureThreshold,
		"success_threshold": cb.successThreshold,
		"reset_timeout":     cb.resetTimeout,
	}
}

// Reset manually resets the circuit breaker to closed state
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.state = StateClosed
	cb.failures = 0
	cb.successes = 0
	cb.lastStateChange = time.Now()
}

// newCircuitBreakersForMethods builds one CircuitBreaker per scan method,
// keyed by name, so a failing method (e.g. diskus erroring repeatedly) trips
// only its own breaker rather than blocking every other method too.
func newCircuitBreakersForMethods(methods []interfaces.ScanMethod, enabled bool) map[string]*CircuitBreaker {
	breakers := make(map[string]*CircuitBreaker, len(methods))
	for _, method := range methods {
		if enabled {
			breakers[method.Name()] = NewCircuitBreaker(
				5,             // Open after 5 consecutive failures
				2,             // Close after 2 consecutive successes
				1*time.Minute, // Try again after 1 minute
			)
		} else {
			// No-op circuit breaker that never opens
			breakers[method.Name()] = &CircuitBreaker{
				state:            StateClosed,
				failureThreshold: 999999, // Effectively disabled
			}
		}
	}
	return breakers
}
