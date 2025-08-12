package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mantonx/volumeviz/internal/store"
)

// NoOpScanRepository provides a no-op implementation during database cleanup
type NoOpScanRepository struct{}

// StoreBasedRepository implements ScanRepository using store facade directly
type StoreBasedRepository struct {
	store *store.StoreFacade
}

// NewScanRepository creates a new scan repository implementation using store facade
func NewScanRepository(storeFacade *store.StoreFacade) ScanRepository {
	if storeFacade != nil {
		return &StoreBasedRepository{store: storeFacade}
	}
	return &NoOpScanRepository{}
}

// StoreBasedRepository implementation

// Volume stats operations
func (r *StoreBasedRepository) InsertVolumeStats(ctx context.Context, stats *store.VolumeSizeResult) error {
	return r.store.InsertVolumeSize(ctx, *stats)
}

func (r *StoreBasedRepository) GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*store.VolumeSizeResult, error) {
	return r.store.GetVolumeSizesByName(ctx, volumeName, int32(limit))
}

func (r *StoreBasedRepository) GetLatestVolumeStats(ctx context.Context, volumeName string) (*store.VolumeSizeResult, error) {
	// Get volume ID first
	volumes, err := r.store.ListVolumes(ctx, 1000, 0)
	if err != nil {
		return nil, err
	}
	
	var volumeID string
	for _, v := range volumes {
		if v.Name == volumeName {
			volumeID = v.VolumeID
			break
		}
	}
	
	if volumeID == "" {
		return nil, fmt.Errorf("volume not found: %s", volumeName)
	}
	
	return r.store.GetLatestVolumeSize(ctx, volumeID)
}

// Scan runs operations
func (r *StoreBasedRepository) InsertScanRun(ctx context.Context, run *store.ScanJobResult) error {
	var estimatedDuration *time.Duration
	if run.EstimatedDuration != nil {
		estimatedDuration = run.EstimatedDuration
	}
	
	_, err := r.store.CreateScanJob(ctx, run.ScanID, run.VolumeID, run.Method, estimatedDuration)
	return err
}

func (r *StoreBasedRepository) UpdateScanRun(ctx context.Context, run *store.ScanJobResult) error {
	if run.ErrorMessage != nil {
		return r.store.FailScanJob(ctx, run.ScanID, *run.ErrorMessage)
	}
	
	if run.Status == "running" && run.StartedAt != nil {
		return r.store.StartScanJob(ctx, run.ScanID)
	}
	
	if run.Status == "completed" && run.CompletedAt != nil {
		return r.store.CompleteScanJob(ctx, run.ScanID, run.Status, nil)
	}
	
	return r.store.UpdateScanJobStatusAndProgress(ctx, run.ScanID, run.Status, run.Progress)
}

func (r *StoreBasedRepository) GetScanRunByID(ctx context.Context, scanID string) (*store.ScanJobResult, error) {
	return r.store.GetScanJobByScanID(ctx, scanID)
}

func (r *StoreBasedRepository) GetActiveScanRuns(ctx context.Context) ([]*store.ScanJobResult, error) {
	return r.store.GetActiveScanJobs(ctx)
}

// Volume operations
func (r *StoreBasedRepository) ListVolumes(ctx context.Context) ([]*store.Volume, error) {
	volumeResults, err := r.store.ListVolumes(ctx, 1000, 0)
	if err != nil {
		return nil, err
	}
	
	// Convert facade results to store models
	volumes := make([]*store.Volume, 0, len(volumeResults))
	for _, vol := range volumeResults {
		if vol.IsActive {
			// Parse labels and options from JSON strings
			labels := make(map[string]string)
			if vol.Labels != "" {
				json.Unmarshal([]byte(vol.Labels), &labels)
			}
			
			options := make(map[string]string)
			if vol.Options != "" {
				json.Unmarshal([]byte(vol.Options), &options)
			}
			
			volumes = append(volumes, &store.Volume{
				ID:         vol.ID,
				VolumeID:   vol.VolumeID,
				Name:       vol.Name,
				Driver:     vol.Driver,
				Mountpoint: vol.Mountpoint,
				Labels:     labels,
				Options:    options,
				Scope:      vol.Scope,
				Status:     vol.Status,
				IsActive:   vol.IsActive,
				CreatedAt:  vol.CreatedAt,
				UpdatedAt:  vol.UpdatedAt,
			})
		}
	}
	
	return volumes, nil
}

func (r *StoreBasedRepository) UpsertVolume(ctx context.Context, volume *store.Volume) error {
	// Convert store.Volume to facade VolumeParams
	labelsJSON, _ := json.Marshal(volume.Labels)
	optionsJSON, _ := json.Marshal(volume.Options)
	
	params := store.VolumeParams{
		VolumeID:   volume.VolumeID,
		Name:       volume.Name,
		Driver:     volume.Driver,
		Mountpoint: volume.Mountpoint,
		Labels:     string(labelsJSON),
		Options:    string(optionsJSON),
		Scope:      volume.Scope,
		Status:     volume.Status,
		IsActive:   volume.IsActive,
	}
	
	_, err := r.store.UpsertVolume(ctx, params)
	return err
}

// NoOpScanRepository implementation for fallback

func (r *NoOpScanRepository) InsertVolumeStats(ctx context.Context, stats *store.VolumeSizeResult) error {
	return nil
}

func (r *NoOpScanRepository) GetVolumeStatsByName(ctx context.Context, volumeName string, limit int) ([]*store.VolumeSizeResult, error) {
	return []*store.VolumeSizeResult{}, nil
}

func (r *NoOpScanRepository) GetLatestVolumeStats(ctx context.Context, volumeName string) (*store.VolumeSizeResult, error) {
	return nil, fmt.Errorf("scheduler temporarily disabled during database cleanup")
}

// Scan runs operations
func (r *NoOpScanRepository) InsertScanRun(ctx context.Context, run *store.ScanJobResult) error {
	return nil
}

func (r *NoOpScanRepository) UpdateScanRun(ctx context.Context, run *store.ScanJobResult) error {
	return nil
}

func (r *NoOpScanRepository) GetScanRunByID(ctx context.Context, scanID string) (*store.ScanJobResult, error) {
	return nil, fmt.Errorf("scheduler temporarily disabled during database cleanup")
}

func (r *NoOpScanRepository) GetActiveScanRuns(ctx context.Context) ([]*store.ScanJobResult, error) {
	return []*store.ScanJobResult{}, nil
}

// Volume operations
func (r *NoOpScanRepository) ListVolumes(ctx context.Context) ([]*store.Volume, error) {
	return []*store.Volume{}, nil
}

func (r *NoOpScanRepository) UpsertVolume(ctx context.Context, volume *store.Volume) error {
	return nil
}
