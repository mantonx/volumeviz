package enrichers

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
)

// StreamingEnrichmentConfig controls streaming enrichment behavior
type StreamingEnrichmentConfig struct {
	BatchSize           int           // Number of files to process in each batch
	MaxConcurrentBatch  int           // Maximum number of concurrent batches
	BatchTimeout        time.Duration // Timeout for batch processing
	ProgressUpdateEvery int           // Update progress every N files
}

// DefaultStreamingConfig returns sensible defaults for streaming enrichment
func DefaultStreamingConfig() StreamingEnrichmentConfig {
	return StreamingEnrichmentConfig{
		BatchSize:           1000, // Process 1000 files per batch
		MaxConcurrentBatch:  2,    // Maximum 2 batches in memory at once
		BatchTimeout:        30 * time.Minute,
		ProgressUpdateEvery: 100, // Update progress every 100 files
	}
}

// EnrichVolumeStreaming enriches a volume using streaming approach to minimize memory usage
func (m *Manager) EnrichVolumeStreaming(ctx context.Context, volumeID string, scanID string) error {
	if !m.IsEnabled() {
		return fmt.Errorf("enrichment is disabled")
	}

	config := DefaultStreamingConfig()
	
	// Initialize progress tracking
	progress := &EnrichmentProgress{
		VolumeID:         volumeID,
		ScanID:           scanID,
		Status:           "running",
		StartedAt:        time.Now(),
		LastUpdate:       time.Now(),
		EnricherProgress: make(map[string]*EnricherProgress),
	}

	for _, enricher := range m.enrichers {
		progress.EnricherProgress[enricher.Name()] = &EnricherProgress{
			Name:       enricher.Name(),
			Status:     "pending",
			LastUpdate: time.Now(),
		}
	}

	m.setProgress(volumeID, progress)

	// Update database progress tracking
	if scanID != "" && m.store != nil {
		go m.updateDatabasePhaseStatus(context.Background(), scanID, "media_enrichment", "running", "")
	}

	// Emit started event
	m.emitEvent(EnrichmentEvent{
		Type:      "started",
		VolumeID:  volumeID,
		Progress:  progress,
		Timestamp: time.Now(),
	})

	// Get total count of unenriched files for progress calculation
	totalFiles, err := m.repository.GetUnenrichedFileCount(ctx, volumeID)
	if err != nil {
		if m.logger != nil {
			m.logger.Printf("Could not get total file count for volume %s: %v", volumeID, err)
		}
		// Continue with streaming approach without total count
		totalFiles = 0
	}

	progress.TotalFiles = totalFiles
	m.setProgress(volumeID, progress)

	if totalFiles == 0 {
		// Check if filesystem indexing is completed
		if m.isFilesystemIndexingCompleted(ctx, scanID) {
			return m.completeEnrichment(ctx, volumeID, scanID, progress)
		}
		return nil // No files to process yet, but indexing is still running
	}

	if m.logger != nil {
		m.logger.Printf("Starting streaming enrichment for volume %s: %d files in batches of %d",
			volumeID, totalFiles, config.BatchSize)
	}

	// Process files in streaming batches
	return m.processFilesBatched(ctx, volumeID, scanID, progress, config)
}

