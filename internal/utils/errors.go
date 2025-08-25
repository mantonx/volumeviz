package utils

import (
	"errors"
	"fmt"

	"github.com/mantonx/volumeviz/internal/models"
)

// WrapError wraps an error with additional context
// Returns nil if err is nil
func WrapError(err error, msg string) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", msg, err)
}

// WrapErrorf wraps an error with formatted context
// Returns nil if err is nil
func WrapErrorf(err error, format string, args ...interface{}) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", fmt.Sprintf(format, args...), err)
}

// IsNotFound checks if error indicates a not found condition
// Checks for common not found error patterns
func IsNotFound(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return errors.Is(err, ErrNotFound) ||
		ContainsAny(errStr, "not found", "no rows", "does not exist")
}

// Common error types for consistent error handling
var (
	ErrNotFound      = errors.New("not found")
	ErrAlreadyExists = errors.New("already exists")
	ErrInvalidInput  = errors.New("invalid input")
	ErrTimeout       = errors.New("operation timed out")
	ErrCanceled      = errors.New("operation canceled")
)

// FirstError returns the first non-nil error from a list
// Useful for collecting errors from multiple operations
func FirstError(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}

// ErrorList collects multiple errors
// Implements error interface for easy handling
type ErrorList struct {
	Errors []error
}

// Add appends an error to the list
// Ignores nil errors
func (el *ErrorList) Add(err error) {
	if err != nil {
		el.Errors = append(el.Errors, err)
	}
}

// Error returns a combined error message
func (el *ErrorList) Error() string {
	if len(el.Errors) == 0 {
		return ""
	}
	if len(el.Errors) == 1 {
		return el.Errors[0].Error()
	}
	return fmt.Sprintf("multiple errors (%d): %v", len(el.Errors), el.Errors[0])
}

// HasErrors returns true if any errors were collected
func (el *ErrorList) HasErrors() bool {
	return len(el.Errors) > 0
}

// First returns the first error or nil
func (el *ErrorList) First() error {
	if len(el.Errors) > 0 {
		return el.Errors[0]
	}
	return nil
}

// NewScanError creates a new ScanError with the given parameters
func NewScanError(volumeID, method, path, code, message string, err error) *models.ScanError {
	return &models.ScanError{
		VolumeID: volumeID,
		Method:   method,
		Path:     path,
		Code:     code,
		Message:  message,
		Err:      err,
		Context:  make(map[string]any),
	}
}

// NewScanErrorWithContext creates a new ScanError with additional context
func NewScanErrorWithContext(volumeID, method, path, code, message string, err error, context map[string]any) *models.ScanError {
	if context == nil {
		context = make(map[string]any)
	}
	return &models.ScanError{
		VolumeID: volumeID,
		Method:   method,
		Path:     path,
		Code:     code,
		Message:  message,
		Err:      err,
		Context:  context,
	}
}

// WrapScanError wraps an existing error as a ScanError, or returns it unchanged if already a ScanError
func WrapScanError(err error, volumeID, method, path, code, message string) error {
	// If it's already a ScanError, return it as-is
	if scanErr, ok := err.(*models.ScanError); ok {
		return scanErr
	}

	return NewScanError(volumeID, method, path, code, message, err)
}
