package events

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// EventsIntegrationTestSuite tests Docker events integration with actual Docker daemon
type EventsIntegrationTestSuite struct {
	suite.Suite
	dockerClient *client.Client
	db           *database.DB
	eventsClient *EventsClient
	repo         *TestRepository
	ctx          context.Context
	cancel       context.CancelFunc
}

// SetupSuite initializes the test suite
func (suite *EventsIntegrationTestSuite) SetupSuite() {
	// Skip integration tests if running in short mode
	if testing.Short() {
		suite.T().Skip("Skipping integration tests in short mode")
	}

	var err error
	suite.dockerClient, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	require.NoError(suite.T(), err)

	// Test Docker connection
	ctx := context.Background()
	_, err = suite.dockerClient.Ping(ctx)
	if err != nil {
		suite.T().Skip("Docker daemon not available, skipping integration tests")
	}

	// Initialize test repository
	suite.repo = NewTestRepository()

	// Create events configuration
	cfg := &config.EventsConfig{
		Enabled:            true,
		QueueSize:          100,
		BackoffMinDuration: time.Second,
		BackoffMaxDuration: time.Minute,
		ReconcileInterval:  5 * time.Minute,
	}

	// Create mock Docker client wrapper
	dockerWrapper := &TestDockerClientWrapper{client: suite.dockerClient}

	// Create event handler
	handler := NewEventHandlerService(dockerWrapper, suite.repo, nil)

	// Create reconciler
	reconciler := NewReconcilerService(dockerWrapper, suite.repo, cfg, &EventMetrics{
		ProcessedTotal: make(map[EventType]int64),
		ErrorsTotal:    make(map[string]int64),
		ReconcileRuns:  make(map[string]int64),
	}, nil)

	// Create events client
	suite.eventsClient = NewEventsClient(dockerWrapper, cfg, handler, reconciler, nil)

	suite.ctx, suite.cancel = context.WithCancel(context.Background())
}

// TearDownSuite cleans up after tests
func (suite *EventsIntegrationTestSuite) TearDownSuite() {
	if suite.cancel != nil {
		suite.cancel()
	}

	if suite.eventsClient != nil {
		_ = suite.eventsClient.Stop(context.Background())
	}

	if suite.dockerClient != nil {
		_ = suite.dockerClient.Close()
	}
}

// TestVolumeLifecycle tests volume creation and deletion events
func (suite *EventsIntegrationTestSuite) TestVolumeLifecycle() {
	// Start events client
	err := suite.eventsClient.Start(suite.ctx)
	require.NoError(suite.T(), err)

	// Give events client time to connect
	time.Sleep(2 * time.Second)

	volumeName := fmt.Sprintf("test-events-volume-%d", time.Now().Unix())

	// Create volume
	vol, err := suite.dockerClient.VolumeCreate(suite.ctx, volume.CreateOptions{
		Name:   volumeName,
		Driver: "local",
		Labels: map[string]string{
			"test": "integration",
		},
	})
	require.NoError(suite.T(), err)

	// Wait for event processing
	suite.waitForVolumeInRepo(volumeName, 10*time.Second)

	// Verify volume was added to repository
	dbVolume := suite.repo.GetVolume(volumeName)
	assert.NotNil(suite.T(), dbVolume)
	assert.Equal(suite.T(), volumeName, dbVolume.Name)
	assert.Equal(suite.T(), "local", dbVolume.Driver)
	assert.True(suite.T(), dbVolume.IsActive)
	assert.Equal(suite.T(), "integration", dbVolume.Labels["test"])

	// Remove volume
	err = suite.dockerClient.VolumeRemove(suite.ctx, vol.Name, false)
	require.NoError(suite.T(), err)

	// Wait for removal event processing
	suite.waitForVolumeRemovalFromRepo(volumeName, 10*time.Second)

	// Verify volume was removed from repository
	dbVolume = suite.repo.GetVolume(volumeName)
	assert.Nil(suite.T(), dbVolume)
}

