package scanner

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
)

// ProgressiveDiskus implements progressive diskus scanning with smart directory batching
type ProgressiveDiskus struct {
	timeout         time.Duration
	analyzer        *DirectoryAnalyzer
	progressManager *ProgressManager
}

// NewDiskusMethod creates a new progressive diskus scanner
func NewDiskusMethod(config models.ScanConfig, progressManager *ProgressManager) interfaces.ScanMethod {
	return &ProgressiveDiskus{
		timeout:         config.DefaultTimeout,
		analyzer:        NewDirectoryAnalyzer(),
		progressManager: progressManager,
	}
}

func (p *ProgressiveDiskus) Name() string {
	return "progressive_diskus"
}

func (p *ProgressiveDiskus) Available() bool {
	_, err := exec.LookPath("diskus")
	return err == nil
}

func (p *ProgressiveDiskus) EstimatedDuration(path string) time.Duration {
	// Progressive diskus is very fast, even with batching overhead
	if _, err := os.Stat(path); err == nil {
		if entries, err := os.ReadDir(path); err == nil {
			entryCount := len(entries)
			// Estimate: ~800 files per second (diskus is very fast)
			seconds := entryCount / 800
			if seconds < 1 {
				return 1 * time.Second
			}
			return time.Duration(seconds) * time.Second
		}
	}
	return 5 * time.Second // Conservative estimate
}

func (p *ProgressiveDiskus) SupportsProgress() bool {
	return true
}

func (p *ProgressiveDiskus) Scan(ctx context.Context, path string) (*interfaces.ScanResult, error) {
	start := time.Now()

	// Create timeout context
	scanCtx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	// Step 1: Analyze directory structure and create batches
	batches, err := p.analyzer.AnalyzeAndBatch(scanCtx, path)
	if err != nil {
		return nil, &models.ScanError{
			Method:  p.Name(),
			Path:    path,
			Code:    models.ErrorCodeMethodUnavailable,
			Message: "failed to analyze directory structure",
			Err:     err,
		}
	}

	if len(batches) == 0 {
		return nil, &models.ScanError{
			Method:  p.Name(),
			Path:    path,
			Code:    models.ErrorCodeVolumeNotFound,
			Message: "no directories found to scan",
		}
	}

	// Step 2: Process batches with progress reporting
	var totalSize int64
	processedBatches := 0

	for _, batch := range batches {
		// Check for cancellation
		select {
		case <-scanCtx.Done():
			return nil, &models.ScanError{
				Method:  p.Name(),
				Path:    path,
				Code:    models.ErrorCodeScanTimeout,
				Message: "scan canceled during batch processing",
				Err:     scanCtx.Err(),
				Context: map[string]any{
					"processed_batches": processedBatches,
					"total_batches":     len(batches),
					"elapsed_time":      time.Since(start),
				},
			}
		default:
		}

		// Process the batch
		batchSize, err := p.processBatch(scanCtx, batch)
		if err != nil {
			// Log error but continue with next batch
			continue
		}

		totalSize += batchSize
		processedBatches++

		// Report progress if progress manager is available
		if p.progressManager != nil {
			progress := float64(processedBatches) / float64(len(batches))
			currentPath := "completed"
			if len(batch.Directories) > 0 {
				currentPath = batch.Directories[0]
			}

			update := ProgressUpdate{
				Type:           "volume_scan",
				Progress:       progress,
				ItemsProcessed: int64(processedBatches),
				CurrentPath:    currentPath,
			}

			// Get scan ID from context if available
			if scanID, ok := ctx.Value("scan_id").(string); ok {
				p.progressManager.UpdateProgress(scanID, update)
			}
		}
	}

	duration := time.Since(start)

	return &interfaces.ScanResult{
		TotalSize:      totalSize,
		FileCount:      0, // diskus doesn't provide file count
		DirectoryCount: processedBatches,
		LargestFile:    0, // diskus doesn't provide largest file info
		Method:         p.Name(),
		ScannedAt:      time.Now(),
		Duration:       duration,
		FilesystemType: "", // Will be filled by the scanner
	}, nil
}

// processBatch processes a batch of directories using diskus
func (p *ProgressiveDiskus) processBatch(ctx context.Context, batch *DirectoryBatch) (int64, error) {
	if len(batch.Directories) == 0 {
		return 0, nil
	}

	var totalSize int64

	// Process each directory in the batch individually
	// Diskus doesn't support multiple paths in one command like du does
	for _, dir := range batch.Directories {
		cmd := exec.CommandContext(ctx, "diskus", dir)
		var stdout, stderr bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr

		err := cmd.Run()
		if err != nil {
			stderrStr := stderr.String()
			// Handle permission errors gracefully
			if strings.Contains(stderrStr, "Permission denied") {
				continue // Skip this directory
			}
			// For other errors, continue with the next directory
			continue
		}

		// Parse diskus output
		output := strings.TrimSpace(stdout.String())
		if output == "" {
			continue
		}

		// Diskus output format is typically just the size in bytes
		// Sometimes with human readable format, we need to parse carefully
		lines := strings.Split(output, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			// Try to parse the first number we find
			parts := strings.Fields(line)
			for _, part := range parts {
				if size, err := strconv.ParseInt(part, 10, 64); err == nil {
					totalSize += size
					break // Found the size, move to next line
				}
			}
		}
	}

	return totalSize, nil
}

// SetProgressCallback is implemented for interface compatibility but not used
// Progressive diskus uses the ProgressManager instead
func (p *ProgressiveDiskus) SetProgressCallback(callback func(interfaces.ProgressUpdate)) {
	// No-op - we use ProgressManager instead
}
