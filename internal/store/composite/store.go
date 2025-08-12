package composite

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/store/interfaces"
)

// CompositeStore combines all store interfaces into a single implementation
// This maintains backward compatibility with the original monolithic Store interface
type CompositeStore struct {
	fileStore    interfaces.FileStore
	dirStore     interfaces.DirectoryStore
	rollupStore  interfaces.RollupStore  
	dockerStore  interfaces.DockerStore
	analyticsStore interfaces.AnalyticsStore
	infraStore   interfaces.InfrastructureStore
	facade       interface{} // Legacy facade for compatibility
}

// NewCompositeStore creates a new composite store from individual store components
func NewCompositeStore(
	fileStore interfaces.FileStore,
	dirStore interfaces.DirectoryStore,
	rollupStore interfaces.RollupStore,
	dockerStore interfaces.DockerStore,
	analyticsStore interfaces.AnalyticsStore,
	infraStore interfaces.InfrastructureStore,
	facade interface{}, // Legacy facade
) interfaces.Store {
	return &CompositeStore{
		fileStore:      fileStore,
		dirStore:       dirStore,
		rollupStore:    rollupStore,
		dockerStore:    dockerStore,
		analyticsStore: analyticsStore,
		infraStore:     infraStore,
		facade:         facade,
	}
}

// FileStore methods
func (c *CompositeStore) CreateFileEntry(ctx context.Context, entry *interfaces.FileEntry) (*interfaces.FileEntry, error) {
	return c.fileStore.CreateFileEntry(ctx, entry)
}

func (c *CompositeStore) GetFileEntry(ctx context.Context, id int64, volumeID string) (*interfaces.FileEntry, error) {
	return c.fileStore.GetFileEntry(ctx, id, volumeID)
}

func (c *CompositeStore) UpsertFileEntry(ctx context.Context, entry *interfaces.FileEntry) (*interfaces.FileEntry, error) {
	return c.fileStore.UpsertFileEntry(ctx, entry)
}

func (c *CompositeStore) GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*interfaces.FileEntry, error) {
	return c.fileStore.GetFileEntriesByVolumeAndParent(ctx, volumeID, parentDirID)
}

func (c *CompositeStore) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*interfaces.FileEntry, error) {
	return c.fileStore.GetLargestFiles(ctx, volumeID, limit)
}

func (c *CompositeStore) FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*interfaces.FileEntry, error) {
	return c.fileStore.FindFilesByPathHash(ctx, volumeID, pathHash)
}

func (c *CompositeStore) BulkInsertFileEntries(ctx context.Context, entries []*interfaces.FileEntry, params interfaces.BulkInsertParams) error {
	return c.fileStore.BulkInsertFileEntries(ctx, entries, params)
}

func (c *CompositeStore) DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error {
	return c.fileStore.DeleteFileEntriesByVolume(ctx, volumeID)
}

func (c *CompositeStore) CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return c.fileStore.CountFileEntriesByVolume(ctx, volumeID)
}

func (c *CompositeStore) GetVolumeFileStats(ctx context.Context, volumeID string) (*interfaces.VolumeFileStats, error) {
	return c.fileStore.GetVolumeFileStats(ctx, volumeID)
}

// DirectoryStore methods
func (c *CompositeStore) CreateDirNode(ctx context.Context, node *interfaces.DirNode) (*interfaces.DirNode, error) {
	return c.dirStore.CreateDirNode(ctx, node)
}

func (c *CompositeStore) GetDirNode(ctx context.Context, id int64, volumeID string) (*interfaces.DirNode, error) {
	return c.dirStore.GetDirNode(ctx, id, volumeID)
}

func (c *CompositeStore) UpsertDirNode(ctx context.Context, node *interfaces.DirNode) (*interfaces.DirNode, error) {
	return c.dirStore.UpsertDirNode(ctx, node)
}

func (c *CompositeStore) UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error {
	return c.dirStore.UpdateDirNodeStats(ctx, id, volumeID, sizeBytes, fileCount)
}

func (c *CompositeStore) GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*interfaces.DirNode, error) {
	return c.dirStore.GetDirNodeByPath(ctx, volumeID, fullPath)
}

func (c *CompositeStore) GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*interfaces.DirNode, error) {
	return c.dirStore.GetChildDirNodes(ctx, volumeID, parentDirID)
}

