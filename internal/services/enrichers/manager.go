package enrichers

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// Manager implements the EnrichmentManager interface
type Manager struct {
	config       EnricherConfig
	enrichers    []Enricher
	repository   MediaMetadataRepository
	logger       *log.Logger
	store        store.Store // Database store for progress tracking
	
	// Progress tracking
	progressMutex sync.RWMutex
	progressMap   map[string]*EnrichmentProgress
	
	// Worker management
	workerSemaphore chan struct{}
	
	// Event callbacks
	eventHandlers []func(EnrichmentEvent)
}

// NewManager creates a new enrichment manager
func NewManager(config EnricherConfig, repository MediaMetadataRepository, logger *log.Logger, store store.Store) *Manager {
	manager := &Manager{
		config:          config,
		enrichers:       make([]Enricher, 0),
		repository:      repository,
		logger:          logger,
		store:           store,
		progressMap:     make(map[string]*EnrichmentProgress),
		workerSemaphore: make(chan struct{}, config.MaxConcurrentWorkers),
		eventHandlers:   make([]func(EnrichmentEvent), 0),
	}
	
	// Register default enrichers if enabled
	if config.Enabled {
		manager.RegisterDefaultEnrichers()
	}
	
	return manager
}

// RegisterDefaultEnrichers registers the built-in enrichers
func (m *Manager) RegisterDefaultEnrichers() {
	// Register FFprobe enricher
	if m.config.FFprobeEnabled {
		ffprobe := NewFFprobeEnricher(m.config)
		if ffprobe.IsAvailable() {
			m.RegisterEnricher(ffprobe)
			if m.logger != nil {
				m.logger.Printf("Registered FFprobe enricher")
			}
		} else if m.logger != nil {
			m.logger.Printf("FFprobe enricher unavailable - ffprobe not found")
		}
	}
	
	// Register EXIF enricher
	if m.config.EXIFEnabled {
		exif := NewEXIFEnricher(m.config)
		if exif.IsAvailable() {
			m.RegisterEnricher(exif)
			if m.logger != nil {
				m.logger.Printf("Registered EXIF enricher")
			}
		} else if m.logger != nil {
			m.logger.Printf("EXIF enricher unavailable - exiftool not found")
		}
	}
	
	// Register subtitle enricher (no external dependencies)
	if m.config.SubtitleEnabled {
		subtitle := NewSubtitleEnricher(m.config)
		m.RegisterEnricher(subtitle)
		if m.logger != nil {
			m.logger.Printf("Registered subtitle enricher")
		}
	}
}

// RegisterEnricher adds a new enricher to the manager
func (m *Manager) RegisterEnricher(enricher Enricher) {
	m.enrichers = append(m.enrichers, enricher)
}

// GetEnrichers returns all registered enrichers
func (m *Manager) GetEnrichers() []Enricher {
	return m.enrichers
}

// IsEnabled returns true if enrichment is enabled
func (m *Manager) IsEnabled() bool {
	return m.config.Enabled && len(m.enrichers) > 0
}

// GetCapabilities returns combined capabilities of all enrichers
func (m *Manager) GetCapabilities() []EnricherCapabilities {
	capabilities := make([]EnricherCapabilities, len(m.enrichers))
	for i, enricher := range m.enrichers {
		capabilities[i] = enricher.GetCapabilities()
	}
	return capabilities
}

// EnrichVolume enriches all eligible files in a volume
func (m *Manager) EnrichVolume(ctx context.Context, volumeID string) error {
	return m.EnrichVolumeWithScanID(ctx, volumeID, "")
}