// TestContainerLifecycle tests container start/stop events with volume mounts
func (suite *EventsIntegrationTestSuite) TestContainerLifecycle() {
	// Start events client
	err := suite.eventsClient.Start(suite.ctx)
	require.NoError(suite.T(), err)

	// Give events client time to connect
	time.Sleep(2 * time.Second)

	volumeName := fmt.Sprintf("test-container-volume-%d", time.Now().Unix())
	containerName := fmt.Sprintf("test-events-container-%d", time.Now().Unix())

	// Create volume first
	vol, err := suite.dockerClient.VolumeCreate(suite.ctx, volume.CreateOptions{
		Name:   volumeName,
		Driver: "local",
	})
	require.NoError(suite.T(), err)

	// Wait for volume to be processed
	suite.waitForVolumeInRepo(volumeName, 10*time.Second)

	// Create container with volume mount
	resp, err := suite.dockerClient.ContainerCreate(suite.ctx,
		&containertypes.Config{
			Image: "alpine:latest",
			Cmd:   []string{"sleep", "3600"},
		},
		&containertypes.HostConfig{
			Binds: []string{fmt.Sprintf("%s:/data", volumeName)},
		},
		nil, nil, containerName)
	require.NoError(suite.T(), err)

	// Start container
	err = suite.dockerClient.ContainerStart(suite.ctx, resp.ID, containertypes.StartOptions{})
	require.NoError(suite.T(), err)

	// Wait for container start event processing
	suite.waitForContainerInRepo(resp.ID, 10*time.Second)

	// Verify container was added to repository
	dbContainer := suite.repo.GetContainer(resp.ID)
	assert.NotNil(suite.T(), dbContainer)
	assert.Equal(suite.T(), resp.ID, dbContainer.ContainerID)
	assert.Contains(suite.T(), dbContainer.Name, containerName)
	assert.Equal(suite.T(), "alpine:latest", dbContainer.Image)
	assert.Equal(suite.T(), "running", dbContainer.State)
	assert.True(suite.T(), dbContainer.IsActive)

	// Verify volume mount was created
	mounts, _ := suite.repo.GetVolumeMountsByContainer(context.Background(), resp.ID)
	assert.Len(suite.T(), mounts, 1)
	assert.Equal(suite.T(), volumeName, mounts[0].VolumeID)
	assert.Equal(suite.T(), resp.ID, mounts[0].ContainerID)
	assert.Equal(suite.T(), "/data", mounts[0].MountPath)
	assert.True(suite.T(), mounts[0].IsActive)

	// Stop container
	timeout := 10
	err = suite.dockerClient.ContainerStop(suite.ctx, resp.ID, containertypes.StopOptions{
		Timeout: &timeout,
	})
	require.NoError(suite.T(), err)

	// Wait for stop event processing
	time.Sleep(3 * time.Second)

	// Verify container state was updated
	dbContainer = suite.repo.GetContainer(resp.ID)
	assert.NotNil(suite.T(), dbContainer)
	assert.False(suite.T(), dbContainer.IsActive)

	// Remove container
	err = suite.dockerClient.ContainerRemove(suite.ctx, resp.ID, containertypes.RemoveOptions{
		Force: true,
	})
	require.NoError(suite.T(), err)

	// Wait for removal event processing
	suite.waitForContainerRemovalFromRepo(resp.ID, 10*time.Second)

	// Verify container was removed from repository
	dbContainer = suite.repo.GetContainer(resp.ID)
	assert.Nil(suite.T(), dbContainer)

	// Verify volume mounts were deactivated
	mounts, _ = suite.repo.GetVolumeMountsByContainer(context.Background(), resp.ID)
	assert.Empty(suite.T(), mounts)

	// Cleanup volume
	_ = suite.dockerClient.VolumeRemove(suite.ctx, vol.Name, false)
}

// TestReconciliation tests that reconciliation catches missed events
func (suite *EventsIntegrationTestSuite) TestReconciliation() {
	// Create volume without events client running
	volumeName := fmt.Sprintf("test-reconcile-volume-%d", time.Now().Unix())
	vol, err := suite.dockerClient.VolumeCreate(suite.ctx, volume.CreateOptions{
		Name:   volumeName,
		Driver: "local",
	})
	require.NoError(suite.T(), err)

	// Verify volume is not in repository yet
	dbVolume := suite.repo.GetVolume(volumeName)
	assert.Nil(suite.T(), dbVolume)

	// Start events client (this should trigger reconciliation)
	err = suite.eventsClient.Start(suite.ctx)
	require.NoError(suite.T(), err)

	// Wait for initial reconciliation
	time.Sleep(5 * time.Second)

	// Verify volume was picked up by reconciliation
	dbVolume = suite.repo.GetVolume(volumeName)
	assert.NotNil(suite.T(), dbVolume)
	assert.Equal(suite.T(), volumeName, dbVolume.Name)
	assert.True(suite.T(), dbVolume.IsActive)

	// Cleanup
	_ = suite.dockerClient.VolumeRemove(suite.ctx, vol.Name, false)
}

