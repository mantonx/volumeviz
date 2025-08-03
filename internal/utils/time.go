package utils

import (
	"time"
)

// TimePtr returns a pointer to a time.Time value
// Handy for optional time fields in structs
func TimePtr(t time.Time) *time.Time {
	return &t
}

// TimeValue safely dereferences a time pointer
// Returns zero time if pointer is nil
func TimeValue(t *time.Time) time.Time {
	if t != nil {
		return *t
	}
	return time.Time{}
}

// NowPtr returns a pointer to current time
// Convenience function for timestamp fields
func NowPtr() *time.Time {
	now := time.Now()
	return &now
}

// IsExpired checks if a time has passed
// Returns true if t is before current time
func IsExpired(t time.Time) bool {
	return t.Before(time.Now())
}

// DurationSince calculates duration from a given time
// Returns zero duration if time is zero value
func DurationSince(t time.Time) time.Duration {
	if t.IsZero() {
		return 0
	}
	return time.Since(t)
}

// FormatDuration formats a duration in human-readable form
// Examples: "2h3m", "45s", "123ms"
func FormatDuration(d time.Duration) string {
	if d < time.Millisecond {
		return "< 1ms"
	}
	if d < time.Second {
		return d.Round(time.Millisecond).String()
	}
	if d < time.Minute {
		return d.Round(time.Second).String()
	}
	return d.Round(time.Minute).String()
}