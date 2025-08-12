package models

import (
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/core/interfaces"
	"github.com/stretchr/testify/assert"
)

func TestErrorResponse_Structure(t *testing.T) {
	response := ErrorResponse{
		Error:   "Volume not found",
		Code:    "VOLUME_NOT_FOUND",
		Details: map[string]any{"volume_id": "test-vol"},
	}

	assert.Equal(t, "Volume not found", response.Error)
	assert.Equal(t, "VOLUME_NOT_FOUND", response.Code)
	assert.NotNil(t, response.Details)
	assert.Equal(t, "test-vol", response.Details["volume_id"])
}

func TestHealthResponse_Structure(t *testing.T) {
	now := time.Now()
	response := HealthResponse{
		Status:    "ok",
		Service:   "volumeviz",
		Version:   "v1",
		Timestamp: now,
		Components: map[string]interface{}{
			"docker":   "connected",
			"database": "healthy",
		},
	}

	assert.Equal(t, "ok", response.Status)
	assert.Equal(t, "volumeviz", response.Service)
	assert.Equal(t, "v1", response.Version)
	assert.Equal(t, now, response.Timestamp)
	assert.Equal(t, "connected", response.Components["docker"])
	assert.Equal(t, "healthy", response.Components["database"])
}

func TestVolumeResponse_Structure(t *testing.T) {
	now := time.Now()
	response := VolumeResponse{
		ID:         "test-vol",
		Name:       "test-volume",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/test/_data",
		CreatedAt:  now,
		Labels:     map[string]string{"env": "test"},
		Options:    map[string]string{"type": "none"},
	}

	assert.Equal(t, "test-vol", response.ID)
	assert.Equal(t, "test-volume", response.Name)
	assert.Equal(t, "local", response.Driver)
	assert.Equal(t, "/var/lib/docker/volumes/test/_data", response.Mountpoint)
	assert.Equal(t, now, response.CreatedAt)
	assert.Equal(t, "test", response.Labels["env"])
	assert.Equal(t, "none", response.Options["type"])
}

func TestVolumeListResponse_Structure(t *testing.T) {
	volumes := []VolumeResponse{
		{ID: "vol1", Name: "volume1"},
		{ID: "vol2", Name: "volume2"},
	}

	response := VolumeListResponse{
		Volumes: volumes,
		Total:   2,
	}

	assert.Len(t, response.Volumes, 2)
	assert.Equal(t, 2, response.Total)
	assert.Equal(t, "vol1", response.Volumes[0].ID)
	assert.Equal(t, "vol2", response.Volumes[1].ID)
}

func TestScanResult_Structure(t *testing.T) {
	now := time.Now()
	duration := 30 * time.Second

	result := ScanResult{
		VolumeID:       "test-vol",
		TotalSize:      1024000,
		FileCount:      150,
		DirectoryCount: 10,
		LargestFile:    102400,
		Method:         "du",
		ScannedAt:      now,
		Duration:       duration,
		CacheHit:       false,
		FilesystemType: "ext4",
	}

	assert.Equal(t, "test-vol", result.VolumeID)
	assert.Equal(t, int64(1024000), result.TotalSize)
	assert.Equal(t, 150, result.FileCount)
	assert.Equal(t, 10, result.DirectoryCount)
	assert.Equal(t, int64(102400), result.LargestFile)
	assert.Equal(t, "du", result.Method)
	assert.Equal(t, now, result.ScannedAt)
	assert.Equal(t, duration, result.Duration)
	assert.False(t, result.CacheHit)
	assert.Equal(t, "ext4", result.FilesystemType)
}

func TestScanResponse_Structure(t *testing.T) {
	scanResult := &ScanResult{
		VolumeID: "test-vol",
		Method:   "native",
	}

	response := ScanResponse{
		VolumeID: "test-vol",
		Result:   scanResult,
		Cached:   true,
	}

	assert.Equal(t, "test-vol", response.VolumeID)
	assert.NotNil(t, response.Result)
	assert.Equal(t, "test-vol", response.Result.VolumeID)
	assert.True(t, response.Cached)
}

func TestAsyncScanResponse_Structure(t *testing.T) {
	response := AsyncScanResponse{
		ScanID:   "scan-123",
		VolumeID: "test-vol",
		Status:   "started",
	}

	assert.Equal(t, "scan-123", response.ScanID)
	assert.Equal(t, "test-vol", response.VolumeID)
	assert.Equal(t, "started", response.Status)
}