// EnrichVolumeWithScanID enriches all eligible files in a volume with scan ID for database tracking
func (m *Manager) EnrichVolumeWithScanID(ctx context.Context, volumeID string, scanID string) error {
	if !m.IsEnabled() {
		return fmt.Errorf("enrichment is disabled")
	}
	
	// Initialize progress tracking
	progress := &EnrichmentProgress{
		VolumeID:         volumeID,
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
	
	// Update database progress tracking if scanID provided
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
	
	// Get files that need enrichment
	files, err := m.repository.GetUnenrichedFiles(ctx, volumeID, 10000) // Large batch
	if err != nil {
		progress.Status = "failed"
		progress.LastError = err.Error()
		m.setProgress(volumeID, progress)
		return fmt.Errorf("failed to get unenriched files: %w", err)
	}
	
	progress.TotalFiles = int64(len(files))
	m.setProgress(volumeID, progress)
	
	if len(files) == 0 {
		progress.Status = "completed"
		progress.LastUpdate = time.Now()
		m.setProgress(volumeID, progress)
		
		// Update database - mark media enrichment phase as completed
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
	
	// Process files with workers
	results := make(chan EnrichmentResult, len(files))
	errors := make(chan error, len(files))
	
	// Start workers
	var wg sync.WaitGroup
	for _, file := range files {
		wg.Add(1)
		go func(fileInfo FileInfo) {
			defer wg.Done()
			
			// Acquire worker semaphore
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
					Timestamp:     time.Now(),
					FileName:      fileInfo.Name,
					FilePath:      fileInfo.Path,
					EnricherName:  m.determineEnricherFromError(err),
					ErrorType:     m.categorizeError(err),
					ErrorMessage:  err.Error(),
					TechnicalDetails: m.extractTechnicalDetails(err),
				}
				
				// Add to progress tracking
				m.addErrorToProgress(volumeID, enrichmentErr)
				
				errors <- err
			} else {
				results <- *result
			}
		}(file)
	}
	
	// Close channels when all workers are done
	go func() {
		wg.Wait()
		close(results)
		close(errors)
	}()
	
	// Collect results and update progress
	var enrichmentResults []EnrichmentResult
	var lastError error
	
	for {
		select {
		case result, ok := <-results:
			if !ok {
				results = nil
			} else {
				enrichmentResults = append(enrichmentResults, result)
				
				// Update progress
				m.updateProgressWithResult(volumeID, result)
			}
		case err, ok := <-errors:
			if !ok {
				errors = nil
			} else {
				lastError = err
				progress.ErrorsCount++
				progress.FailedFiles++
				progress.LastError = err.Error()
				if m.logger != nil {
					m.logger.Printf("Enrichment error: %v", err)
				}
			}
		case <-ctx.Done():
			progress.Status = "cancelled"
			progress.LastError = "Context cancelled"
			m.setProgress(volumeID, progress)
			
			// Update database - mark media enrichment phase as failed due to cancellation
			if scanID != "" && m.store != nil {
				go m.updateDatabasePhaseStatus(context.Background(), scanID, "media_enrichment", "failed", "Context cancelled")
			}
			
			return ctx.Err()
		}
		
		if results == nil && errors == nil {
			break
		}
	}
	
	// Save all results in batch
	if len(enrichmentResults) > 0 {
		if err := m.repository.BulkSaveMetadata(ctx, enrichmentResults); err != nil {
			progress.Status = "failed"
			progress.LastError = fmt.Sprintf("Failed to save metadata: %v", err)
			m.setProgress(volumeID, progress)
			return fmt.Errorf("failed to save enrichment results: %w", err)
		}
	}
	
	// Finalize progress
	progress.Status = "completed"
	var finalStatus = "completed"
	var errorMessage = ""
	if lastError != nil && progress.SuccessfulFiles == 0 {
		progress.Status = "failed"
		finalStatus = "failed"
		errorMessage = progress.LastError
	}
	progress.LastUpdate = time.Now()
	m.setProgress(volumeID, progress)
	
	// Update database - mark media enrichment phase as completed or failed
	if scanID != "" && m.store != nil {
		go m.updateDatabasePhaseStatus(context.Background(), scanID, "media_enrichment", finalStatus, errorMessage)
	}
	
	// Emit completion event
	m.emitEvent(EnrichmentEvent{
		Type:      "completed",
		VolumeID:  volumeID,
		Progress:  progress,
		Timestamp: time.Now(),
	})
	
	if m.logger != nil {
		m.logger.Printf("Volume enrichment completed: %s - %d/%d files enriched successfully", 
			volumeID, progress.SuccessfulFiles, progress.TotalFiles)
	}
	
	return lastError
}

