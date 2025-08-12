package scheduler

import (
	"context"
	"fmt"

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
	// TODO: Implement when analytics repository is added
	return nil
}

func (r *StoreBasedRepository) GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*models.DirRollup, error) {
	// TODO: Implement when analytics repository is added
	return []*models.DirRollup{}, nil
}

func (r *StoreBasedRepository) GetLatestVolumeStats(ctx context.Context, volumeName string) (*models.DirRollup, error) {
	// TODO: Implement when analytics repository is added
	return &models.DirRollup{}, nil
}

// Scan runs operations
func (r *StoreBasedRepository) InsertScanRun(ctx context.Context, run *models.ScanJob) error {
	// TODO: Use store.Scans() when available
	return nil
}

func (r *StoreBasedRepository) UpdateScanRun(ctx context.Context, run *models.ScanJob) error {
	// TODO: Use store.Scans() when available
	return nil
}

func (r *StoreBasedRepository) GetScanRunByID(ctx context.Context, scanID string) (*models.ScanJob, error) {
	// TODO: Use store.Scans() when available
	return &models.ScanJob{}, nil
}

func (r *StoreBasedRepository) GetActiveScanRuns(ctx context.Context) ([]*models.ScanJob, error) {
	// TODO: Use store.Scans() when available
	return []*models.ScanJob{}, nil
}

// Volume operations
func (r *StoreBasedRepository) ListVolumes(ctx context.Context) ([]*models.Volume, error) {
	return r.store.Volumes().ListVolumes(ctx, 1000, 0)
}

func (r *StoreBasedRepository) UpsertVolume(ctx context.Context, volume *models.Volume) error {
	// TODO: Implement when volume creation method is available in store
	return nil
}

// NoOpScanRepository implementation for fallback

func (r *NoOpScanRepository) InsertVolumeStats(ctx context.Context, stats *models.DirRollup) error {
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
