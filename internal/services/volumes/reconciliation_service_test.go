package volumes

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockDockerService for testing
type MockDockerService struct {
	mock.Mock
}

func (m *MockDockerService) ListVolumes(ctx context.Context) ([]models.Volume, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Volume), args.Error(1)
}

func (m *MockDockerService) GetVolumeContainers(ctx context.Context, volumeID string) ([]models.VolumeContainer, error) {
	args := m.Called(ctx, volumeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.VolumeContainer), args.Error(1)
}

func (m *MockDockerService) GetVolume(ctx context.Context, volumeID string) (*models.Volume, error) {
	args := m.Called(ctx, volumeID)
	return args.Get(0).(*models.Volume), args.Error(1)
}

func (m *MockDockerService) IsConnected(ctx context.Context) bool {
	args := m.Called(ctx)
	return args.Bool(0)
}

func (m *MockDockerService) Ping(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockDockerService) GetVolumeContainersBatch(ctx context.Context, volumeNames []string) (map[string][]models.VolumeContainer, error) {
	args := m.Called(ctx, volumeNames)
	return args.Get(0).(map[string][]models.VolumeContainer), args.Error(1)
}

// MockStore for testing
type MockStore struct {
	mock.Mock
	queries *MockQueries
}

func (m *MockStore) Queries() interface{} {
	return m.queries
}

func (m *MockStore) Volumes() interface{} {
	args := m.Called()
	return args.Get(0)
}

func (m *MockStore) Stats() interface{} {
	args := m.Called()
	return args.Get(0)
}

// MockQueries for testing
type MockQueries struct {
	mock.Mock
}

func (m *MockQueries) GetVolumeByVolumeID(ctx context.Context, params sqlc.GetVolumeByVolumeIDParams) (sqlc.Volumes, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return sqlc.Volumes{}, args.Error(1)
	}
	return args.Get(0).(sqlc.Volumes), args.Error(1)
}

func (m *MockQueries) CreateVolume(ctx context.Context, params sqlc.CreateVolumeParams) (sqlc.Volumes, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(sqlc.Volumes), args.Error(1)
}

func (m *MockQueries) UpdateVolume(ctx context.Context, params sqlc.UpdateVolumeParams) (sqlc.Volumes, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(sqlc.Volumes), args.Error(1)
}

func (m *MockQueries) ListActiveVolumes(ctx context.Context, orgID pgtype.Int8) ([]sqlc.Volumes, error) {
	args := m.Called(ctx, orgID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]sqlc.Volumes), args.Error(1)
}

func (m *MockQueries) SoftDeleteVolume(ctx context.Context, params sqlc.SoftDeleteVolumeParams) error {
	args := m.Called(ctx, params)
	return args.Error(0)
}

// Test helper to create a mock Docker volume
func createMockDockerVolume(id string, name string, driver string) models.Volume {
	return models.Volume{
		VolumeID:   id,
		Name:       name,
		Driver:     driver,
		Mountpoint: "/var/lib/docker/volumes/" + id,
		CreatedAt:  time.Now(),
		UsageData: &models.VolumeUsage{
			Size:     1024 * 1024 * 100, // 100MB
			RefCount: 1,
		},
	}
}

// Test helper to create a mock DB volume
func createMockDBVolume(id string, name string, isActive bool) sqlc.Volumes {
	return sqlc.Volumes{
		VolumeID:       id,
		DisplayName:    pgtype.Text{String: name, Valid: true},
		MountPoint:     "/var/lib/docker/volumes/" + id,
		IsActive:       isActive,
		ContainerCount: pgtype.Int4{Int32: 1, Valid: true},
		FilesystemType: pgtype.Text{String: "local", Valid: true},
		OrganizationID: pgtype.Int8{Int64: 1, Valid: true},
	}
}

func TestNewReconciliationService(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockStore := &MockStore{queries: new(MockQueries)}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	assert.NotNil(t, service)
	assert.Equal(t, config.Interval, service.config.Interval)
	assert.False(t, service.running)
}