// EnrichFile enriches a single file with all applicable enrichers
func (m *Manager) EnrichFile(ctx context.Context, fileInfo FileInfo) (*EnrichmentResult, error) {
	if !m.IsEnabled() {
		return nil, fmt.Errorf("enrichment is disabled")
	}
	
	start := time.Now()
	var bestResult *EnrichmentResult
	var lastError error
	
	// Try each enricher that can handle this file
	for _, enricher := range m.enrichers {
		if !enricher.CanEnrich(fileInfo) {
			continue
		}
		
		// Create context with timeout
		enrichCtx, cancel := context.WithTimeout(ctx, m.config.TimeoutPerFile)
		
		metadata, err := enricher.Enrich(enrichCtx, fileInfo)
		cancel()
		
		result := &EnrichmentResult{
			FileID:       fileInfo.ID,
			Success:      err == nil,
			Duration:     time.Since(start),
			EnrichedAt:   time.Now(),
			EnricherName: enricher.Name(),
		}
		
		if err != nil {
			result.Error = err.Error()
			lastError = err
			if m.logger != nil {
				m.logger.Printf("Enricher %s failed for file %s: %v", 
					enricher.Name(), fileInfo.Name, err)
			}
		} else {
			result.Metadata = metadata
			bestResult = result
			break // Use first successful enricher
		}
	}
	
	if bestResult != nil {
		return bestResult, nil
	}
	
	// No enrichers could process this file
	if lastError != nil {
		return &EnrichmentResult{
			FileID:       fileInfo.ID,
			Success:      false,
			Error:        lastError.Error(),
			Duration:     time.Since(start),
			EnrichedAt:   time.Now(),
			EnricherName: "all_enrichers",
		}, lastError
	}
	
	return &EnrichmentResult{
		FileID:       fileInfo.ID,
		Success:      false,
		Error:        "no applicable enrichers found",
		Duration:     time.Since(start),
		EnrichedAt:   time.Now(),
		EnricherName: "none",
	}, fmt.Errorf("no applicable enrichers for file %s", fileInfo.Name)
}

// GetProgress returns current enrichment progress for a volume
func (m *Manager) GetProgress(volumeID string) *EnrichmentProgress {
	m.progressMutex.RLock()
	defer m.progressMutex.RUnlock()
	
	if progress, exists := m.progressMap[volumeID]; exists {
		// Return a copy to avoid race conditions
		progressCopy := *progress
		return &progressCopy
	}
	
	return nil
}

// setProgress updates progress for a volume
func (m *Manager) setProgress(volumeID string, progress *EnrichmentProgress) {
	m.progressMutex.Lock()
	defer m.progressMutex.Unlock()
	
	m.progressMap[volumeID] = progress
}

// updateProgressWithResult updates progress based on enrichment result
func (m *Manager) updateProgressWithResult(volumeID string, result EnrichmentResult) {
	m.progressMutex.Lock()
	defer m.progressMutex.Unlock()
	
	progress, exists := m.progressMap[volumeID]
	if !exists {
		return
	}
	
	progress.ProcessedFiles++
	progress.LastUpdate = time.Now()
	
	if result.Success {
		progress.SuccessfulFiles++
	} else {
		progress.FailedFiles++
		progress.ErrorsCount++
		if result.Error != "" {
			progress.LastError = result.Error
		}
	}
	
	// Update enricher-specific progress
	if enricherProgress, exists := progress.EnricherProgress[result.EnricherName]; exists {
		enricherProgress.ProcessedFiles++
		enricherProgress.LastUpdate = time.Now()
		
		if result.Success {
			enricherProgress.SuccessfulFiles++
		} else {
			enricherProgress.FailedFiles++
		}
		
		// Update average time
		if enricherProgress.ProcessedFiles > 0 {
			totalTime := enricherProgress.AverageTime * time.Duration(enricherProgress.ProcessedFiles-1)
			enricherProgress.AverageTime = (totalTime + result.Duration) / time.Duration(enricherProgress.ProcessedFiles)
		}
	}
	
	// Calculate overall performance metrics
	if progress.ProcessedFiles > 0 {
		elapsed := progress.LastUpdate.Sub(progress.StartedAt)
		if elapsed > 0 {
			progress.FilesPerSecond = float64(progress.ProcessedFiles) / elapsed.Seconds()
			
			// Estimate remaining time
			if progress.TotalFiles > progress.ProcessedFiles {
				remainingFiles := progress.TotalFiles - progress.ProcessedFiles
				progress.EstimatedRemaining = time.Duration(float64(remainingFiles) / progress.FilesPerSecond * float64(time.Second))
			}
		}
	}
	
	// Emit progress event
	m.emitEvent(EnrichmentEvent{
		Type:      "progress",
		VolumeID:  volumeID,
		FileID:    &result.FileID,
		Progress:  progress,
		Result:    &result,
		Timestamp: time.Now(),
	})
}

// AddEventHandler adds an event handler function
func (m *Manager) AddEventHandler(handler func(EnrichmentEvent)) {
	m.eventHandlers = append(m.eventHandlers, handler)
}

// emitEvent sends an event to all registered handlers
func (m *Manager) emitEvent(event EnrichmentEvent) {
	for _, handler := range m.eventHandlers {
		go handler(event) // Run handlers asynchronously
	}
}

