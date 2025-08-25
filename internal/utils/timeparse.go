package utils

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// ParseFlexibleDateTime tries to parse a date/time string using multiple formats
func ParseFlexibleDateTime(dateStr string, formats []string) (*time.Time, error) {
	dateStr = strings.TrimSpace(dateStr)

	// Try each format
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return &t, nil
		}
	}

	// Try some common formats if none provided
	if len(formats) == 0 {
		commonFormats := []string{
			time.RFC3339,
			time.RFC3339Nano,
			"2006-01-02T15:04:05Z07:00",
			"2006-01-02 15:04:05",
			"2006-01-02",
			"01/02/2006 15:04:05",
			"01/02/2006",
			"2006:01:02 15:04:05",
		}

		for _, format := range commonFormats {
			if t, err := time.Parse(format, dateStr); err == nil {
				return &t, nil
			}
		}
	}

	return nil, fmt.Errorf("unable to parse date/time: %s", dateStr)
}

// ParseDuration parses a duration string in various formats
func ParseDuration(durationStr string) (time.Duration, error) {
	// Try standard Go duration format
	if d, err := time.ParseDuration(durationStr); err == nil {
		return d, nil
	}

	// Try HH:MM:SS format
	parts := strings.Split(durationStr, ":")
	if len(parts) == 3 {
		hours, err1 := strconv.Atoi(parts[0])
		minutes, err2 := strconv.Atoi(parts[1])
		seconds, err3 := strconv.ParseFloat(parts[2], 64)

		if err1 == nil && err2 == nil && err3 == nil {
			duration := time.Duration(hours)*time.Hour +
				time.Duration(minutes)*time.Minute +
				time.Duration(seconds*float64(time.Second))
			return duration, nil
		}
	}

	// Try MM:SS format
	if len(parts) == 2 {
		minutes, err1 := strconv.Atoi(parts[0])
		seconds, err2 := strconv.ParseFloat(parts[1], 64)

		if err1 == nil && err2 == nil {
			duration := time.Duration(minutes)*time.Minute +
				time.Duration(seconds*float64(time.Second))
			return duration, nil
		}
	}

	// Try seconds only
	if seconds, err := strconv.ParseFloat(durationStr, 64); err == nil {
		return time.Duration(seconds * float64(time.Second)), nil
	}

	return 0, fmt.Errorf("unable to parse duration: %s", durationStr)
}