func (c *CompositeStore) GetRootDirNodes(ctx context.Context, volumeID string) ([]*interfaces.DirNode, error) {
	return c.dirStore.GetRootDirNodes(ctx, volumeID)
}

func (c *CompositeStore) GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*interfaces.DirNode, error) {
	return c.dirStore.GetLargestDirectories(ctx, volumeID, limit)
}

func (c *CompositeStore) GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*interfaces.DirNode, error) {
	return c.dirStore.GetDirectoryTree(ctx, volumeID, maxDepth)
}

func (c *CompositeStore) BulkInsertDirNodes(ctx context.Context, nodes []*interfaces.DirNode, params interfaces.BulkInsertParams) error {
	return c.dirStore.BulkInsertDirNodes(ctx, nodes, params)
}

func (c *CompositeStore) DeleteDirNodesByVolume(ctx context.Context, volumeID string) error {
	return c.dirStore.DeleteDirNodesByVolume(ctx, volumeID)
}

func (c *CompositeStore) CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return c.dirStore.CountDirNodesByVolume(ctx, volumeID)
}

// RollupStore methods
func (c *CompositeStore) CreateDirRollup(ctx context.Context, rollup *interfaces.DirRollup) (*interfaces.DirRollup, error) {
	return c.rollupStore.CreateDirRollup(ctx, rollup)
}

func (c *CompositeStore) GetDirRollup(ctx context.Context, id int64) (*interfaces.DirRollup, error) {
	return c.rollupStore.GetDirRollup(ctx, id)
}

func (c *CompositeStore) GetLatestDirRollup(ctx context.Context, dirID int64) (*interfaces.DirRollup, error) {
	return c.rollupStore.GetLatestDirRollup(ctx, dirID)
}

func (c *CompositeStore) GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*interfaces.DirRollup, error) {
	return c.rollupStore.GetDirRollupHistory(ctx, dirID, limit)
}

func (c *CompositeStore) GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*interfaces.DirRollup, error) {
	return c.rollupStore.GetDirRollupsInTimeRange(ctx, dirID, startTime, endTime)
}

func (c *CompositeStore) BulkInsertDirRollups(ctx context.Context, rollups []*interfaces.DirRollup, params interfaces.BulkInsertParams) error {
	return c.rollupStore.BulkInsertDirRollups(ctx, rollups, params)
}

func (c *CompositeStore) DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error {
	return c.rollupStore.DeleteOldRollups(ctx, cutoffTime)
}

func (c *CompositeStore) DeleteRollupsByDirID(ctx context.Context, dirID int64) error {
	return c.rollupStore.DeleteRollupsByDirID(ctx, dirID)
}

func (c *CompositeStore) CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error) {
	return c.rollupStore.CountRollupsByDirID(ctx, dirID)
}

func (c *CompositeStore) GetRollupStats(ctx context.Context) (*interfaces.RollupStats, error) {
	return c.rollupStore.GetRollupStats(ctx)
}

// DockerStore methods
func (c *CompositeStore) UpsertVolume(ctx context.Context, volume *interfaces.Volume) error {
	return c.dockerStore.UpsertVolume(ctx, volume)
}

func (c *CompositeStore) DeleteVolume(ctx context.Context, volumeID string) error {
	return c.dockerStore.DeleteVolume(ctx, volumeID)
}

func (c *CompositeStore) GetVolumeByName(ctx context.Context, name string) (*interfaces.Volume, error) {
	return c.dockerStore.GetVolumeByName(ctx, name)
}

func (c *CompositeStore) ListAllVolumes(ctx context.Context) ([]*interfaces.Volume, error) {
	return c.dockerStore.ListAllVolumes(ctx)
}

func (c *CompositeStore) UpsertContainer(ctx context.Context, container *interfaces.Container) error {
	return c.dockerStore.UpsertContainer(ctx, container)
}

func (c *CompositeStore) DeleteContainer(ctx context.Context, containerID string) error {
	return c.dockerStore.DeleteContainer(ctx, containerID)
}

func (c *CompositeStore) GetContainerByID(ctx context.Context, containerID string) (*interfaces.Container, error) {
	return c.dockerStore.GetContainerByID(ctx, containerID)
}