// GetStats returns enrichment statistics for a volume
func (m *Manager) GetStats(ctx context.Context, volumeID string) (*EnrichmentProgress, error) {
	// Get fresh progress from repository
	progress, err := m.repository.GetEnrichmentProgress(ctx, volumeID)
	if err != nil {
		return nil, err
	}
	
	return progress, nil
}

// ClearProgress removes progress tracking for a volume (cleanup)
func (m *Manager) ClearProgress(volumeID string) {
	m.progressMutex.Lock()
	defer m.progressMutex.Unlock()
	
	delete(m.progressMap, volumeID)
}

// addErrorToProgress adds a detailed error to the progress tracking
func (m *Manager) addErrorToProgress(volumeID string, enrichmentErr models.EnrichmentError) {
	m.progressMutex.Lock()
	defer m.progressMutex.Unlock()
	
	if progress, exists := m.progressMap[volumeID]; exists {
		// Add to recent errors (keep last 20 errors)
		progress.RecentErrors = append(progress.RecentErrors, enrichmentErr)
		if len(progress.RecentErrors) > 20 {
			progress.RecentErrors = progress.RecentErrors[len(progress.RecentErrors)-20:]
		}
		
		// Update enricher-specific progress
		if progress.EnricherProgress == nil {
			progress.EnricherProgress = make(map[string]*EnricherProgress)
		}
		if enricherProgress, exists := progress.EnricherProgress[enrichmentErr.EnricherName]; exists {
			enricherProgress.FailedFiles++
			enricherProgress.LastError = enrichmentErr.ErrorMessage
			enricherProgress.LastUpdate = time.Now()
		}
	}
}

// determineEnricherFromError extracts the enricher name from an error
func (m *Manager) determineEnricherFromError(err error) string {
	errStr := err.Error()
	if strings.Contains(errStr, "ffprobe") {
		return "ffprobe"
	}
	if strings.Contains(errStr, "exiftool") {
		return "exiftool"  
	}
	if strings.Contains(errStr, "subtitle") {
		return "subtitle"
	}
	return "unknown"
}

// categorizeError determines the error type from an error
func (m *Manager) categorizeError(err error) string {
	errStr := err.Error()
	if strings.Contains(errStr, "ffprobe failed") {
		return "ffprobe_execution_failed"
	}
	if strings.Contains(errStr, "exiftool failed") {
		return "exiftool_execution_failed"
	}
	if strings.Contains(errStr, "no such file") || strings.Contains(errStr, "file not found") {
		return "file_not_found"
	}
	if strings.Contains(errStr, "permission denied") {
		return "permission_denied"
	}
	if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "context deadline exceeded") {
		return "timeout"
	}
	if strings.Contains(errStr, "exit status") {
		return "tool_exit_error"
	}
	return "unknown_error"
}

// extractTechnicalDetails extracts technical details from an error
func (m *Manager) extractTechnicalDetails(err error) string {
	errStr := err.Error()
	
	// Look for stderr output in parentheses
	if idx := strings.LastIndex(errStr, "(stderr:"); idx != -1 {
		if endIdx := strings.Index(errStr[idx:], ")"); endIdx != -1 {
			return strings.TrimSpace(errStr[idx+9:idx+endIdx])
		}
	}
	
	// Look for exit status
	if strings.Contains(errStr, "exit status") {
		return errStr
	}
	
	return ""
}

// updateDatabasePhaseStatus updates the media enrichment phase status in the database
func (m *Manager) updateDatabasePhaseStatus(ctx context.Context, scanID, phaseName, status, errorMessage string) {
	if m.store == nil {
		return
	}

	scanProgressRepo := m.store.ScanProgress()
	
	if status == "completed" {
		err := scanProgressRepo.CompleteScanPhase(ctx, scanID, phaseName)
		if err != nil {
			// Log error but don't fail the enrichment
			if m.logger != nil {
				m.logger.Printf("Failed to complete %s phase for scan %s: %v", phaseName, scanID, err)
			}
		}
	} else if status == "failed" {
		err := scanProgressRepo.FailScanPhase(ctx, scanID, phaseName, errorMessage)
		if err != nil {
			if m.logger != nil {
				m.logger.Printf("Failed to mark %s phase as failed for scan %s: %v", phaseName, scanID, err)
			}
		}
	} else if status == "running" {
		// Update phase progress to running
		err := scanProgressRepo.UpdateScanPhaseProgress(ctx, models.UpdateScanPhaseParams{
			ScanID:    scanID,
			PhaseName: phaseName,
			Status:    &status,
		})
		if err != nil {
			if m.logger != nil {
				m.logger.Printf("Failed to update %s phase status for scan %s: %v", phaseName, scanID, err)
			}
		}
	}
}