func TestScanProgress_Structure(t *testing.T) {
	now := time.Now()
	remaining := 2 * time.Minute

	progress := ScanProgress{
		ScanID:             "scan-123",
		VolumeID:           "test-vol",
		Status:             "running",
		Progress:           0.75,
		FilesScanned:       1500,
		CurrentPath:        "/data/test",
		EstimatedRemaining: remaining,
		Method:             "native",
		StartedAt:          now,
		Error:              "",
	}

	assert.Equal(t, "scan-123", progress.ScanID)
	assert.Equal(t, "test-vol", progress.VolumeID)
	assert.Equal(t, "running", progress.Status)
	assert.Equal(t, 0.75, progress.Progress)
	assert.Equal(t, 1500, progress.FilesScanned)
	assert.Equal(t, "/data/test", progress.CurrentPath)
	assert.Equal(t, remaining, progress.EstimatedRemaining)
	assert.Equal(t, "native", progress.Method)
	assert.Equal(t, now, progress.StartedAt)
	assert.Equal(t, "", progress.Error)
}

func TestBulkScanRequest_Structure(t *testing.T) {
	request := BulkScanRequest{
		VolumeIDs: []string{"vol1", "vol2", "vol3"},
		Async:     true,
		Method:    "du",
	}

	assert.Equal(t, []string{"vol1", "vol2", "vol3"}, request.VolumeIDs)
	assert.True(t, request.Async)
	assert.Equal(t, "du", request.Method)
}

func TestBulkScanResponse_Structure(t *testing.T) {
	results := map[string]any{
		"vol1": map[string]any{"size": 1024},
		"vol2": map[string]any{"size": 2048},
	}
	failed := map[string]string{
		"vol3": "permission denied",
	}

	response := BulkScanResponse{
		ScanID:   "bulk-123",
		Results:  results,
		Failed:   failed,
		Total:    3,
		Success:  2,
		Failures: 1,
	}

	assert.Equal(t, "bulk-123", response.ScanID)
	assert.Len(t, response.Results, 2)
	assert.Len(t, response.Failed, 1)
	assert.Equal(t, 3, response.Total)
	assert.Equal(t, 2, response.Success)
	assert.Equal(t, 1, response.Failures)
}

func TestRefreshRequest_Structure(t *testing.T) {
	request := RefreshRequest{
		Async:  false,
		Method: "diskus",
	}

	assert.False(t, request.Async)
	assert.Equal(t, "diskus", request.Method)
}

func TestMethodInfo_Structure(t *testing.T) {
	method := MethodInfo{
		Name:        "du",
		Available:   true,
		Description: "du-based volume scanning",
		Performance: "medium",
		Accuracy:    "high",
		Features:    []string{"reliable", "standard_tool"},
	}

	assert.Equal(t, "du", method.Name)
	assert.True(t, method.Available)
	assert.Equal(t, "du-based volume scanning", method.Description)
	assert.Equal(t, "medium", method.Performance)
	assert.Equal(t, "high", method.Accuracy)
	assert.Equal(t, []string{"reliable", "standard_tool"}, method.Features)
}

func TestSystemInfoResponse_Structure(t *testing.T) {
	response := SystemInfoResponse{}

	// Test Docker info
	response.Docker.Version = "24.0.6"
	response.Docker.APIVersion = "1.43"
	response.Docker.ServerVersion = "24.0.6"
	response.Docker.Connected = true

	// Test VolumeViz info
	response.VolumeViz.Version = "1.0.0"
	response.VolumeViz.BuildTime = "2025-01-31T22:30:00Z"
	response.VolumeViz.GoVersion = "go1.24.5"

	// Test System info
	response.System.Platform = "linux"
	response.System.Architecture = "amd64"
	response.System.CPUs = 4
	response.System.Memory = 8589934592

	assert.Equal(t, "24.0.6", response.Docker.Version)
	assert.Equal(t, "1.43", response.Docker.APIVersion)
	assert.True(t, response.Docker.Connected)
	assert.Equal(t, "1.0.0", response.VolumeViz.Version)
	assert.Equal(t, "linux", response.System.Platform)
	assert.Equal(t, 4, response.System.CPUs)
}

func TestVolumeDetailResponse_Structure(t *testing.T) {
	volume := VolumeResponse{
		ID:   "test-vol",
		Name: "test-volume",
	}

	containers := []VolumeContainer{
		{ID: "container1", Name: "app1", State: "running"},
		{ID: "container2", Name: "app2", State: "stopped"},
	}

	response := VolumeDetailResponse{
		Volume:     volume,
		Containers: containers,
	}

	assert.Equal(t, "test-vol", response.Volume.ID)
	assert.Len(t, response.Containers, 2)
	assert.Equal(t, "container1", response.Containers[0].ID)
	assert.Equal(t, "running", response.Containers[0].State)
}

