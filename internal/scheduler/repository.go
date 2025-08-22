package scheduler

import (
	"context"
	"fmt"

	"github.com/mantonx/volumeviz/internal/interfaces"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// NoOpScanRepository provides a no-op implementation during database cleanup
type NoOpScanRepository struct{}

// StoreBasedRepository implements ScanRepository using store interface directly
type StoreBasedRepository struct {
	store store.Store
}

// NewScanRepository creates a new scan repository implementation using store interface
func NewScanRepository(storeInstance store.Store) ScanRepository {
	if storeInstance != nil {
		return &StoreBasedRepository{store: storeInstance}
	}
	return &NoOpScanRepository{}
}

// StoreBasedRepository implementation

// Volume stats operations
func (r *StoreBasedRepository) InsertVolumeStats(ctx context.Context, stats *models.DirRollup) error {
	// Use the stats repository for inserting volume statistics
	return r.store.Stats().InsertVolumeStats(ctx, stats)
}

func (r *StoreBasedRepository) InsertScanResult(ctx context.Context, scanResult *interfaces.ScanResult) error {
	// Use the stats repository for inserting complete scan results
	return r.store.Stats().InsertScanResult(ctx, scanResult)
}

func (r *StoreBasedRepository) GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*models.DirRollup, error) {
	// Use the stats repository for retrieving volume statistics
	return r.store.Stats().GetVolumeStatsByName(ctx, volumeName, limit)
}

func (r *StoreBasedRepository) GetLatestVolumeStats(ctx context.Context, volumeName string) (*models.DirRollup, error) {
	// Use the legacy stats repository method for retrieving latest volume statistics
	return r.store.Stats().GetLatestVolumeStatsLegacy(ctx, volumeName)
}

// Scan runs operations
func (r *StoreBasedRepository) InsertScanRun(ctx context.Context, run *models.ScanJob) error {
	// Convert ScanJob to CreateScanJobParams
	params := models.CreateScanJobParams{
		ScanID:       run.ScanID,
		VolumeID:     run.VolumeID,
		TriggerType:  run.TriggerType,
		TriggerBy:    run.TriggerBy,
		Status:       run.Status,
		ScanProgress: run.ScanProgress,
		Progress:     run.Progress,
		Method:       run.Method,
		StartedAt:    run.StartedAt,
		CompletedAt:  run.CompletedAt,
	}
	
	_, err := r.store.Scans().CreateScanJob(ctx, params)
	return err
}

func (r *StoreBasedRepository) UpdateScanRun(ctx context.Context, run *models.ScanJob) error {
	// Update scan job status
	return r.store.Scans().UpdateScanJobStatus(ctx, run.ID, run.Status)
}

func (r *StoreBasedRepository) GetScanRunByID(ctx context.Context, scanID string) (*models.ScanJob, error) {
	// Get scan job by scan ID
	return r.store.Scans().GetScanJobByScanID(ctx, scanID)
}

func (r *StoreBasedRepository) GetActiveScanRuns(ctx context.Context) ([]*models.ScanJob, error) {
	// Get recent scan jobs - use a reasonable limit
	// In practice, "active" might need a specific status filter
	return r.store.Scans().ListScanJobs(ctx, 100, 0)
}

// Volume operations
func (r *StoreBasedRepository) ListVolumes(ctx context.Context) ([]*models.Volume, error) {
	return r.store.Volumes().ListVolumes(ctx, 1000, 0)
}

func (r *StoreBasedRepository) UpsertVolume(ctx context.Context, volume *models.Volume) error {
	// Convert Volume to CreateVolumeParams for upsert
	params := models.CreateVolumeParams{
		VolumeID:   volume.VolumeID,
		Name:       volume.Name,
		Driver:     volume.Driver,
		Mountpoint: volume.Mountpoint,
		Labels:     volume.Labels,
		Options:    volume.Options,
		Scope:      volume.Scope,
		Status:     volume.Status,
		IsActive:   volume.IsActive,
	}
	
	_, err := r.store.Volumes().UpsertVolume(ctx, params)
	return err
}

// NoOpScanRepository implementation for fallback

func (r *NoOpScanRepository) InsertVolumeStats(ctx context.Context, stats *models.DirRollup) error {
	return nil
}

func (r *NoOpScanRepository) InsertScanResult(ctx context.Context, scanResult *interfaces.ScanResult) error {
	return nil
}

func (r *NoOpScanRepository) GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*models.DirRollup, error) {
	return []*models.DirRollup{}, nil
}

func (r *NoOpScanRepository) GetLatestVolumeStats(ctx context.Context, volumeName string) (*models.DirRollup, error) {
	return nil, fmt.Errorf("scheduler temporarily disabled during database cleanup")
}

// Scan runs operations
func (r *NoOpScanRepository) InsertScanRun(ctx context.Context, run *models.ScanJob) error {
	return nil
}

func (r *NoOpScanRepository) UpdateScanRun(ctx context.Context, run *models.ScanJob) error {
	return nil
}

func (r *NoOpScanRepository) GetScanRunByID(ctx context.Context, scanID string) (*models.ScanJob, error) {
	return nil, fmt.Errorf("scheduler temporarily disabled during database cleanup")
}

func (r *NoOpScanRepository) GetActiveScanRuns(ctx context.Context) ([]*models.ScanJob, error) {
	return []*models.ScanJob{}, nil
}

// Volume operations
func (r *NoOpScanRepository) ListVolumes(ctx context.Context) ([]*models.Volume, error) {
	return []*models.Volume{}, nil
}

func (r *NoOpScanRepository) UpsertVolume(ctx context.Context, volume *models.Volume) error {
	return nil
}
