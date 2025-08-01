package scanner

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/mantonx/volumeviz/internal/core/models"
)

// DuMethod implements directory scanning using the standard du command
type DuMethod struct {
	timeout time.Duration
}

// NewDuMethod creates a new du scan method
func NewDuMethod(config models.ScanConfig) interfaces.ScanMethod {
	return &DuMethod{
		timeout: config.DefaultTimeout,
	}
}

func (d *DuMethod) Name() string {
	return "du"
}

func (d *DuMethod) Available() bool {
	_, err := exec.LookPath("du")
	return err == nil
}

func (d *DuMethod) EstimatedDuration(path string) time.Duration {
	// Du is moderately fast - estimate based on directory complexity
	if _, err := os.Stat(path); err == nil {
		// Try to estimate based on directory entry count
		if entries, err := os.ReadDir(path); err == nil {
			entryCount := len(entries)
			// Rough estimate: du can process ~500 files per second
			seconds := entryCount / 500
			if seconds < 1 {
				return 1 * time.Second
			}
			return time.Duration(seconds) * time.Second
		}
	}
	return 10 * time.Second // Default conservative estimate
}

func (d *DuMethod) SupportsProgress() bool {
	return false // standard du doesn't provide progress updates
}

func (d *DuMethod) Scan(ctx context.Context, path string) (*interfaces.ScanResult, error) {
	// Create a timeout context if none provided
	scanCtx, cancel := context.WithTimeout(ctx, d.timeout)
	defer cancel()

	start := time.Now()

	// Execute du command with options:
	// -s: summarize (don't show subdirectories)
	// -B1: use 1-byte blocks for exact byte count
	// -L: follow symbolic links
	cmd := exec.CommandContext(scanCtx, "du", "-s", "-B1", path)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	duration := time.Since(start)

	if err != nil {
		stderrStr := stderr.String()
		
		// Handle common error cases
		if strings.Contains(stderrStr, "Permission denied") {
			return nil, &models.ScanError{
				Method:  "du",
				Path:    path,
				Code:    models.ErrorCodePermissionDenied,
				Message: "permission denied accessing directory",
				Err:     err,
				Context: map[string]any{
					"stderr": stderrStr,
				},
			}
		}
		
		if strings.Contains(stderrStr, "No such file or directory") {
			return nil, &models.ScanError{
				Method:  "du",
				Path:    path,
				Code:    models.ErrorCodeVolumeNotFound,
				Message: "directory not found",
				Err:     err,
				Context: map[string]any{
					"stderr": stderrStr,
				},
			}
		}

		return nil, &models.ScanError{
			Method:  "du",
			Path:    path,
			Code:    models.ErrorCodeMethodUnavailable,
			Message: "du execution failed",
			Err:     err,
			Context: map[string]interface{}{
				"stderr": stderrStr,
				"stdout": stdout.String(),
			},
		}
	}

	// Parse du output format: "SIZE\tPATH"
	output := strings.TrimSpace(stdout.String())
	if output == "" {
		return nil, &models.ScanError{
			Method:  "du",
			Path:    path,
			Code:    models.ErrorCodeResultValidationFailed,
			Message: "du returned empty output",
			Context: map[string]interface{}{
				"stdout": stdout.String(),
				"stderr": stderr.String(),
			},
		}
	}

	// Split by whitespace - first part should be the size
	parts := strings.Fields(output)
	if len(parts) < 1 {
		return nil, &models.ScanError{
			Method:  "du",
			Path:    path,
			Code:    models.ErrorCodeResultValidationFailed,
			Message: "unexpected du output format",
			Context: map[string]interface{}{
				"raw_output": output,
			},
		}
	}

	totalSize, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return nil, &models.ScanError{
			Method:  "du",
			Path:    path,
			Code:    models.ErrorCodeResultValidationFailed,
			Message: fmt.Sprintf("failed to parse du size output '%s'", parts[0]),
			Err:     err,
			Context: map[string]interface{}{
				"raw_output": output,
				"size_part":  parts[0],
			},
		}
	}

	return &interfaces.ScanResult{
		TotalSize:      totalSize,
		FileCount:      0, // du doesn't provide file count by default
		DirectoryCount: 0, // du doesn't provide directory count by default
		LargestFile:    0, // du doesn't provide largest file info
		Method:         "du",
		ScannedAt:      time.Now(),
		Duration:       duration,
		FilesystemType: "", // Will be filled by the scanner
	}, nil
}