package scanner

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// DirectoryBatch represents a batch of directories to be processed together
type DirectoryBatch struct {
	Directories     []string
	EstimatedSize   int64
	EstimatedFiles  int
	ProcessingOrder int
}

// DirectoryAnalyzer handles smart directory enumeration and batching for progressive scanning
type DirectoryAnalyzer struct {
	maxBatchSize       int           // Maximum directories per batch
	maxDepth           int           // Maximum depth to enumerate
	enumerationTimeout time.Duration // Timeout for directory enumeration
}

// NewDirectoryAnalyzer creates a new directory analyzer
func NewDirectoryAnalyzer() *DirectoryAnalyzer {
	return &DirectoryAnalyzer{
		maxBatchSize:       20,               // Process 20 directories per batch
		maxDepth:           10,               // Limit depth to avoid deep recursion
		enumerationTimeout: 30 * time.Second, // 30 second timeout for enumeration
	}
}

// AnalyzeAndBatch performs directory analysis and creates optimized batches
func (da *DirectoryAnalyzer) AnalyzeAndBatch(ctx context.Context, rootPath string) ([]*DirectoryBatch, error) {
	// Create context with timeout for enumeration
	enumCtx, cancel := context.WithTimeout(ctx, da.enumerationTimeout)
	defer cancel()

	// Step 1: Quick enumeration of directories
	directories, err := da.enumerateDirectories(enumCtx, rootPath)
	if err != nil {
		return nil, fmt.Errorf("failed to enumerate directories: %w", err)
	}

	if len(directories) == 0 {
		// Handle single directory case
		return []*DirectoryBatch{{
			Directories:     []string{rootPath},
			EstimatedSize:   0,
			EstimatedFiles:  0,
			ProcessingOrder: 1,
		}}, nil
	}

	// Step 2: Create smart batches
	batches := da.createBatches(directories)

	return batches, nil
}

