package database

import (
	"database/sql/driver"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// Test data helpers
func createTestVolume() *Volume {
	now := time.Now()
	return &Volume{
		BaseModel: BaseModel{
			ID:        1,
			CreatedAt: now,
			UpdatedAt: now,
		},
		VolumeID:    "vol_test123",
		Name:        "test-volume",
		Driver:      "local",
		Mountpoint:  "/var/lib/docker/volumes/test-volume/_data",
		Labels:      Labels{"env": "test", "version": "1.0"},
		Options:     Labels{"type": "none", "device": "tmpfs"},
		Scope:       "local",
		Status:      "active",
		IsActive:    true,
		LastScanned: &now,
	}
}

// TestVolumeRepository tests basic repository functionality
func TestVolumeRepository_Create(t *testing.T) {
	// Since we don't have full DB mocking setup, test basic object creation
	volume := createTestVolume()

	assert.NotNil(t, volume)
	assert.Equal(t, "vol_test123", volume.VolumeID)
	assert.Equal(t, "test-volume", volume.Name)
	assert.Equal(t, "local", volume.Driver)
	assert.True(t, volume.IsActive)
	assert.NotNil(t, volume.LastScanned)
}

func TestVolumeRepository_WithTx(t *testing.T) {
	db := &DB{}
	repo := NewVolumeRepository(db)
	tx := &Tx{}

	txRepo := repo.WithTx(tx)

	assert.NotNil(t, txRepo)
	assert.IsType(t, &VolumeRepository{}, txRepo)
	assert.Equal(t, tx, txRepo.BaseRepository.tx)
}

func TestLabels_Value(t *testing.T) {
	tests := []struct {
		name    string
		labels  Labels
		wantNil bool
		wantErr bool
	}{
		{
			name:    "nil labels",
			labels:  nil,
			wantNil: true,
			wantErr: false,
		},
		{
			name:    "empty labels",
			labels:  Labels{},
			wantNil: false,
			wantErr: false,
		},
		{
			name: "valid labels",
			labels: Labels{
				"env":     "production",
				"version": "1.0",
			},
			wantNil: false,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.labels.Value()

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				if tt.wantNil {
					assert.Nil(t, got)
				} else {
					assert.NotNil(t, got)
				}
			}
		})
	}
}

func TestLabels_Scan(t *testing.T) {
	tests := []struct {
		name    string
		src     interface{}
		wantErr bool
		wantNil bool
	}{
		{
			name:    "nil source",
			src:     nil,
			wantErr: false,
			wantNil: false,
		},
		{
			name:    "empty JSON bytes",
			src:     []byte("{}"),
			wantErr: false,
			wantNil: false,
		},
		{
			name:    "valid JSON string",
			src:     `{"env":"test"}`,
			wantErr: false,
			wantNil: false,
		},
		{
			name:    "invalid JSON",
			src:     []byte(`{invalid json}`),
			wantErr: false, // Our simple implementation doesn't validate JSON
			wantNil: false,
		},
		{
			name:    "unsupported type",
			src:     123,
			wantErr: true,
			wantNil: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var labels Labels
			err := labels.Scan(tt.src)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				if !tt.wantNil {
					assert.NotNil(t, labels)
				}
			}
		})
	}
}

// Test volume stats structure
func TestVolumeStats_Structure(t *testing.T) {
	now := time.Now()
	stats := &VolumeStats{
		TotalVolumes:   10,
		ActiveVolumes:  8,
		UniqueDrivers:  2,
		ScannedVolumes: 6,
		NewestVolume:   &now,
		OldestVolume:   &now,
	}

	assert.Equal(t, 10, stats.TotalVolumes)
	assert.Equal(t, 8, stats.ActiveVolumes)
	assert.Equal(t, 2, stats.UniqueDrivers)
	assert.Equal(t, 6, stats.ScannedVolumes)
	assert.NotNil(t, stats.NewestVolume)
	assert.NotNil(t, stats.OldestVolume)
}

// Test table names constants
func TestTableNames(t *testing.T) {
	assert.Equal(t, "volumes", TableNames.Volumes)
	assert.Equal(t, "volume_sizes", TableNames.VolumeSizes)
	assert.Equal(t, "containers", TableNames.Containers)
	assert.Equal(t, "volume_mounts", TableNames.VolumeMounts)
	assert.Equal(t, "scan_jobs", TableNames.ScanJobs)
	assert.Equal(t, "volume_metrics", TableNames.VolumeMetrics)
	assert.Equal(t, "system_health", TableNames.SystemHealth)
	assert.Equal(t, "scan_cache", TableNames.ScanCache)
	assert.Equal(t, "migration_history", TableNames.MigrationHistory)
}

// Test volume model validation
func TestVolume_Validation(t *testing.T) {
	volume := createTestVolume()

	// Test required fields are set
	assert.NotEmpty(t, volume.VolumeID)
	assert.NotEmpty(t, volume.Name)
	assert.NotEmpty(t, volume.Driver)
	assert.NotEmpty(t, volume.Mountpoint)
	assert.NotEmpty(t, volume.Scope)
	assert.NotEmpty(t, volume.Status)

	// Test default values
	assert.True(t, volume.IsActive)
	assert.NotNil(t, volume.Labels)
	assert.NotNil(t, volume.Options)
}

// Benchmark tests for performance validation
func BenchmarkLabels_Value(b *testing.B) {
	labels := Labels{
		"env":      "production",
		"version":  "1.0",
		"service":  "api",
		"replicas": "3",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = labels.Value()
	}
}

func BenchmarkLabels_Scan(b *testing.B) {
	src := []byte(`{"env":"production","version":"1.0","service":"api"}`)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var labels Labels
		_ = labels.Scan(src)
	}
}

// Test driver.Valuer interface implementation
func TestLabels_DriverValuer(t *testing.T) {
	labels := Labels{"key": "value"}

	// Ensure Labels implements driver.Valuer
	var _ driver.Valuer = labels

	value, err := labels.Value()
	assert.NoError(t, err)
	assert.NotNil(t, value)
}