// TestEventProcessingMetrics verifies that events are properly counted
func (suite *EventsIntegrationTestSuite) TestEventProcessingMetrics() {
	// Start events client
	err := suite.eventsClient.Start(suite.ctx)
	require.NoError(suite.T(), err)

	// Give events client time to connect
	time.Sleep(2 * time.Second)

	// Get initial metrics
	initialMetrics := suite.eventsClient.GetMetrics()

	volumeName := fmt.Sprintf("test-metrics-volume-%d", time.Now().Unix())

	// Create and remove volume
	vol, err := suite.dockerClient.VolumeCreate(suite.ctx, volume.CreateOptions{
		Name: volumeName,
	})
	require.NoError(suite.T(), err)

	time.Sleep(2 * time.Second)

	err = suite.dockerClient.VolumeRemove(suite.ctx, vol.Name, false)
	require.NoError(suite.T(), err)

	time.Sleep(2 * time.Second)

	// Get final metrics
	finalMetrics := suite.eventsClient.GetMetrics()

	// Verify metrics increased
	assert.Greater(suite.T(), len(finalMetrics.ProcessedTotal), len(initialMetrics.ProcessedTotal))
	assert.True(suite.T(), finalMetrics.ProcessedTotal[VolumeCreated] >= initialMetrics.ProcessedTotal[VolumeCreated])
	assert.True(suite.T(), finalMetrics.ProcessedTotal[VolumeRemoved] >= initialMetrics.ProcessedTotal[VolumeRemoved])
}

// Helper methods

func (suite *EventsIntegrationTestSuite) waitForVolumeInRepo(volumeName string, timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if vol := suite.repo.GetVolume(volumeName); vol != nil {
			return
		}
		time.Sleep(500 * time.Millisecond)
	}
	suite.T().Fatalf("Volume %s not found in repository within timeout", volumeName)
}

func (suite *EventsIntegrationTestSuite) waitForVolumeRemovalFromRepo(volumeName string, timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if vol := suite.repo.GetVolume(volumeName); vol == nil {
			return
		}
		time.Sleep(500 * time.Millisecond)
	}
	suite.T().Fatalf("Volume %s still exists in repository after timeout", volumeName)
}

func (suite *EventsIntegrationTestSuite) waitForContainerInRepo(containerID string, timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if container := suite.repo.GetContainer(containerID); container != nil {
			return
		}
		time.Sleep(500 * time.Millisecond)
	}
	suite.T().Fatalf("Container %s not found in repository within timeout", containerID)
}

func (suite *EventsIntegrationTestSuite) waitForContainerRemovalFromRepo(containerID string, timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if container := suite.repo.GetContainer(containerID); container == nil {
			return
		}
		time.Sleep(500 * time.Millisecond)
	}
	suite.T().Fatalf("Container %s still exists in repository after timeout", containerID)
}

// TestEventsIntegration runs the integration test suite
func TestEventsIntegration(t *testing.T) {
	suite.Run(t, new(EventsIntegrationTestSuite))
}

// Test implementations for integration testing

// TestRepository is an in-memory repository for testing
type TestRepository struct {
	volumes      map[string]*database.Volume
	containers   map[string]*database.Container
	volumeMounts map[string][]*database.VolumeMount // keyed by containerID
}

// NewTestRepository creates a new test repository
func NewTestRepository() *TestRepository {
	return &TestRepository{
		volumes:      make(map[string]*database.Volume),
		containers:   make(map[string]*database.Container),
		volumeMounts: make(map[string][]*database.VolumeMount),
	}
}

func (r *TestRepository) UpsertVolume(ctx context.Context, volume *database.Volume) error {
	r.volumes[volume.VolumeID] = volume
	return nil
}

func (r *TestRepository) DeleteVolume(ctx context.Context, volumeID string) error {
	delete(r.volumes, volumeID)
	return nil
}

func (r *TestRepository) GetVolumeByName(ctx context.Context, name string) (*database.Volume, error) {
	vol := r.volumes[name]
	return vol, nil
}

func (r *TestRepository) UpsertContainer(ctx context.Context, container *database.Container) error {
	r.containers[container.ContainerID] = container
	return nil
}