// enumerateDirectories performs fast directory enumeration
func (da *DirectoryAnalyzer) enumerateDirectories(ctx context.Context, rootPath string) ([]DirectoryInfo, error) {
	var directories []DirectoryInfo
	currentDepth := 0

	err := filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		// Check for cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Handle errors gracefully
		if err != nil {
			// Skip inaccessible directories but continue walking
			return nil
		}

		// Skip non-directories
		if !info.IsDir() {
			return nil
		}

		// Calculate depth relative to root
		rel, relErr := filepath.Rel(rootPath, path)
		if relErr != nil {
			return nil // Skip if we can't calculate relative path
		}

		depth := len(filepath.SplitList(rel)) - 1
		if depth > da.maxDepth {
			return filepath.SkipDir // Skip too deep directories
		}

		// Estimate directory metrics quickly
		dirInfo, err := da.quickDirectoryAnalysis(ctx, path)
		if err != nil {
			// If we can't analyze, create basic info
			dirInfo = &DirectoryInfo{
				Path:           path,
				Depth:          depth,
				EstimatedSize:  0,
				EstimatedFiles: 1, // Assume at least something
			}
		}

		directories = append(directories, *dirInfo)

		// Update depth tracking
		if depth > currentDepth {
			currentDepth = depth
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return directories, nil
}

// quickDirectoryAnalysis performs fast analysis of a single directory
func (da *DirectoryAnalyzer) quickDirectoryAnalysis(ctx context.Context, dirPath string) (*DirectoryInfo, error) {
	// Check for cancellation
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// Quick directory read to estimate contents
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	info := &DirectoryInfo{
		Path:           dirPath,
		EstimatedFiles: len(entries),
	}

	// Quick size estimation based on entry count and types
	var estimatedSize int64
	fileCount := 0
	dirCount := 0

	for _, entry := range entries {
		if entry.IsDir() {
			dirCount++
			estimatedSize += 4096 // Assume 4KB per directory
		} else {
			fileCount++
			if fileInfo, err := entry.Info(); err == nil {
				estimatedSize += fileInfo.Size()
			} else {
				estimatedSize += 1024 // Assume 1KB for files we can't stat
			}
		}
	}

	info.EstimatedSize = estimatedSize
	info.EstimatedFiles = fileCount
	info.SubdirectoryCount = dirCount

	return info, nil
}

// createBatches creates optimized batches from directory list
func (da *DirectoryAnalyzer) createBatches(directories []DirectoryInfo) []*DirectoryBatch {
	if len(directories) == 0 {
		return nil
	}

	// Sort directories for optimal processing order
	// Process larger directories first for better progress indication
	sort.Slice(directories, func(i, j int) bool {
		// Primary: by estimated size (descending)
		if directories[i].EstimatedSize != directories[j].EstimatedSize {
			return directories[i].EstimatedSize > directories[j].EstimatedSize
		}
		// Secondary: by depth (ascending - process shallow first)
		if directories[i].Depth != directories[j].Depth {
			return directories[i].Depth < directories[j].Depth
		}
		// Tertiary: by path (for consistency)
		return directories[i].Path < directories[j].Path
	})

	var batches []*DirectoryBatch
	currentBatch := &DirectoryBatch{
		ProcessingOrder: 1,
	}

	for _, dir := range directories {
		// Check if we should start a new batch
		if len(currentBatch.Directories) >= da.maxBatchSize {
			batches = append(batches, currentBatch)
			currentBatch = &DirectoryBatch{
				ProcessingOrder: len(batches) + 1,
			}
		}

		// Add directory to current batch
		currentBatch.Directories = append(currentBatch.Directories, dir.Path)
		currentBatch.EstimatedSize += dir.EstimatedSize
		currentBatch.EstimatedFiles += dir.EstimatedFiles
	}

	// Add the final batch if it has directories
	if len(currentBatch.Directories) > 0 {
		batches = append(batches, currentBatch)
	}

	return batches
}

// EstimateTotal calculates total estimated metrics from all batches
func (da *DirectoryAnalyzer) EstimateTotal(batches []*DirectoryBatch) (totalDirs int, totalFiles int, totalSize int64) {
	for _, batch := range batches {
		totalDirs += len(batch.Directories)
		totalFiles += batch.EstimatedFiles
		totalSize += batch.EstimatedSize
	}
	return
}

// DirectoryInfo contains information about a single directory
type DirectoryInfo struct {
	Path              string
	Depth             int
	EstimatedSize     int64
	EstimatedFiles    int
	SubdirectoryCount int
}

// BatchingStrategy defines different batching approaches
type BatchingStrategy int

const (
	StrategyBalanced BatchingStrategy = iota // Balance size and count
	StrategyBySize                           // Batch primarily by size
	StrategyByCount                          // Batch primarily by count
	StrategyByDepth                          // Batch by directory depth
)

// SetBatchingStrategy configures the batching approach
func (da *DirectoryAnalyzer) SetBatchingStrategy(strategy BatchingStrategy) {
	// Future enhancement: implement different batching strategies
	switch strategy {
	case StrategyBySize:
		da.maxBatchSize = 10 // Smaller batches for size-based approach
	case StrategyByCount:
		da.maxBatchSize = 50 // Larger batches for count-based approach
	case StrategyByDepth:
		da.maxBatchSize = 15 // Medium batches for depth-based approach
	default:
		da.maxBatchSize = 20 // Balanced default
	}
}

// GetAnalysisStats returns statistics about the directory analysis
func (da *DirectoryAnalyzer) GetAnalysisStats(batches []*DirectoryBatch) map[string]interface{} {
	totalDirs, totalFiles, totalSize := da.EstimateTotal(batches)

	stats := map[string]interface{}{
		"total_batches":        len(batches),
		"total_directories":    totalDirs,
		"estimated_files":      totalFiles,
		"estimated_size_bytes": totalSize,
		"avg_dirs_per_batch":   float64(totalDirs) / float64(len(batches)),
		"max_batch_size":       da.maxBatchSize,
		"enumeration_timeout":  da.enumerationTimeout.String(),
	}

	if len(batches) > 0 {
		// Find largest and smallest batches
		minDirs, maxDirs := len(batches[0].Directories), len(batches[0].Directories)
		for _, batch := range batches {
			if len(batch.Directories) < minDirs {
				minDirs = len(batch.Directories)
			}
			if len(batch.Directories) > maxDirs {
				maxDirs = len(batch.Directories)
			}
		}
		stats["min_dirs_per_batch"] = minDirs
		stats["max_dirs_per_batch"] = maxDirs
	}

	return stats
}