func TestReconciliationService_Start_Disabled(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockStore := &MockStore{queries: new(MockQueries)}

	config := DefaultReconciliationConfig()
	config.Enabled = false

	service := NewReconciliationService(mockDocker, mockStore, config)

	err := service.Start(context.Background())
	assert.NoError(t, err)
	assert.False(t, service.IsRunning())
}

func TestReconciliationService_Start_AlreadyRunning(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockStore := &MockStore{queries: new(MockQueries)}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	// Set running flag
	service.running = true

	err := service.Start(context.Background())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already running")
}

func TestReconcileVolume_CreateNew(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockQueries := new(MockQueries)
	mockStore := &MockStore{queries: mockQueries}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	ctx := context.Background()
	dockerVolume := createMockDockerVolume("vol-123", "test-volume", "local")

	// Mock: Volume doesn't exist in DB
	mockQueries.On("GetVolumeByVolumeID", ctx, mock.AnythingOfType("sqlc.GetVolumeByVolumeIDParams")).
		Return(nil, assert.AnError)

	// Mock: GetVolumeContainers returns empty list
	mockDocker.On("GetVolumeContainers", ctx, "vol-123").
		Return([]models.VolumeContainer{}, nil)

	// Mock: CreateVolume succeeds
	mockQueries.On("CreateVolume", ctx, mock.AnythingOfType("sqlc.CreateVolumeParams")).
		Return(sqlc.Volumes{}, nil)

	created, updated, err := service.reconcileVolume(ctx, dockerVolume)

	assert.NoError(t, err)
	assert.True(t, created)
	assert.False(t, updated)

	mockQueries.AssertExpectations(t)
	mockDocker.AssertExpectations(t)
}

func TestReconcileVolume_UpdateExisting(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockQueries := new(MockQueries)
	mockStore := &MockStore{queries: mockQueries}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	ctx := context.Background()
	dockerVolume := createMockDockerVolume("vol-123", "test-volume", "local")

	existingVolume := createMockDBVolume("vol-123", "test-volume", true)
	existingVolume.ContainerCount = pgtype.Int4{Int32: 0, Valid: true} // Different from current

	// Mock: Volume exists in DB
	mockQueries.On("GetVolumeByVolumeID", ctx, mock.AnythingOfType("sqlc.GetVolumeByVolumeIDParams")).
		Return(existingVolume, nil)

	// Mock: GetVolumeContainers returns 1 container
	mockDocker.On("GetVolumeContainers", ctx, "vol-123").
		Return([]models.VolumeContainer{{Name: "test-container"}}, nil)

	// Mock: UpdateVolume succeeds
	mockQueries.On("UpdateVolume", ctx, mock.AnythingOfType("sqlc.UpdateVolumeParams")).
		Return(sqlc.Volumes{}, nil)

	created, updated, err := service.reconcileVolume(ctx, dockerVolume)

	assert.NoError(t, err)
	assert.False(t, created)
	assert.True(t, updated)

	mockQueries.AssertExpectations(t)
	mockDocker.AssertExpectations(t)
}

func TestReconcileVolume_NoUpdateNeeded(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockQueries := new(MockQueries)
	mockStore := &MockStore{queries: mockQueries}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	ctx := context.Background()
	dockerVolume := createMockDockerVolume("vol-123", "test-volume", "local")

	existingVolume := createMockDBVolume("vol-123", "test-volume", true)
	existingVolume.ContainerCount = pgtype.Int4{Int32: 1, Valid: true}

	// Mock: Volume exists in DB
	mockQueries.On("GetVolumeByVolumeID", ctx, mock.AnythingOfType("sqlc.GetVolumeByVolumeIDParams")).
		Return(existingVolume, nil)

	// Mock: GetVolumeContainers returns 1 container
	mockDocker.On("GetVolumeContainers", ctx, "vol-123").
		Return([]models.VolumeContainer{{Name: "test-container"}}, nil)

	// UpdateVolume should NOT be called

	created, updated, err := service.reconcileVolume(ctx, dockerVolume)

	assert.NoError(t, err)
	assert.False(t, created)
	assert.False(t, updated)

	mockQueries.AssertExpectations(t)
	mockDocker.AssertExpectations(t)
	mockQueries.AssertNotCalled(t, "UpdateVolume")
}