// processFilesBatched processes files in manageable batches to control memory usage
func (m *Manager) processFilesBatched(ctx context.Context, volumeID, scanID string, progress *EnrichmentProgress, config StreamingEnrichmentConfig) error {
	offset := int64(0)
	filesProcessed := int64(0)
	var lastError error

	// Create semaphore to limit concurrent batches
	batchSemaphore := make(chan struct{}, config.MaxConcurrentBatch)

	for {
		// Check context cancellation
		select {
		case <-ctx.Done():
			progress.Status = "canceled"
			progress.LastError = "Context canceled"
			m.setProgress(volumeID, progress)
			
			if scanID != "" && m.store != nil {
				go m.updateDatabasePhaseStatus(context.Background(), scanID, "media_enrichment", "failed", "Context canceled")
			}
			return ctx.Err()
		default:
		}

		// Get next batch of files
		files, err := m.repository.GetUnenrichedFilesPaginated(ctx, volumeID, config.BatchSize, offset)
		if err != nil {
			progress.Status = "failed"
			progress.LastError = fmt.Sprintf("Failed to get files batch: %v", err)
			m.setProgress(volumeID, progress)
			return fmt.Errorf("failed to get files batch at offset %d: %w", offset, err)
		}

		// No more files to process
		if len(files) == 0 {
			break
		}

		if m.logger != nil && offset%int64(config.BatchSize*5) == 0 { // Log every 5 batches
			m.logger.Printf("Processing batch at offset %d (%d files) for volume %s",
				offset, len(files), volumeID)
		}

		// Acquire batch processing semaphore
		batchSemaphore <- struct{}{}

		// Process batch
		batchResults, batchErrors := m.processBatch(ctx, files, progress, config)
		
		// Release semaphore
		<-batchSemaphore

		// Save batch results immediately to avoid memory buildup
		if len(batchResults) > 0 {
			if err := m.repository.BulkSaveMetadata(ctx, batchResults); err != nil {
				lastError = fmt.Errorf("failed to save batch results: %w", err)
				if m.logger != nil {
					m.logger.Printf("Failed to save enrichment batch: %v", err)
				}
				progress.ErrorsCount++
			} else {
				progress.SuccessfulFiles += int64(len(batchResults))
			}
		}

		// Handle batch errors
		if len(batchErrors) > 0 {
			progress.ErrorsCount += int64(len(batchErrors))
			progress.FailedFiles += int64(len(batchErrors))
			
			// Log first few errors for debugging
			for i, err := range batchErrors {
				if i < 3 { // Log first 3 errors
					if m.logger != nil {
						m.logger.Printf("Batch enrichment error: %v", err)
					}
				}
				lastError = err
			}
			
			progress.LastError = lastError.Error()
		}

		filesProcessed += int64(len(files))
		offset += int64(len(files))

		// Update progress
		progress.ProcessedFiles = filesProcessed
		progress.LastUpdate = time.Now()
		
		// Calculate progress percentage (using processed files vs total)
		var progressPercent float64
		if progress.TotalFiles > 0 {
			progressPercent = float64(filesProcessed) / float64(progress.TotalFiles)
		}

		m.setProgress(volumeID, progress)

		// Update database progress periodically
		if scanID != "" && m.store != nil && filesProcessed%int64(config.ProgressUpdateEvery) == 0 {
			progressPercentInt := int(progressPercent * 100)
			go m.updateDatabaseProgressDetailed(context.Background(), scanID, "media_enrichment", 
				progressPercentInt, int(filesProcessed), int(progress.TotalFiles))
		}

		// Break if we got fewer files than requested (end of data)
		if len(files) < config.BatchSize {
			break
		}
	}

	// Final status update
	if lastError != nil {
		progress.Status = "completed_with_errors"
		progress.LastError = fmt.Sprintf("Completed with %d errors. Last error: %s", 
			progress.ErrorsCount, lastError.Error())
	} else {
		progress.Status = "completed"
	}

	progress.LastUpdate = time.Now()
	m.setProgress(volumeID, progress)

	// Update database - mark media enrichment phase as completed
	if scanID != "" && m.store != nil {
		status := "completed"
		errorMsg := ""
		if lastError != nil {
			status = "completed_with_errors"
			errorMsg = progress.LastError
		}
		go m.updateDatabasePhaseStatus(context.Background(), scanID, "media_enrichment", status, errorMsg)
	}

	// Emit completed event
	m.emitEvent(EnrichmentEvent{
		Type:      "completed",
		VolumeID:  volumeID,
		Progress:  progress,
		Timestamp: time.Now(),
	})

	if m.logger != nil {
		m.logger.Printf("Streaming enrichment completed for volume %s: %d files processed, %d enriched, %d errors",
			volumeID, filesProcessed, progress.SuccessfulFiles, progress.ErrorsCount)
	}

	return lastError
}

