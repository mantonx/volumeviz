package scanner

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCircuitBreaker_OpensAfterFailureThreshold(t *testing.T) {
	cb := NewCircuitBreaker(3, 2, time.Minute)
	assert.Equal(t, StateClosed, cb.GetState())

	failingCall := func() error { return errors.New("boom") }

	for i := 0; i < 2; i++ {
		_ = cb.Call(failingCall)
		assert.Equal(t, StateClosed, cb.GetState(), "should stay closed below threshold")
	}

	_ = cb.Call(failingCall)
	assert.Equal(t, StateOpen, cb.GetState(), "should open once failures reach threshold")
}

func TestCircuitBreaker_OpenRejectsWithoutCallingFn(t *testing.T) {
	cb := NewCircuitBreaker(1, 1, time.Hour) // long reset so it stays open
	_ = cb.Call(func() error { return errors.New("boom") })
	require.Equal(t, StateOpen, cb.GetState())

	called := false
	err := cb.Call(func() error {
		called = true
		return nil
	})

	assert.ErrorIs(t, err, ErrCircuitOpen)
	assert.False(t, called, "fn must not run while the circuit is open")
}

func TestCircuitBreaker_HalfOpenRecovery(t *testing.T) {
	cb := NewCircuitBreaker(1, 2, 10*time.Millisecond)
	_ = cb.Call(func() error { return errors.New("boom") })
	require.Equal(t, StateOpen, cb.GetState())

	time.Sleep(20 * time.Millisecond)

	// First call after reset timeout transitions to half-open and runs fn.
	_ = cb.Call(func() error { return nil })
	assert.Equal(t, StateHalfOpen, cb.GetState())

	// Second consecutive success closes it (successThreshold=2).
	_ = cb.Call(func() error { return nil })
	assert.Equal(t, StateClosed, cb.GetState())
}

func TestCircuitBreaker_HalfOpenFailureReopens(t *testing.T) {
	cb := NewCircuitBreaker(1, 2, 10*time.Millisecond)
	_ = cb.Call(func() error { return errors.New("boom") })
	require.Equal(t, StateOpen, cb.GetState())

	time.Sleep(20 * time.Millisecond)

	_ = cb.Call(func() error { return errors.New("still failing") })
	assert.Equal(t, StateOpen, cb.GetState(), "a failure in half-open should reopen the circuit")
}

// fakeScanMethod is a minimal interfaces.ScanMethod stub for testing method
// selection/circuit-breaker plumbing without touching the filesystem.
type fakeScanMethod struct {
	name string
}

func (f *fakeScanMethod) Name() string                                        { return f.name }
func (f *fakeScanMethod) Available() bool                                     { return true }
func (f *fakeScanMethod) EstimatedDuration(path string) time.Duration         { return time.Millisecond }
func (f *fakeScanMethod) SupportsProgress() bool                              { return false }
func (f *fakeScanMethod) SetProgressCallback(func(interfaces.ProgressUpdate)) {}
func (f *fakeScanMethod) Scan(ctx context.Context, path string) (*interfaces.ScanResult, error) {
	return nil, nil
}

func TestNewCircuitBreakersForMethods_OnePerMethod(t *testing.T) {
	methods := []interfaces.ScanMethod{
		&fakeScanMethod{name: "diskus"},
		&fakeScanMethod{name: "du"},
		&fakeScanMethod{name: "native"},
	}

	breakers := newCircuitBreakersForMethods(methods, true)

	require.Len(t, breakers, 3)
	assert.NotNil(t, breakers["diskus"])
	assert.NotNil(t, breakers["du"])
	assert.NotNil(t, breakers["native"])
	// Each method must get its own breaker instance, not a shared pointer —
	// otherwise tripping one would trip all of them.
	assert.NotSame(t, breakers["diskus"], breakers["du"])
	assert.NotSame(t, breakers["du"], breakers["native"])
}

func TestNewCircuitBreakersForMethods_DisabledNeverOpens(t *testing.T) {
	methods := []interfaces.ScanMethod{&fakeScanMethod{name: "diskus"}}
	breakers := newCircuitBreakersForMethods(methods, false)

	cb := breakers["diskus"]
	require.NotNil(t, cb)

	for i := 0; i < 100; i++ {
		_ = cb.Call(func() error { return errors.New("boom") })
	}
	assert.Equal(t, StateClosed, cb.GetState(), "disabled circuit breaker must never open")
}

// TestCircuitBreakersForMethods_IndependentPerMethod is the regression test
// for the bug this fix addresses: previously a single, shared CircuitBreaker
// meant tripping it for any one method short-circuited ScanVolume entirely
// for every other method, even those with nothing to do with the failures.
// Each method now gets its own breaker keyed by name, so tripping one must
// never affect another's state.
//
// The scanner only has a single real method (Walker, see walker.go) since
// diskus/du were removed as external dependencies, so this is exercised
// directly against newCircuitBreakersForMethods with fakeScanMethod stubs
// rather than through a live ScanVolume call — the isolation guarantee lives
// in the breaker map, not in how many methods the scanner happens to have.
func TestCircuitBreakersForMethods_IndependentPerMethod(t *testing.T) {
	methods := []interfaces.ScanMethod{
		&fakeScanMethod{name: "method-a"},
		&fakeScanMethod{name: "method-b"},
	}
	breakers := newCircuitBreakersForMethods(methods, true)

	breakerA := breakers["method-a"]
	require.NotNil(t, breakerA)
	for i := 0; i < 10; i++ {
		_ = breakerA.Call(func() error { return errors.New("method-a is broken") })
	}
	require.Equal(t, StateOpen, breakerA.GetState())

	// method-b's breaker must be unaffected by method-a's failures.
	breakerB := breakers["method-b"]
	require.Equal(t, StateClosed, breakerB.GetState())
}
