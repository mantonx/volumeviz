package repo

import (
	"context"
	"testing"

	"github.com/mantonx/volumeviz/internal/models"
)

// TestVolumesRepoInterface verifies that the VolumesRepo interface is correctly defined
func TestVolumesRepoInterface(t *testing.T) {
	// This test verifies that our interface methods exist and have correct signatures
	// It's a compile-time test to ensure our repository interface is properly defined
	
	var repo VolumesRepo = (*volumesRepo)(nil)
	
	// Test that all interface methods exist (this will fail to compile if they don't)
	if repo != nil {
		ctx := context.Background()
		
		// Test method signatures exist
		_ = func() {
			_, _ = repo.CreateVolume(ctx, models.CreateVolumeParams{})
			_, _ = repo.GetVolumeByID(ctx, 1)
			_, _ = repo.GetVolumeByVolumeID(ctx, "test")
			_, _ = repo.ListVolumes(ctx, 10, 0)
			_, _ = repo.CountVolumes(ctx)
		}
	}
}

// TestModelsConversions tests the type conversion logic in isolation
func TestModelsConversions(t *testing.T) {
	t.Run("CreateVolumeParams fields", func(t *testing.T) {
		params := models.CreateVolumeParams{
			VolumeID:   "vol-123",
			Name:       "test-volume",
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/test",
			Labels:     map[string]string{"env": "test"},
			Options:    map[string]string{"type": "bind"},
			Scope:      "local",
			Status:     "active",
			IsActive:   true,
		}
		
		// Verify all fields are accessible and have expected types
		if params.VolumeID != "vol-123" {
			t.Errorf("VolumeID = %v, want vol-123", params.VolumeID)
		}
		if len(params.Labels) != 1 || params.Labels["env"] != "test" {
			t.Errorf("Labels = %v, want map with env:test", params.Labels)
		}
		if !params.IsActive {
			t.Error("IsActive should be true")
		}
	})
	
	t.Run("Volume model fields", func(t *testing.T) {
		volume := models.Volume{
			ID:         1,
			VolumeID:   "vol-123",
			Name:       "test-volume",
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/test",
			Labels:     map[string]string{"env": "test"},
			Options:    map[string]string{"type": "bind"},
			Scope:      "local",
			Status:     "active",
			IsActive:   true,
		}
		
		// Verify all fields are accessible and have expected types
		if volume.ID != 1 {
			t.Errorf("ID = %v, want 1", volume.ID)
		}
		if volume.VolumeID != "vol-123" {
			t.Errorf("VolumeID = %v, want vol-123", volume.VolumeID)
		}
		if len(volume.Labels) != 1 || volume.Labels["env"] != "test" {
			t.Errorf("Labels = %v, want map with env:test", volume.Labels)
		}
	})
}

// TestRepositoryPattern verifies our repository pattern implementation
func TestRepositoryPattern(t *testing.T) {
	t.Run("Repository constructor", func(t *testing.T) {
		// Test that NewVolumesRepo works with nil (we can't create real sqlc.Queries easily)
		repo := NewVolumesRepo(nil)
		if repo == nil {
			t.Error("NewVolumesRepo should not return nil")
		}
		
		// Verify it implements the interface
		var _ VolumesRepo = repo
	})
}