// processBatch processes a single batch of files with controlled concurrency
func (m *Manager) processBatch(ctx context.Context, files []FileInfo, progress *EnrichmentProgress, config StreamingEnrichmentConfig) ([]EnrichmentResult, []error) {
	results := make(chan EnrichmentResult, len(files))
	errors := make(chan error, len(files))

	// Process files in batch with worker semaphore
	var wg sync.WaitGroup
	for _, file := range files {
		wg.Add(1)
		go func(fileInfo FileInfo) {
			defer wg.Done()

			// Update current file being processed
			m.updateCurrentFile(progress.VolumeID, fileInfo.Path)

			// Acquire worker semaphore (respects existing concurrency limits)
			select {
			case m.workerSemaphore <- struct{}{}:
				defer func() { <-m.workerSemaphore }()
			case <-ctx.Done():
				errors <- ctx.Err()
				return
			}

			result, err := m.EnrichFile(ctx, fileInfo)
			if err != nil {
				// Create detailed error record
				enrichmentErr := models.EnrichmentError{
					Timestamp:        time.Now(),
					FileName:         fileInfo.Name,
					FilePath:         fileInfo.Path,
					EnricherName:     m.determineEnricherFromError(err),
					ErrorType:        m.categorizeError(err),
					ErrorMessage:     err.Error(),
					TechnicalDetails: m.extractTechnicalDetails(err),
				}

				// Add to progress tracking
				m.addErrorToProgress(progress.VolumeID, enrichmentErr)

				errors <- err
			} else {
				results <- *result
			}
		}(file)
	}

	// Wait for all workers to complete
	go func() {
		wg.Wait()
		close(results)
		close(errors)
	}()

	// Collect results
	var batchResults []EnrichmentResult
	var batchErrors []error

	// Use timeout to prevent hanging on batch processing
	batchCtx, cancel := context.WithTimeout(ctx, config.BatchTimeout)
	defer cancel()

	for {
		select {
		case result, ok := <-results:
			if !ok {
				results = nil
			} else {
				batchResults = append(batchResults, result)
			}
		case err, ok := <-errors:
			if !ok {
				errors = nil
			} else {
				batchErrors = append(batchErrors, err)
			}
		case <-batchCtx.Done():
			// Batch timeout - return what we have
			if m.logger != nil {
				m.logger.Printf("Batch processing timeout for volume %s", progress.VolumeID)
			}
			return batchResults, append(batchErrors, batchCtx.Err())
		}

		if results == nil && errors == nil {
			break
		}
	}

	return batchResults, batchErrors
}

// Helper methods

func (m *Manager) isFilesystemIndexingCompleted(ctx context.Context, scanID string) bool {
	if scanID == "" || m.store == nil {
		return true // Assume completed if no scan tracking
	}

	scanProgressRepo := m.store.ScanProgress()
	phases, err := scanProgressRepo.GetScanPhasesByID(ctx, scanID)
	if err != nil {
		return false
	}

	for _, phase := range phases {
		if phase.PhaseName == "filesystem_indexing" {
			return phase.Status == "completed"
		}
	}

	return false
}

func (m *Manager) completeEnrichment(ctx context.Context, volumeID, scanID string, progress *EnrichmentProgress) error {
	progress.Status = "completed"
	progress.LastUpdate = time.Now()
	m.setProgress(volumeID, progress)

	// Update database
	if scanID != "" && m.store != nil {
		go m.updateDatabasePhaseStatus(context.Background(), scanID, "media_enrichment", "completed", "")
	}

	m.emitEvent(EnrichmentEvent{
		Type:      "completed",
		VolumeID:  volumeID,
		Progress:  progress,
		Timestamp: time.Now(),
	})

	return nil
}

func (m *Manager) updateDatabaseProgressDetailed(ctx context.Context, scanID, phaseName string, progressPercent, itemsProcessed, itemsTotal int) {
	if m.store == nil {
		return
	}

	scanProgressRepo := m.store.ScanProgress()
	status := "running"
	itemsProcessed64 := int64(itemsProcessed)
	itemsTotal64 := int64(itemsTotal)
	
	updateParams := models.UpdateScanPhaseParams{
		ScanID:         scanID,
		PhaseName:      phaseName,
		Status:         &status,
		Progress:       &progressPercent,
		ItemsProcessed: &itemsProcessed64,
		ItemsTotal:     &itemsTotal64,
	}

	err := scanProgressRepo.UpdateScanPhaseProgress(ctx, updateParams)
	if err != nil && m.logger != nil {
		m.logger.Printf("Failed to update %s phase progress for scan %s: %v", phaseName, scanID, err)
	}
}