func TestVolumeContainer_Structure(t *testing.T) {
	container := VolumeContainer{
		ID:    "abc123",
		Name:  "my-container",
		State: "running",
	}

	assert.Equal(t, "abc123", container.ID)
	assert.Equal(t, "my-container", container.Name)
	assert.Equal(t, "running", container.State)
}

func TestConvertScanResult_Success(t *testing.T) {
	now := time.Now()
	duration := 45 * time.Second

	coreResult := &interfaces.ScanResult{
		VolumeID:       "test-vol",
		TotalSize:      2048000,
		FileCount:      300,
		DirectoryCount: 20,
		LargestFile:    204800,
		Method:         "native",
		ScannedAt:      now,
		Duration:       duration,
		CacheHit:       true,
		FilesystemType: "xfs",
	}

	converted := ConvertScanResult(coreResult)

	assert.NotNil(t, converted)
	assert.Equal(t, "test-vol", converted.VolumeID)
	assert.Equal(t, int64(2048000), converted.TotalSize)
	assert.Equal(t, 300, converted.FileCount)
	assert.Equal(t, 20, converted.DirectoryCount)
	assert.Equal(t, int64(204800), converted.LargestFile)
	assert.Equal(t, "native", converted.Method)
	assert.Equal(t, now, converted.ScannedAt)
	assert.Equal(t, duration, converted.Duration)
	assert.True(t, converted.CacheHit)
	assert.Equal(t, "xfs", converted.FilesystemType)
}

func TestConvertScanResult_Nil(t *testing.T) {
	converted := ConvertScanResult(nil)
	assert.Nil(t, converted)
}

func TestConvertScanProgress_Success(t *testing.T) {
	now := time.Now()
	remaining := 3 * time.Minute

	coreProgress := &interfaces.ScanProgress{
		ScanID:             "scan-456",
		VolumeID:           "test-vol",
		Status:             "running",
		Progress:           0.85,
		FilesScanned:       2000,
		CurrentPath:        "/data/large",
		EstimatedRemaining: remaining,
		Method:             "du",
		StartedAt:          now,
		Error:              "warning: some files skipped",
	}

	converted := ConvertScanProgress(coreProgress)

	assert.NotNil(t, converted)
	assert.Equal(t, "scan-456", converted.ScanID)
	assert.Equal(t, "test-vol", converted.VolumeID)
	assert.Equal(t, "running", converted.Status)
	assert.Equal(t, 0.85, converted.Progress)
	assert.Equal(t, 2000, converted.FilesScanned)
	assert.Equal(t, "/data/large", converted.CurrentPath)
	assert.Equal(t, remaining, converted.EstimatedRemaining)
	assert.Equal(t, "du", converted.Method)
	assert.Equal(t, now, converted.StartedAt)
	assert.Equal(t, "warning: some files skipped", converted.Error)
}

func TestConvertScanProgress_Nil(t *testing.T) {
	converted := ConvertScanProgress(nil)
	assert.Nil(t, converted)
}

func TestConvertMethodInfo_Success(t *testing.T) {
	coreMethods := []interfaces.MethodInfo{
		{
			Name:        "du",
			Available:   true,
			Description: "du command",
			Performance: "fast",
			Accuracy:    "high",
			Features:    []string{"reliable"},
		},
		{
			Name:        "native",
			Available:   true,
			Description: "native go",
			Performance: "slow",
			Accuracy:    "high",
			Features:    []string{"portable", "progress"},
		},
	}

	converted := ConvertMethodInfo(coreMethods)

	assert.Len(t, converted, 2)

	// First method
	assert.Equal(t, "du", converted[0].Name)
	assert.True(t, converted[0].Available)
	assert.Equal(t, "du command", converted[0].Description)
	assert.Equal(t, "fast", converted[0].Performance)
	assert.Equal(t, "high", converted[0].Accuracy)
	assert.Equal(t, []string{"reliable"}, converted[0].Features)

	// Second method
	assert.Equal(t, "native", converted[1].Name)
	assert.True(t, converted[1].Available)
	assert.Equal(t, "native go", converted[1].Description)
	assert.Equal(t, "slow", converted[1].Performance)
	assert.Equal(t, "high", converted[1].Accuracy)
	assert.Equal(t, []string{"portable", "progress"}, converted[1].Features)
}

func TestConvertMethodInfo_Empty(t *testing.T) {
	converted := ConvertMethodInfo([]interfaces.MethodInfo{})
	assert.Empty(t, converted)
	assert.NotNil(t, converted) // Should be empty slice, not nil
}