func TestMarkInactiveVolumes(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockQueries := new(MockQueries)
	mockStore := &MockStore{queries: mockQueries}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	ctx := context.Background()

	// Docker has only vol-1 and vol-2
	dockerVolumeMap := map[string]models.Volume{
		"vol-1": createMockDockerVolume("vol-1", "volume-1", "local"),
		"vol-2": createMockDockerVolume("vol-2", "volume-2", "local"),
	}

	// Database has vol-1, vol-2, and vol-3 (vol-3 should be marked inactive)
	dbVolumes := []sqlc.Volumes{
		createMockDBVolume("vol-1", "volume-1", true),
		createMockDBVolume("vol-2", "volume-2", true),
		createMockDBVolume("vol-3", "volume-3", true), // This one should be marked inactive
	}

	// Mock: ListActiveVolumes returns all DB volumes
	mockQueries.On("ListActiveVolumes", ctx, pgtype.Int8{Int64: 1, Valid: true}).
		Return(dbVolumes, nil)

	// Mock: SoftDeleteVolume should be called once for vol-3
	mockQueries.On("SoftDeleteVolume", ctx, sqlc.SoftDeleteVolumeParams{
		VolumeID:       "vol-3",
		OrganizationID: pgtype.Int8{Int64: 1, Valid: true},
	}).Return(nil)

	deleted, err := service.markInactiveVolumes(ctx, dockerVolumeMap)

	assert.NoError(t, err)
	assert.Equal(t, int64(1), deleted)

	mockQueries.AssertExpectations(t)
}

func TestRunReconciliation_Success(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockQueries := new(MockQueries)
	mockStore := &MockStore{queries: mockQueries}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	ctx := context.Background()

	dockerVolumes := []models.Volume{
		createMockDockerVolume("vol-1", "volume-1", "local"),
		createMockDockerVolume("vol-2", "volume-2", "local"),
	}

	// Mock: ListVolumes returns 2 volumes
	mockDocker.On("ListVolumes", ctx).Return(dockerVolumes, nil)

	// Mock: GetVolumeContainers for each volume
	mockDocker.On("GetVolumeContainers", ctx, "vol-1").
		Return([]models.VolumeContainer{}, nil)
	mockDocker.On("GetVolumeContainers", ctx, "vol-2").
		Return([]models.VolumeContainer{}, nil)

	// Mock: Both volumes don't exist (will be created)
	mockQueries.On("GetVolumeByVolumeID", ctx, mock.AnythingOfType("sqlc.GetVolumeByVolumeIDParams")).
		Return(nil, assert.AnError)

	// Mock: CreateVolume for both
	mockQueries.On("CreateVolume", ctx, mock.AnythingOfType("sqlc.CreateVolumeParams")).
		Return(sqlc.Volumes{}, nil)

	// Mock: ListActiveVolumes returns empty (no volumes to mark inactive)
	mockQueries.On("ListActiveVolumes", ctx, pgtype.Int8{Int64: 1, Valid: true}).
		Return([]sqlc.Volumes{}, nil)

	err := service.runReconciliation(ctx)

	assert.NoError(t, err)

	metrics := service.GetMetrics()
	assert.Equal(t, int64(1), metrics.TotalRuns)
	assert.Equal(t, int64(1), metrics.SuccessfulRuns)
	assert.Equal(t, int64(2), metrics.TotalVolumesProcessed)
	assert.Equal(t, int64(2), metrics.TotalVolumesCreated)

	mockDocker.AssertExpectations(t)
	mockQueries.AssertExpectations(t)
}

func TestRunReconciliation_DockerError(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockQueries := new(MockQueries)
	mockStore := &MockStore{queries: mockQueries}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	ctx := context.Background()

	// Mock: ListVolumes returns error
	mockDocker.On("ListVolumes", ctx).Return(nil, assert.AnError)

	err := service.runReconciliation(ctx)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to list Docker volumes")

	metrics := service.GetMetrics()
	assert.Equal(t, int64(1), metrics.TotalRuns)
	assert.Equal(t, int64(1), metrics.FailedRuns)
	assert.NotNil(t, metrics.LastError)

	mockDocker.AssertExpectations(t)
}

