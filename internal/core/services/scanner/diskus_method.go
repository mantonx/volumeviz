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

// DiskusMethod implements fast directory scanning using diskus tool
type DiskusMethod struct {
	timeout time.Duration
}

// NewDiskusMethod creates a new diskus scan method
func NewDiskusMethod(config models.ScanConfig) interfaces.ScanMethod {
	return &DiskusMethod{
		timeout: config.DefaultTimeout,
	}
}

func (d *DiskusMethod) Name() string {
	return "diskus"
}

func (d *DiskusMethod) Available() bool {
	_, err := exec.LookPath("diskus")
	return err == nil
}

func (d *DiskusMethod) EstimatedDuration(path string) time.Duration {
	// Diskus is very fast - estimate based on rough heuristics
	if info, err := os.Stat(path); err == nil {
		// Very rough estimation: diskus can scan ~1GB per second
		estimatedSize := info.Size()
		if estimatedSize == 0 {
			// For directories, try to estimate based on entry count
			if entries, err := os.ReadDir(path); err == nil {
				// Rough guess: 100ms per 1000 entries
				entryCount := len(entries)
				return time.Duration(entryCount/1000*100) * time.Millisecond
			}
		}
		// Estimate 1 second per GB, minimum 100ms
		seconds := estimatedSize / (1024 * 1024 * 1024)
		if seconds < 1 {
			return 100 * time.Millisecond
		}
		return time.Duration(seconds) * time.Second
	}
	return 5 * time.Second // Default conservative estimate
}

func (d *DiskusMethod) SupportsProgress() bool {
	return false // diskus doesn't provide progress updates
}

func (d *DiskusMethod) Scan(ctx context.Context, path string) (*interfaces.ScanResult, error) {
	// Create a timeout context if none provided
	scanCtx, cancel := context.WithTimeout(ctx, d.timeout)
	defer cancel()

	start := time.Now()

	// Execute diskus command
	cmd := exec.CommandContext(scanCtx, "diskus", path)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	duration := time.Since(start)

	if err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "Permission denied") {
			return nil, &models.ScanError{
				Method:  "diskus",
				Path:    path,
				Code:    models.ErrorCodePermissionDenied,
				Message: "permission denied accessing directory",
				Err:     err,
				Context: map[string]any{
					"stderr": stderrStr,
				},
			}
		}

		return nil, &models.ScanError{
			Method:  "diskus",
			Path:    path,
			Code:    models.ErrorCodeMethodUnavailable,
			Message: "diskus execution failed",
			Err:     err,
			Context: map[string]interface{}{
				"stderr": stderrStr,
				"stdout": stdout.String(),
			},
		}
	}

	// Parse diskus output (should be just the size in bytes)
	output := strings.TrimSpace(stdout.String())
	if output == "" {
		return nil, &models.ScanError{
			Method:  "diskus",
			Path:    path,
			Code:    models.ErrorCodeResultValidationFailed,
			Message: "diskus returned empty output",
			Context: map[string]interface{}{
				"stdout": stdout.String(),
				"stderr": stderr.String(),
			},
		}
	}

	totalSize, err := strconv.ParseInt(output, 10, 64)
	if err != nil {
		return nil, &models.ScanError{
			Method:  "diskus",
			Path:    path,
			Code:    models.ErrorCodeResultValidationFailed,
			Message: fmt.Sprintf("failed to parse diskus output '%s'", output),
			Err:     err,
			Context: map[string]interface{}{
				"raw_output": output,
			},
		}
	}

	return &interfaces.ScanResult{
		TotalSize:      totalSize,
		FileCount:      0, // diskus doesn't provide file count
		DirectoryCount: 0, // diskus doesn't provide directory count
		LargestFile:    0, // diskus doesn't provide largest file info
		Method:         "diskus",
		ScannedAt:      time.Now(),
		Duration:       duration,
		FilesystemType: "", // Will be filled by the scanner
	}, nil
}