func (r *TestRepository) DeleteContainer(ctx context.Context, containerID string) error {
	delete(r.containers, containerID)
	delete(r.volumeMounts, containerID)
	return nil
}

func (r *TestRepository) GetContainerByID(ctx context.Context, containerID string) (*database.Container, error) {
	container := r.containers[containerID]
	return container, nil
}

func (r *TestRepository) UpsertVolumeMount(ctx context.Context, mount *database.VolumeMount) error {
	if r.volumeMounts[mount.ContainerID] == nil {
		r.volumeMounts[mount.ContainerID] = make([]*database.VolumeMount, 0)
	}
	r.volumeMounts[mount.ContainerID] = append(r.volumeMounts[mount.ContainerID], mount)
	return nil
}

func (r *TestRepository) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	mounts := r.volumeMounts[containerID]
	filtered := make([]*database.VolumeMount, 0, len(mounts))
	for _, mount := range mounts {
		if mount.VolumeID != volumeID {
			filtered = append(filtered, mount)
		}
	}
	r.volumeMounts[containerID] = filtered
	return nil
}

func (r *TestRepository) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*database.VolumeMount, error) {
	return r.volumeMounts[containerID], nil
}

func (r *TestRepository) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*database.VolumeMount, error) {
	var result []*database.VolumeMount
	for _, mounts := range r.volumeMounts {
		for _, mount := range mounts {
			if mount.VolumeID == volumeID {
				result = append(result, mount)
			}
		}
	}
	return result, nil
}

func (r *TestRepository) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	delete(r.volumeMounts, containerID)
	return nil
}

func (r *TestRepository) ListAllVolumes(ctx context.Context) ([]*database.Volume, error) {
	var result []*database.Volume
	for _, vol := range r.volumes {
		result = append(result, vol)
	}
	return result, nil
}

func (r *TestRepository) ListAllContainers(ctx context.Context) ([]*database.Container, error) {
	var result []*database.Container
	for _, container := range r.containers {
		result = append(result, container)
	}
	return result, nil
}

func (r *TestRepository) ListAllVolumeMounts(ctx context.Context) ([]*database.VolumeMount, error) {
	var result []*database.VolumeMount
	for _, mounts := range r.volumeMounts {
		result = append(result, mounts...)
	}
	return result, nil
}

// Helper methods for testing
func (r *TestRepository) GetVolume(volumeID string) *database.Volume {
	return r.volumes[volumeID]
}

func (r *TestRepository) GetContainer(containerID string) *database.Container {
	return r.containers[containerID]
}

func (r *TestRepository) GetVolumeMountsForContainer(containerID string) []*database.VolumeMount {
	return r.volumeMounts[containerID]
}

// TestDockerClientWrapper wraps the real Docker client to implement our interface
type TestDockerClientWrapper struct {
	client *client.Client
}

func (w *TestDockerClientWrapper) Ping(ctx context.Context) error {
	_, err := w.client.Ping(ctx)
	return err
}

func (w *TestDockerClientWrapper) Close() error {
	return w.client.Close()
}

func (w *TestDockerClientWrapper) IsConnected(ctx context.Context) bool {
	return w.Ping(ctx) == nil
}

func (w *TestDockerClientWrapper) Version(ctx context.Context) (types.Version, error) {
	return w.client.ServerVersion(ctx)
}

func (w *TestDockerClientWrapper) ListVolumes(ctx context.Context, filterMap map[string][]string) (volume.ListResponse, error) {
	return w.client.VolumeList(ctx, volume.ListOptions{})
}

func (w *TestDockerClientWrapper) InspectVolume(ctx context.Context, volumeID string) (volume.Volume, error) {
	return w.client.VolumeInspect(ctx, volumeID)
}

func (w *TestDockerClientWrapper) ListContainers(ctx context.Context, filterMap map[string][]string) ([]containertypes.Summary, error) {
	return w.client.ContainerList(ctx, containertypes.ListOptions{All: true})
}

func (w *TestDockerClientWrapper) InspectContainer(ctx context.Context, containerID string) (containertypes.InspectResponse, error) {
	return w.client.ContainerInspect(ctx, containerID)
}

func (w *TestDockerClientWrapper) ContainerInspect(ctx context.Context, containerID string) (types.ContainerJSON, error) {
	return w.client.ContainerInspect(ctx, containerID)
}

func (w *TestDockerClientWrapper) Events(ctx context.Context, options events.ListOptions) (<-chan events.Message, <-chan error) {
	return w.client.Events(ctx, options)
}