func TestGetMetrics(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockStore := &MockStore{queries: new(MockQueries)}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	// Manually set some metrics
	service.metrics.TotalRuns = 10
	service.metrics.SuccessfulRuns = 8
	service.metrics.FailedRuns = 2
	service.metrics.TotalVolumesProcessed = 50
	service.metrics.LastRunDuration = 5 * time.Second

	metrics := service.GetMetrics()

	assert.Equal(t, int64(10), metrics.TotalRuns)
	assert.Equal(t, int64(8), metrics.SuccessfulRuns)
	assert.Equal(t, int64(2), metrics.FailedRuns)
	assert.Equal(t, int64(50), metrics.TotalVolumesProcessed)
	assert.Equal(t, 5*time.Second, metrics.LastRunDuration)
}

func TestTriggerReconciliation_NotRunning(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockStore := &MockStore{queries: new(MockQueries)}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	err := service.TriggerReconciliation(context.Background())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not running")
}

func TestNeedsUpdate(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockStore := &MockStore{queries: new(MockQueries)}

	config := DefaultReconciliationConfig()
	service := NewReconciliationService(mockDocker, mockStore, config)

	tests := []struct {
		name           string
		dbVolume       sqlc.Volumes
		dockerVolume   models.Volume
		containerNames []string
		expected       bool
	}{
		{
			name:           "No changes needed",
			dbVolume:       createMockDBVolume("vol-1", "volume-1", true),
			dockerVolume:   createMockDockerVolume("vol-1", "volume-1", "local"),
			containerNames: []string{"container-1"},
			expected:       false,
		},
		{
			name: "Mount point changed",
			dbVolume: func() sqlc.Volumes {
				v := createMockDBVolume("vol-1", "volume-1", true)
				v.MountPoint = "/old/path"
				return v
			}(),
			dockerVolume:   createMockDockerVolume("vol-1", "volume-1", "local"),
			containerNames: []string{"container-1"},
			expected:       true,
		},
		{
			name: "Container count changed",
			dbVolume: func() sqlc.Volumes {
				v := createMockDBVolume("vol-1", "volume-1", true)
				v.ContainerCount = pgtype.Int4{Int32: 0, Valid: true}
				return v
			}(),
			dockerVolume:   createMockDockerVolume("vol-1", "volume-1", "local"),
			containerNames: []string{"container-1"},
			expected:       true,
		},
		{
			name: "Volume is inactive",
			dbVolume: func() sqlc.Volumes {
				v := createMockDBVolume("vol-1", "volume-1", false)
				return v
			}(),
			dockerVolume:   createMockDockerVolume("vol-1", "volume-1", "local"),
			containerNames: []string{"container-1"},
			expected:       true,
		},
		{
			name: "Filesystem type changed",
			dbVolume: func() sqlc.Volumes {
				v := createMockDBVolume("vol-1", "volume-1", true)
				v.FilesystemType = pgtype.Text{String: "nfs", Valid: true}
				return v
			}(),
			dockerVolume:   createMockDockerVolume("vol-1", "volume-1", "local"),
			containerNames: []string{"container-1"},
			expected:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.needsUpdate(tt.dbVolume, tt.dockerVolume, tt.containerNames)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestReconciliationService_StartStop(t *testing.T) {
	mockDocker := new(MockDockerService)
	mockQueries := new(MockQueries)
	mockStore := &MockStore{queries: mockQueries}

	config := DefaultReconciliationConfig()
	config.Interval = 100 * time.Millisecond // Short interval for testing

	service := NewReconciliationService(mockDocker, mockStore, config)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Mock the initial reconciliation and periodic calls
	mockDocker.On("ListVolumes", mock.Anything).Return([]models.Volume{}, nil).Maybe()
	mockQueries.On("ListActiveVolumes", mock.Anything, mock.Anything).Return([]sqlc.Volumes{}, nil).Maybe()

	err := service.Start(ctx)
	require.NoError(t, err)
	assert.True(t, service.IsRunning())

	// Wait a bit to ensure the service is running
	time.Sleep(50 * time.Millisecond)

	err = service.Stop()
	assert.NoError(t, err)
	assert.False(t, service.IsRunning())
}
