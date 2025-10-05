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

// RecoverPanicWithCallback recovers panic and executes a callback
func RecoverPanicWithCallback(logger *log.Logger, context string, onPanic func(interface{})) {
	if r := recover(); r != nil {
		if logger != nil {
			logger.Printf("PANIC in %s: %v\nStack: %s",
				context, r, debug.Stack())
		}
		if onPanic != nil {
			onPanic(r)
		}
	}
}

// panicError wraps a panic value as an error
type panicError struct {
	value interface{}
	stack []byte
}

func (p *panicError) Error() string {
	return fmt.Sprintf("panic: %v\nstack:\n%s", p.value, p.stack)
}

// NewPanicError creates a new panic error
func NewPanicError(value interface{}) error {
	return &panicError{
		value: value,
		stack: debug.Stack(),
	}
}