func (c *CompositeStore) ListAllContainers(ctx context.Context) ([]*interfaces.Container, error) {
	return c.dockerStore.ListAllContainers(ctx)
}

func (c *CompositeStore) UpsertVolumeMount(ctx context.Context, mount *interfaces.VolumeMount) error {
	return c.dockerStore.UpsertVolumeMount(ctx, mount)
}

func (c *CompositeStore) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	return c.dockerStore.DeleteVolumeMount(ctx, volumeID, containerID)
}

func (c *CompositeStore) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*interfaces.VolumeMount, error) {
	return c.dockerStore.GetVolumeMountsByContainer(ctx, containerID)
}

func (c *CompositeStore) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*interfaces.VolumeMount, error) {
	return c.dockerStore.GetVolumeMountsByVolume(ctx, volumeID)
}

func (c *CompositeStore) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	return c.dockerStore.DeactivateVolumeMounts(ctx, containerID)
}

func (c *CompositeStore) ListAllVolumeMounts(ctx context.Context) ([]*interfaces.VolumeMount, error) {
	return c.dockerStore.ListAllVolumeMounts(ctx)
}

// AnalyticsStore methods
func (c *CompositeStore) Rollup(ctx context.Context, volumeID string, opts *interfaces.RollupOptions) (*interfaces.RollupResult, error) {
	return c.analyticsStore.Rollup(ctx, volumeID, opts)
}

func (c *CompositeStore) CreateUsageSnapshot(ctx context.Context, params interfaces.CreateUsageSnapshotParams) (*interfaces.UsageSnapshot, error) {
	return c.analyticsStore.CreateUsageSnapshot(ctx, params)
}

func (c *CompositeStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*interfaces.UsageSnapshot, error) {
	return c.analyticsStore.GetLatestSnapshot(ctx, volumeID, snapshotType)
}

func (c *CompositeStore) Get7DayTrend(ctx context.Context, volumeID string) (*interfaces.TrendData, error) {
	return c.analyticsStore.Get7DayTrend(ctx, volumeID)
}

func (c *CompositeStore) Get30DayTrend(ctx context.Context, volumeID string) (*interfaces.TrendData, error) {
	return c.analyticsStore.Get30DayTrend(ctx, volumeID)
}

func (c *CompositeStore) GetGrowthDeltas(ctx context.Context, params interfaces.GetGrowthDeltasParams) (*interfaces.GrowthDeltasResult, error) {
	return c.analyticsStore.GetGrowthDeltas(ctx, params)
}

func (c *CompositeStore) GetVolumeStepSeries(ctx context.Context, params interfaces.GetVolumeStepSeriesParams) ([]*interfaces.StepSeriesPoint, error) {
	return c.analyticsStore.GetVolumeStepSeries(ctx, params)
}

func (c *CompositeStore) GetTrendSlope(ctx context.Context, params interfaces.GetTrendSlopeParams) (*interfaces.TrendSlopeResult, error) {
	return c.analyticsStore.GetTrendSlope(ctx, params)
}

// InfrastructureStore methods
func (c *CompositeStore) Tx(ctx context.Context, fn interfaces.TxFunc) error {
	return c.infraStore.Tx(ctx, fn)
}

func (c *CompositeStore) TxWithTimeout(ctx context.Context, timeout time.Duration, fn interfaces.TxFunc) error {
	return c.infraStore.TxWithTimeout(ctx, timeout, fn)
}

func (c *CompositeStore) ReadOnlyTx(ctx context.Context, fn interfaces.TxFunc) error {
	return c.infraStore.ReadOnlyTx(ctx, fn)
}

func (c *CompositeStore) FastTx(ctx context.Context, fn interfaces.TxFunc) error {
	return c.infraStore.FastTx(ctx, fn)
}

func (c *CompositeStore) BulkTx(ctx context.Context, fn interfaces.TxFunc) error {
	return c.infraStore.BulkTx(ctx, fn)
}

func (c *CompositeStore) Close() error {
	return c.infraStore.Close()
}

func (c *CompositeStore) Health(ctx context.Context) error {
	return c.infraStore.Health(ctx)
}

// Legacy method for facade compatibility
func (c *CompositeStore) GetFacade() interface{} {
	return c.facade
}