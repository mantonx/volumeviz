package enrichers

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Subtitle format time parsers for media enrichment
// These are specific to subtitle file processing

var (
	// SRT format: 00:00:00,000
	srtTimeRegex = regexp.MustCompile(`(\d{2}):(\d{2}):(\d{2}),(\d{3})`)

	// VTT format: 00:00:00.000 or 00:00.000
	vttTimeRegex = regexp.MustCompile(`(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})`)

	// ASS/SSA format: 0:00:00.00
	assTimeRegex = regexp.MustCompile(`(\d):(\d{2}):(\d{2})\.(\d{2})`)
)

// ParseSRTTime parses SRT subtitle time format (00:00:00,000)
func ParseSRTTime(timeStr string) (time.Duration, error) {
	matches := srtTimeRegex.FindStringSubmatch(timeStr)
	if len(matches) != 5 {
		return 0, fmt.Errorf("invalid SRT time format: %s", timeStr)
	}

	hours, _ := strconv.Atoi(matches[1])
	minutes, _ := strconv.Atoi(matches[2])
	seconds, _ := strconv.Atoi(matches[3])
	millis, _ := strconv.Atoi(matches[4])

	duration := time.Duration(hours)*time.Hour +
		time.Duration(minutes)*time.Minute +
		time.Duration(seconds)*time.Second +
		time.Duration(millis)*time.Millisecond

	return duration, nil
}

// ParseVTTTime parses WebVTT subtitle time format (00:00:00.000 or 00:00.000)
func ParseVTTTime(timeStr string) (time.Duration, error) {
	matches := vttTimeRegex.FindStringSubmatch(timeStr)
	if len(matches) < 4 {
		return 0, fmt.Errorf("invalid VTT time format: %s", timeStr)
	}

	hours := 0
	var minutes, seconds, millis int

	if matches[1] != "" {
		hours, _ = strconv.Atoi(matches[1])
		minutes, _ = strconv.Atoi(matches[2])
		seconds, _ = strconv.Atoi(matches[3])
		millis, _ = strconv.Atoi(matches[4])
	} else {
		minutes, _ = strconv.Atoi(matches[2])
		seconds, _ = strconv.Atoi(matches[3])
		millis, _ = strconv.Atoi(matches[4])
	}

	duration := time.Duration(hours)*time.Hour +
		time.Duration(minutes)*time.Minute +
		time.Duration(seconds)*time.Second +
		time.Duration(millis)*time.Millisecond

	return duration, nil
}

// ParseASSTime parses ASS/SSA subtitle time format (0:00:00.00)
func ParseASSTime(timeStr string) (time.Duration, error) {
	matches := assTimeRegex.FindStringSubmatch(timeStr)
	if len(matches) != 5 {
		return 0, fmt.Errorf("invalid ASS time format: %s", timeStr)
	}

	hours, _ := strconv.Atoi(matches[1])
	minutes, _ := strconv.Atoi(matches[2])
	seconds, _ := strconv.Atoi(matches[3])
	centis, _ := strconv.Atoi(matches[4])

	duration := time.Duration(hours)*time.Hour +
		time.Duration(minutes)*time.Minute +
		time.Duration(seconds)*time.Second +
		time.Duration(centis*10)*time.Millisecond

	return duration, nil
}

// ParseSubtitleTimestamp parses a subtitle timestamp line with start and end times
func ParseSubtitleTimestamp(line, separator string) (start, end time.Duration, err error) {
	parts := strings.Split(line, separator)
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("invalid timestamp format: %s", line)
	}

	// Try different formats
	startStr := strings.TrimSpace(parts[0])
	endStr := strings.TrimSpace(parts[1])

	// Try SRT format first
	start, err = ParseSRTTime(startStr)
	if err == nil {
		end, err = ParseSRTTime(endStr)
		if err == nil {
			return start, end, nil
		}
	}

	// Try VTT format
	start, err = ParseVTTTime(startStr)
	if err == nil {
		end, err = ParseVTTTime(endStr)
		if err == nil {
			return start, end, nil
		}
	}

	// Try ASS format
	start, err = ParseASSTime(startStr)
	if err == nil {
		end, err = ParseASSTime(endStr)
		if err == nil {
			return start, end, nil
		}
	}

	return 0, 0, fmt.Errorf("unable to parse timestamp: %s", line)
}
