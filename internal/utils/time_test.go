package utils

import (
	"testing"
	"time"
)

func TestTimePtr(t *testing.T) {
	now := time.Now()
	ptr := TimePtr(now)

	if ptr == nil {
		t.Error("TimePtr returned nil")
		return
	}
	if *ptr != now {
		t.Errorf("TimePtr value mismatch: got %v, want %v", *ptr, now)
	}
}

func TestTimeValue(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name     string
		input    *time.Time
		expected time.Time
	}{
		{"nil pointer", nil, time.Time{}},
		{"valid pointer", &now, now},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := TimeValue(tt.input)
			if result != tt.expected {
				t.Errorf("TimeValue = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestNowPtr(t *testing.T) {
	before := time.Now()
	ptr := NowPtr()
	after := time.Now()

	if ptr == nil {
		t.Error("NowPtr returned nil")
		return
	}
	if (*ptr).Before(before) || (*ptr).After(after) {
		t.Error("NowPtr time out of expected range")
	}
}

func TestIsExpired(t *testing.T) {
	past := time.Now().Add(-1 * time.Hour)
	future := time.Now().Add(1 * time.Hour)

	if !IsExpired(past) {
		t.Error("IsExpired should return true for past time")
	}
	if IsExpired(future) {
		t.Error("IsExpired should return false for future time")
	}
}

func TestDurationSince(t *testing.T) {
	tests := []struct {
		name   string
		input  time.Time
		minDur time.Duration
		maxDur time.Duration
	}{
		{"zero time", time.Time{}, 0, 0},
		{"1 hour ago", time.Now().Add(-1 * time.Hour), 59 * time.Minute, 61 * time.Minute},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := DurationSince(tt.input)
			if result < tt.minDur || result > tt.maxDur {
				t.Errorf("DurationSince out of range: got %v, want between %v and %v",
					result, tt.minDur, tt.maxDur)
			}
		})
	}
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		input    time.Duration
		expected string
	}{
		{500 * time.Microsecond, "< 1ms"},
		{5 * time.Millisecond, "5ms"},
		{30 * time.Second, "30s"},
		{2*time.Minute + 30*time.Second, "3m0s"}, // rounds to minute
		{1*time.Hour + 15*time.Minute, "1h15m0s"},
	}

	for _, tt := range tests {
		result := FormatDuration(tt.input)
		if result != tt.expected {
			t.Errorf("FormatDuration(%v) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}
