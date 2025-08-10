package database

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBaseModel_Structure(t *testing.T) {
	model := BaseModel{
		ID: 1,
	}
	
	assert.Equal(t, 1, model.ID)
	assert.True(t, model.CreatedAt.IsZero()) // Will be zero initially
	assert.True(t, model.UpdatedAt.IsZero()) // Will be zero initially
}

func TestVolumeSize_Structure(t *testing.T) {
	volumeSize := VolumeSize{
		VolumeID:       "test-vol",
		TotalSize:      1024,
		FileCount:      10,
		DirectoryCount: 5,
		LargestFile:    512,
		ScanMethod:     "native",
		FilesystemType: "ext4",
		IsValid:        true,
	}
	
	assert.Equal(t, "test-vol", volumeSize.VolumeID)
	assert.Equal(t, int64(1024), volumeSize.TotalSize)
	assert.Equal(t, int64(10), volumeSize.FileCount)
	assert.Equal(t, int64(5), volumeSize.DirectoryCount)
	assert.Equal(t, int64(512), volumeSize.LargestFile)
	assert.Equal(t, "native", volumeSize.ScanMethod)
	assert.Equal(t, "ext4", volumeSize.FilesystemType)
	assert.True(t, volumeSize.IsValid)
}

func TestScanJob_Structure(t *testing.T) {
	scanJob := ScanJob{
		ScanID:   "scan-123",
		VolumeID: "vol-456",
		Status:   "running",
		Progress: 50,
		Method:   "du",
	}
	
	assert.Equal(t, "scan-123", scanJob.ScanID)
	assert.Equal(t, "vol-456", scanJob.VolumeID)
	assert.Equal(t, "running", scanJob.Status)
	assert.Equal(t, 50, scanJob.Progress)
	assert.Equal(t, "du", scanJob.Method)
}