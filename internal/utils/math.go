package utils

import (
	"math"
	"time"
)

// SafePercentage calculates percentage safely, handling divide-by-zero
func SafePercentage(current, total int64) int {
	if total <= 0 {
		if current > 0 {
			return 1 // Show minimal progress if we have some items but no total
		}
		return 0
	}

	percentage := int((current * 100) / total)
	if percentage > 100 {
		return 100
	}
	if percentage < 0 {
		return 0
	}
	return percentage
}

// SafePercentageFloat calculates percentage as float64 safely
func SafePercentageFloat(current, total int64) float64 {
	if total <= 0 {
		if current > 0 {
			return 0.01 // Show minimal progress
		}
		return 0.0
	}

	percentage := float64(current) / float64(total)
	if percentage > 1.0 {
		return 1.0
	}
	if percentage < 0.0 {
		return 0.0
	}
	return percentage
}

// CalculateRate calculates items per second rate
func CalculateRate(count int64, duration time.Duration) float64 {
	if duration <= 0 {
		return 0.0
	}
	seconds := duration.Seconds()
	if seconds <= 0 {
		return 0.0
	}
	return float64(count) / seconds
}

// CalculateBytesPerSecond calculates bytes per second rate
func CalculateBytesPerSecond(bytes int64, duration time.Duration) int64 {
	if duration <= 0 {
		return 0
	}
	seconds := duration.Seconds()
	if seconds <= 0 {
		return 0
	}
	return int64(float64(bytes) / seconds)
}

// ClampInt clamps an integer value between min and max
func ClampInt(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// ClampInt64 clamps an int64 value between min and max
func ClampInt64(value, min, max int64) int64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// ClampFloat64 clamps a float64 value between min and max
func ClampFloat64(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// EstimateRemainingTime estimates remaining time based on current rate
func EstimateRemainingTime(itemsRemaining int64, itemsPerSecond float64) time.Duration {
	if itemsPerSecond <= 0 || itemsRemaining <= 0 {
		return 0
	}
	seconds := float64(itemsRemaining) / itemsPerSecond
	return time.Duration(seconds * float64(time.Second))
}

// RoundToDecimalPlaces rounds a float64 to specified decimal places
func RoundToDecimalPlaces(value float64, places int) float64 {
	shift := math.Pow(10, float64(places))
	return math.Round(value*shift) / shift
}

// Min returns the minimum of two integers
func Min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Max returns the maximum of two integers
func Max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// MinInt64 returns the minimum of two int64 values
func MinInt64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

// MaxInt64 returns the maximum of two int64 values
func MaxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
