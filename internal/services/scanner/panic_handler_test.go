package scanner

import (
	"bytes"
	"log"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// syncWriter is an io.Writer safe for the concurrent access this test
// exercises: the goroutine under test writes to it from SafeGo's recovery
// defer while the test goroutine reads it back afterward.
type syncWriter struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (w *syncWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.buf.Write(p)
}

func (w *syncWriter) String() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.buf.String()
}

// TestSafeGo_RecoversPanic is a regression test for the class of bug fixed in
// this session: several goroutines launched from the scanner package (DB
// writes, filesystem indexing, media enrichment) had no panic recovery of
// their own, so a panic in any of them would crash the whole process rather
// than just failing that one operation. SafeGo is the fix — this test proves
// it actually recovers a panic instead of merely wrapping without protecting.
//
// Synchronization note: fn's own `defer` runs before SafeGo's outer recovery
// defer logs the panic (deferred calls unwind innermost-first), so waiting on
// a channel closed from inside fn is not enough to know the log line has been
// written yet — this test instead polls the logger output.
func TestSafeGo_RecoversPanic(t *testing.T) {
	writer := &syncWriter{}
	logger := log.New(writer, "", 0)

	started := make(chan struct{})

	assert.NotPanics(t, func() {
		SafeGo(logger, "test-goroutine", func() {
			close(started)
			panic("simulated panic for test")
		})
		<-started
		waitForLogOutput(t, writer)
	})

	assert.Contains(t, writer.String(), "PANIC in goroutine test-goroutine")
	assert.Contains(t, writer.String(), "simulated panic for test")
}

// waitForLogOutput polls until the logger has produced output or fails the
// test after a generous timeout — avoids a fixed sleep while still being
// deterministic under `-race`, which slows goroutine scheduling significantly.
func waitForLogOutput(t *testing.T, writer *syncWriter) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if writer.String() != "" {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("timed out waiting for SafeGo's recovery handler to log the panic")
}

// TestSafeGo_NilLogger confirms a nil logger (the common case when a
// VolumeScanner is constructed without one) doesn't itself panic while
// handling a recovered panic.
func TestSafeGo_NilLogger(t *testing.T) {
	done := make(chan struct{})

	assert.NotPanics(t, func() {
		SafeGo(nil, "test-goroutine-no-logger", func() {
			defer close(done)
			panic("simulated panic with nil logger")
		})
		<-done
	})
}

// TestSafeGo_NoPanic confirms normal (non-panicking) execution is unaffected.
func TestSafeGo_NoPanic(t *testing.T) {
	logger := log.New(os.Stdout, "[TEST] ", 0)
	done := make(chan struct{})
	var ran bool

	SafeGo(logger, "test-goroutine-clean", func() {
		defer close(done)
		ran = true
	})
	<-done

	assert.True(t, ran)
}

// TestRecoverPanic_Recovers verifies the defer-style helper (used when a
// goroutine's body can't be neatly wrapped in a closure passed to SafeGo)
// also actually recovers.
func TestRecoverPanic_Recovers(t *testing.T) {
	var buf strings.Builder
	logger := log.New(&buf, "", 0)

	assert.NotPanics(t, func() {
		func() {
			defer RecoverPanic(logger, "test-context")
			panic("simulated panic via RecoverPanic")
		}()
	})

	assert.Contains(t, buf.String(), "PANIC in test-context")
	assert.Contains(t, buf.String(), "simulated panic via RecoverPanic")
}

// TestRecoverPanicWithCallback_InvokesCallback verifies the callback variant
// both recovers and invokes the callback with the panic value.
func TestRecoverPanicWithCallback_InvokesCallback(t *testing.T) {
	var buf strings.Builder
	logger := log.New(&buf, "", 0)

	var callbackValue interface{}
	assert.NotPanics(t, func() {
		func() {
			defer RecoverPanicWithCallback(logger, "test-context-callback", func(r interface{}) {
				callbackValue = r
			})
			panic("simulated panic via callback")
		}()
	})

	assert.Equal(t, "simulated panic via callback", callbackValue)
	assert.Contains(t, buf.String(), "PANIC in test-context-callback")
}
