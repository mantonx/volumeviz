package scanner

import (
	"context"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/utils"
)

// ProgressiveDu implements progressive du scanning with smart directory batching
type ProgressiveDu struct {
	timeout         time.Duration
	analyzer        *DirectoryAnalyzer
	progressManager *ProgressManager
}

// NewDuMethod creates a new progressive du scanner
func NewDuMethod(config models.ScanConfig, progressManager *ProgressManager) interfaces.ScanMethod {
	return &ProgressiveDu{
		timeout:         config.DefaultTimeout,
		analyzer:        NewDirectoryAnalyzer(),
		progressManager: progressManager,
	}
}

func (p *ProgressiveDu) Name() string {
	return "progressive_du"
}

func (p *ProgressiveDu) Available() bool {
	runner := utils.NewCommandRunner("du", p.timeout)
	return runner.IsAvailable()
}

func (p *ProgressiveDu) EstimatedDuration(path string) time.Duration {
	// Progressive du is slightly slower than regular du due to batching overhead
	if _, err := os.Stat(path); err == nil {
		if entries, err := os.ReadDir(path); err == nil {
			entryCount := len(entries)
			// Estimate: ~300 files per second (includes batching overhead)
			seconds := entryCount / 300
			if seconds < 2 {
				return 2 * time.Second
			}
			return time.Duration(seconds) * time.Second
		}
	}
	return 15 * time.Second // Conservative estimate
}

func (p *ProgressiveDu) SupportsProgress() bool {
	return true
}

func (p *ProgressiveDu) Scan(ctx context.Context, path string) (*interfaces.ScanResult, error) {
	start := time.Now()

	// Create timeout context
	scanCtx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	// Step 1: Analyze directory structure and create batches
	// Report preparation phase
	if p.progressManager != nil {
		if scanID, ok := ctx.Value("scan_id").(string); ok {
			p.progressManager.UpdateProgress(scanID, ProgressUpdate{
				Type:             "volume_scan",
				Progress:         0.0,
				CurrentOperation: "Analyzing directory structure",
				SubPhase:         "preparation",
				SubPhaseProgress: 0,
			})
		}
	}

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

			// Calculate enhanced confidence based on multiple factors
			elapsedSeconds := time.Since(start).Seconds()
			// Simple variance calculation (in a real implementation, you'd track processing rates)
			expectedRate := float64(len(batches)) / 60.0 // Assume 60 seconds for full completion
			actualRate := float64(processedBatches) / elapsedSeconds
			variance := math.Abs(actualRate - expectedRate) / expectedRate
			
			confidence := CalculateEstimationConfidence(
				processedBatches,
				len(batches),
				elapsedSeconds,
				variance,
			)

			update := ProgressUpdate{
				Type:                 "volume_scan",
				Progress:             progress,
				ItemsProcessed:       int64(processedBatches),
				CurrentPath:          currentPath,
				CurrentOperation:     fmt.Sprintf("Processing batch %d/%d", processedBatches, len(batches)),
				SubPhase:             "batch_processing",
				SubPhaseProgress:     int(progress * 100),
				EstimationConfidence: confidence,
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
		FileCount:      0, // du doesn't provide file count
		DirectoryCount: processedBatches,
		LargestFile:    0, // du doesn't provide largest file info
		Method:         p.Name(),
		ScannedAt:      time.Now(),
		Duration:       duration,
		FilesystemType: "", // Will be filled by the scanner
	}, nil
}

// processBatch processes a batch of directories using du
func (p *ProgressiveDu) processBatch(ctx context.Context, batch *DirectoryBatch) (int64, error) {
	if len(batch.Directories) == 0 {
		return 0, nil
	}

	// Use command runner for consistent command execution
	runner := utils.NewCommandRunner("du", p.timeout)
	runner.SetDefaultArgs([]string{"-s", "-B1"})

	// For du, we need to run all directories in one command
	// Use first directory as filePath and rest as args
	firstDir := batch.Directories[0]
	remainingDirs := batch.Directories[1:]
	result, err := runner.Run(ctx, firstDir, remainingDirs...)
	if err != nil {
		stderrStr := string(result.Stderr)
		// Handle permission errors gracefully - log but don't fail the whole batch
		if strings.Contains(stderrStr, "Permission denied") {
			return 0, nil // Skip this batch, continue with others
		}
		return 0, fmt.Errorf("du command failed: %w (stderr: %s)", err, stderrStr)
	}

	// Parse du output - multiple lines for batch mode
	output := strings.TrimSpace(string(result.Stdout))
	if output == "" {
		return 0, nil
	}

	var totalSize int64
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) < 1 {
			continue
		}

		size, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			// Skip malformed lines
			continue
		}

		totalSize += size
	}

	return totalSize, nil
}

// SetProgressCallback is implemented for interface compatibility but not used
// Progressive du uses the ProgressManager instead
func (p *ProgressiveDu) SetProgressCallback(callback func(interfaces.ProgressUpdate)) {
	// No-op - we use ProgressManager instead
}
