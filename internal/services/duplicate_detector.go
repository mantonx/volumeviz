package services

import (
	"context"
	"crypto/md5"
	"fmt"
	"io"
	"log"
	"os"
	"sort"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// DuplicateDetector handles finding duplicate files
type DuplicateDetector struct {
	store store.Store
}

// NewDuplicateDetector creates a new duplicate detector service
func NewDuplicateDetector(store store.Store) *DuplicateDetector {
	return &DuplicateDetector{
		store: store,
	}
}

// DuplicateGroup represents a group of duplicate files
type DuplicateGroup struct {
	ID          string                    `json:"id"`
	Hash        string                    `json:"hash"`
	Size        int64                     `json:"size"`
	Count       int                       `json:"count"`
	Files       []models.DuplicateFile    `json:"files"`
	WastedSpace int64                     `json:"wasted_space"`
	CreatedAt   time.Time                 `json:"created_at"`
}

// DuplicateDetectionRequest represents a request to detect duplicates
type DuplicateDetectionRequest struct {
	VolumeID     string `json:"volume_id"`
	Path         string `json:"path"`
	MinSize      int64  `json:"min_size"`
	MaxSize      int64  `json:"max_size"`
	IncludeEmpty bool   `json:"include_empty"`
}

// DuplicateDetectionResult represents the result of duplicate detection
type DuplicateDetectionResult struct {
	Groups           []DuplicateGroup `json:"groups"`
	TotalDuplicates  int              `json:"total_duplicates"`
	TotalWastedSpace int64            `json:"total_wasted_space"`
	ProcessedFiles   int              `json:"processed_files"`
	ProcessingTime   time.Duration    `json:"processing_time"`
}

// DetectDuplicates finds duplicate files based on content hash
func (d *DuplicateDetector) DetectDuplicates(ctx context.Context, req DuplicateDetectionRequest) (*DuplicateDetectionResult, error) {
	start := time.Now()
	
	log.Printf("Starting duplicate detection for volume %s, path %s", req.VolumeID, req.Path)

	// Get files from the database that match criteria
	files, err := d.getFilesForDuplicateDetection(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get files: %w", err)
	}

	log.Printf("Found %d files to process for duplicate detection", len(files))

	// Calculate hashes for files
	hashedFiles, err := d.calculateHashes(ctx, files)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate hashes: %w", err)
	}

	// Group files by hash
	groups := d.groupFilesByHash(hashedFiles)

	// Calculate statistics
	totalDuplicates := 0
	var totalWastedSpace int64
	
	for _, group := range groups {
		if group.Count > 1 {
			totalDuplicates += group.Count - 1 // Don't count the original
			totalWastedSpace += group.WastedSpace
		}
	}

	// Filter out groups with only one file
	duplicateGroups := make([]DuplicateGroup, 0)
	for _, group := range groups {
		if group.Count > 1 {
			duplicateGroups = append(duplicateGroups, group)
		}
	}

	// Sort groups by wasted space (descending)
	sort.Slice(duplicateGroups, func(i, j int) bool {
		return duplicateGroups[i].WastedSpace > duplicateGroups[j].WastedSpace
	})

	result := &DuplicateDetectionResult{
		Groups:           duplicateGroups,
		TotalDuplicates:  totalDuplicates,
		TotalWastedSpace: totalWastedSpace,
		ProcessedFiles:   len(files),
		ProcessingTime:   time.Since(start),
	}

	log.Printf("Duplicate detection completed: found %d duplicate groups, %d total duplicates, %d bytes wasted space", 
		len(duplicateGroups), totalDuplicates, totalWastedSpace)

	return result, nil
}

// getFilesForDuplicateDetection retrieves files that match the detection criteria
func (d *DuplicateDetector) getFilesForDuplicateDetection(ctx context.Context, req DuplicateDetectionRequest) ([]models.DuplicateFile, error) {
	filesRepo := d.store.Files()
	
	// For now, we'll use a simple approach - in a real implementation, 
	// this would use optimized database queries
	allFiles, err := filesRepo.GetFilesByPath(ctx, req.VolumeID, req.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to get files by path: %w", err)
	}

	var filteredFiles []models.DuplicateFile
	for _, file := range allFiles {
		// Files table doesn't have IsDirectory - files are always files (directories are in folders table)
		// Apply size filters
		if req.MinSize > 0 && file.SizeBytes < req.MinSize {
			continue
		}
		if req.MaxSize > 0 && file.SizeBytes > req.MaxSize {
			continue
		}

		// Skip empty files unless requested
		if !req.IncludeEmpty && file.SizeBytes == 0 {
			continue
		}

		var modTime time.Time
		if file.Mtime != nil {
			modTime = *file.Mtime
		}

		duplicateFile := models.DuplicateFile{
			ID:           fmt.Sprintf("%d", file.ID), // Convert int64 to string
			Path:         file.Path,
			Name:         file.Name,
			Size:         file.SizeBytes,
			ModifiedTime: modTime,
			VolumeID:     req.VolumeID,
		}

		filteredFiles = append(filteredFiles, duplicateFile)
	}

	return filteredFiles, nil
}

// calculateHashes computes MD5 hashes for the given files
func (d *DuplicateDetector) calculateHashes(ctx context.Context, files []models.DuplicateFile) ([]models.DuplicateFile, error) {
	hashedFiles := make([]models.DuplicateFile, 0, len(files))
	
	for i, file := range files {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Calculate hash for the file
		hash, err := d.calculateFileHash(file.Path)
		if err != nil {
			log.Printf("Warning: failed to calculate hash for file %s: %v", file.Path, err)
			continue // Skip files we can't hash
		}

		file.Hash = hash
		hashedFiles = append(hashedFiles, file)

		// Log progress periodically
		if (i+1)%100 == 0 || i == len(files)-1 {
			log.Printf("Hashed %d/%d files", i+1, len(files))
		}
	}

	return hashedFiles, nil
}

