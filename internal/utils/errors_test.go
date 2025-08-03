package utils

import (
	"errors"
	"testing"
)

func TestWrapError(t *testing.T) {
	baseErr := errors.New("base error")
	
	tests := []struct {
		name     string
		err      error
		msg      string
		expected string
		isNil    bool
	}{
		{"nil error", nil, "context", "", true},
		{"wrap error", baseErr, "context", "context: base error", false},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := WrapError(tt.err, tt.msg)
			if tt.isNil && result != nil {
				t.Errorf("Expected nil, got %v", result)
			}
			if !tt.isNil && result.Error() != tt.expected {
				t.Errorf("WrapError = %q, want %q", result.Error(), tt.expected)
			}
		})
	}
}

func TestWrapErrorf(t *testing.T) {
	baseErr := errors.New("base error")
	
	result := WrapErrorf(baseErr, "context %d %s", 123, "test")
	expected := "context 123 test: base error"
	
	if result.Error() != expected {
		t.Errorf("WrapErrorf = %q, want %q", result.Error(), expected)
	}
	
	// Test nil error
	if WrapErrorf(nil, "context") != nil {
		t.Error("WrapErrorf should return nil for nil error")
	}
}

func TestIsNotFound(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{"nil error", nil, false},
		{"ErrNotFound", ErrNotFound, true},
		{"contains not found", errors.New("record not found"), true},
		{"contains no rows", errors.New("sql: no rows in result set"), true},
		{"contains does not exist", errors.New("table does not exist"), true},
		{"other error", errors.New("connection timeout"), false},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsNotFound(tt.err)
			if result != tt.expected {
				t.Errorf("IsNotFound(%v) = %v, want %v", tt.err, result, tt.expected)
			}
		})
	}
}

func TestFirstError(t *testing.T) {
	err1 := errors.New("first")
	err2 := errors.New("second")
	
	tests := []struct {
		name     string
		errs     []error
		expected error
	}{
		{"all nil", []error{nil, nil, nil}, nil},
		{"first non-nil", []error{nil, err1, err2}, err1},
		{"first is error", []error{err1, nil, err2}, err1},
		{"empty list", []error{}, nil},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FirstError(tt.errs...)
			if result != tt.expected {
				t.Errorf("FirstError = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestErrorList(t *testing.T) {
	el := &ErrorList{}
	
	// Test empty list
	if el.HasErrors() {
		t.Error("Empty ErrorList should not have errors")
	}
	if el.First() != nil {
		t.Error("Empty ErrorList.First() should return nil")
	}
	if el.Error() != "" {
		t.Error("Empty ErrorList.Error() should return empty string")
	}
	
	// Add errors
	err1 := errors.New("error 1")
	err2 := errors.New("error 2")
	
	el.Add(nil) // should be ignored
	el.Add(err1)
	el.Add(err2)
	
	if !el.HasErrors() {
		t.Error("ErrorList should have errors after adding")
	}
	if el.First() != err1 {
		t.Errorf("First() = %v, want %v", el.First(), err1)
	}
	if len(el.Errors) != 2 {
		t.Errorf("Expected 2 errors, got %d", len(el.Errors))
	}
	
	// Test error message
	msg := el.Error()
	if msg != "multiple errors (2): error 1" {
		t.Errorf("Error() = %q, want %q", msg, "multiple errors (2): error 1")
	}
	
	// Test single error
	el2 := &ErrorList{}
	el2.Add(err1)
	if el2.Error() != "error 1" {
		t.Errorf("Single error message = %q, want %q", el2.Error(), "error 1")
	}
}