// calculateFileHash computes the MD5 hash of a file
func (d *DuplicateDetector) calculateFileHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("failed to calculate hash: %w", err)
	}

	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// groupFilesByHash groups files with the same hash
func (d *DuplicateDetector) groupFilesByHash(files []models.DuplicateFile) []DuplicateGroup {
	hashGroups := make(map[string][]models.DuplicateFile)

	// Group files by hash
	for _, file := range files {
		hashGroups[file.Hash] = append(hashGroups[file.Hash], file)
	}

	// Convert to DuplicateGroup structs
	groups := make([]DuplicateGroup, 0, len(hashGroups))
	groupID := 1

	for hash, groupFiles := range hashGroups {
		if len(groupFiles) == 0 {
			continue
		}

		// Sort files in group by path for consistent ordering
		sort.Slice(groupFiles, func(i, j int) bool {
			return groupFiles[i].Path < groupFiles[j].Path
		})

		// Calculate wasted space (size * (count - 1))
		wastedSpace := int64(0)
		if len(groupFiles) > 1 {
			wastedSpace = groupFiles[0].Size * int64(len(groupFiles)-1)
		}

		group := DuplicateGroup{
			ID:          fmt.Sprintf("dup-%d", groupID),
			Hash:        hash,
			Size:        groupFiles[0].Size,
			Count:       len(groupFiles),
			Files:       groupFiles,
			WastedSpace: wastedSpace,
			CreatedAt:   time.Now(),
		}

		groups = append(groups, group)
		groupID++
	}

	return groups
}

// GetDuplicatesBySize finds potential duplicates by file size (faster than hash-based)
func (d *DuplicateDetector) GetDuplicatesBySize(ctx context.Context, req DuplicateDetectionRequest) (*DuplicateDetectionResult, error) {
	start := time.Now()
	
	log.Printf("Starting size-based duplicate detection for volume %s, path %s", req.VolumeID, req.Path)

	// Get files from the database that match criteria
	files, err := d.getFilesForDuplicateDetection(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get files: %w", err)
	}

	// Group files by size
	sizeGroups := make(map[int64][]models.DuplicateFile)
	for _, file := range files {
		sizeGroups[file.Size] = append(sizeGroups[file.Size], file)
	}

	// Convert to DuplicateGroup structs (size-based groups)
	groups := make([]DuplicateGroup, 0)
	groupID := 1

	for size, groupFiles := range sizeGroups {
		if len(groupFiles) <= 1 {
			continue // Skip groups with only one file
		}

		// Sort files in group by path
		sort.Slice(groupFiles, func(i, j int) bool {
			return groupFiles[i].Path < groupFiles[j].Path
		})

		// Calculate wasted space (assuming all are duplicates)
		wastedSpace := size * int64(len(groupFiles)-1)

		group := DuplicateGroup{
			ID:          fmt.Sprintf("size-dup-%d", groupID),
			Hash:        fmt.Sprintf("size-%d", size), // Use size as pseudo-hash
			Size:        size,
			Count:       len(groupFiles),
			Files:       groupFiles,
			WastedSpace: wastedSpace,
			CreatedAt:   time.Now(),
		}

		groups = append(groups, group)
		groupID++
	}

	// Sort groups by wasted space (descending)
	sort.Slice(groups, func(i, j int) bool {
		return groups[i].WastedSpace > groups[j].WastedSpace
	})

	// Calculate statistics
	totalDuplicates := 0
	var totalWastedSpace int64
	
	for _, group := range groups {
		totalDuplicates += group.Count - 1
		totalWastedSpace += group.WastedSpace
	}

	result := &DuplicateDetectionResult{
		Groups:           groups,
		TotalDuplicates:  totalDuplicates,
		TotalWastedSpace: totalWastedSpace,
		ProcessedFiles:   len(files),
		ProcessingTime:   time.Since(start),
	}

	log.Printf("Size-based duplicate detection completed: found %d groups, %d potential duplicates, %d bytes potential wasted space", 
		len(groups), totalDuplicates, totalWastedSpace)

	return result, nil
}

// VerifyDuplicatesWithHash verifies size-based duplicates with actual hash comparison
func (d *DuplicateDetector) VerifyDuplicatesWithHash(ctx context.Context, group DuplicateGroup) (*DuplicateGroup, error) {
	log.Printf("Verifying duplicate group %s with %d files using hash", group.ID, len(group.Files))

	// Calculate hashes for files in this group
	hashedFiles, err := d.calculateHashes(ctx, group.Files)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate hashes for verification: %w", err)
	}

	// Re-group by actual hash
	hashGroups := d.groupFilesByHash(hashedFiles)

	// Find the largest group (most duplicates)
	var largestGroup *DuplicateGroup
	for i := range hashGroups {
		if hashGroups[i].Count > 1 && (largestGroup == nil || hashGroups[i].Count > largestGroup.Count) {
			largestGroup = &hashGroups[i]
		}
	}

	if largestGroup == nil {
		// No actual duplicates found
		emptyGroup := DuplicateGroup{
			ID:          group.ID + "-verified",
			Hash:        "",
			Size:        group.Size,
			Count:       0,
			Files:       []models.DuplicateFile{},
			WastedSpace: 0,
			CreatedAt:   time.Now(),
		}
		return &emptyGroup, nil
	}

	// Return the verified duplicate group
	largestGroup.ID = group.ID + "-verified"
	return largestGroup, nil
}