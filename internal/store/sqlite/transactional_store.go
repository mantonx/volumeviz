package sqlite

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/store/interfaces"
)

// SQLiteTransactionalStore combines all domain stores to implement TransactionalStore interface
// This allows domain stores to participate in transactions
type SQLiteTransactionalStore struct {
	fileStore      interfaces.FileStore
	directoryStore interfaces.DirectoryStore
	rollupStore    interfaces.RollupStore
	dockerStore    interfaces.DockerStore
	analyticsStore interfaces.AnalyticsStore
}

// NewSQLiteTransactionalStore creates a new transactional store from individual domain stores
func NewSQLiteTransactionalStore(
	fileStore interfaces.FileStore,
	directoryStore interfaces.DirectoryStore,
	rollupStore interfaces.RollupStore,
	dockerStore interfaces.DockerStore,
	analyticsStore interfaces.AnalyticsStore,
) interfaces.TransactionalStore {
	return &SQLiteTransactionalStore{
		fileStore:      fileStore,
		directoryStore: directoryStore,
		rollupStore:    rollupStore,
		dockerStore:    dockerStore,
		analyticsStore: analyticsStore,
	}
}

// Implement all interfaces by delegating to domain stores

// FileStore methods
func (s *SQLiteTransactionalStore) CreateFileEntry(ctx context.Context, entry *interfaces.FileEntry) (*interfaces.FileEntry, error) {
	return s.fileStore.CreateFileEntry(ctx, entry)
}

func (s *SQLiteTransactionalStore) GetFileEntry(ctx context.Context, id int64, volumeID string) (*interfaces.FileEntry, error) {
	return s.fileStore.GetFileEntry(ctx, id, volumeID)
}

func (s *SQLiteTransactionalStore) UpsertFileEntry(ctx context.Context, entry *interfaces.FileEntry) (*interfaces.FileEntry, error) {
	return s.fileStore.UpsertFileEntry(ctx, entry)
}

func (s *SQLiteTransactionalStore) GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*interfaces.FileEntry, error) {
	return s.fileStore.GetFileEntriesByVolumeAndParent(ctx, volumeID, parentDirID)
}

func (s *SQLiteTransactionalStore) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*interfaces.FileEntry, error) {
	return s.fileStore.GetLargestFiles(ctx, volumeID, limit)
}

func (s *SQLiteTransactionalStore) FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*interfaces.FileEntry, error) {
	return s.fileStore.FindFilesByPathHash(ctx, volumeID, pathHash)
}

func (s *SQLiteTransactionalStore) BulkInsertFileEntries(ctx context.Context, entries []*interfaces.FileEntry, params interfaces.BulkInsertParams) error {
	return s.fileStore.BulkInsertFileEntries(ctx, entries, params)
}

func (s *SQLiteTransactionalStore) DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error {
	return s.fileStore.DeleteFileEntriesByVolume(ctx, volumeID)
}

func (s *SQLiteTransactionalStore) CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return s.fileStore.CountFileEntriesByVolume(ctx, volumeID)
}

func (s *SQLiteTransactionalStore) GetVolumeFileStats(ctx context.Context, volumeID string) (*interfaces.VolumeFileStats, error) {
	return s.fileStore.GetVolumeFileStats(ctx, volumeID)
}

// DirectoryStore methods
func (s *SQLiteTransactionalStore) CreateDirNode(ctx context.Context, node *interfaces.DirNode) (*interfaces.DirNode, error) {
	return s.directoryStore.CreateDirNode(ctx, node)
}

func (s *SQLiteTransactionalStore) GetDirNode(ctx context.Context, id int64, volumeID string) (*interfaces.DirNode, error) {
	return s.directoryStore.GetDirNode(ctx, id, volumeID)
}

func (s *SQLiteTransactionalStore) UpsertDirNode(ctx context.Context, node *interfaces.DirNode) (*interfaces.DirNode, error) {
	return s.directoryStore.UpsertDirNode(ctx, node)
}

func (s *SQLiteTransactionalStore) UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error {
	return s.directoryStore.UpdateDirNodeStats(ctx, id, volumeID, sizeBytes, fileCount)
}

func (s *SQLiteTransactionalStore) GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*interfaces.DirNode, error) {
	return s.directoryStore.GetDirNodeByPath(ctx, volumeID, fullPath)
}

func (s *SQLiteTransactionalStore) GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*interfaces.DirNode, error) {
	return s.directoryStore.GetChildDirNodes(ctx, volumeID, parentDirID)
}

func (s *SQLiteTransactionalStore) GetRootDirNodes(ctx context.Context, volumeID string) ([]*interfaces.DirNode, error) {
	return s.directoryStore.GetRootDirNodes(ctx, volumeID)
}

func (s *SQLiteTransactionalStore) GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*interfaces.DirNode, error) {
	return s.directoryStore.GetLargestDirectories(ctx, volumeID, limit)
}

func (s *SQLiteTransactionalStore) GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*interfaces.DirNode, error) {
	return s.directoryStore.GetDirectoryTree(ctx, volumeID, maxDepth)
}

func (s *SQLiteTransactionalStore) BulkInsertDirNodes(ctx context.Context, nodes []*interfaces.DirNode, params interfaces.BulkInsertParams) error {
	return s.directoryStore.BulkInsertDirNodes(ctx, nodes, params)
}

func (s *SQLiteTransactionalStore) DeleteDirNodesByVolume(ctx context.Context, volumeID string) error {
	return s.directoryStore.DeleteDirNodesByVolume(ctx, volumeID)
}

func (s *SQLiteTransactionalStore) CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return s.directoryStore.CountDirNodesByVolume(ctx, volumeID)
}

// RollupStore methods
func (s *SQLiteTransactionalStore) CreateDirRollup(ctx context.Context, rollup *interfaces.DirRollup) (*interfaces.DirRollup, error) {
	return s.rollupStore.CreateDirRollup(ctx, rollup)
}

func (s *SQLiteTransactionalStore) GetDirRollup(ctx context.Context, id int64) (*interfaces.DirRollup, error) {
	return s.rollupStore.GetDirRollup(ctx, id)
}

func (s *SQLiteTransactionalStore) GetLatestDirRollup(ctx context.Context, dirID int64) (*interfaces.DirRollup, error) {
	return s.rollupStore.GetLatestDirRollup(ctx, dirID)
}

func (s *SQLiteTransactionalStore) GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*interfaces.DirRollup, error) {
	return s.rollupStore.GetDirRollupHistory(ctx, dirID, limit)
}

func (s *SQLiteTransactionalStore) GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*interfaces.DirRollup, error) {
	return s.rollupStore.GetDirRollupsInTimeRange(ctx, dirID, startTime, endTime)
}

func (s *SQLiteTransactionalStore) BulkInsertDirRollups(ctx context.Context, rollups []*interfaces.DirRollup, params interfaces.BulkInsertParams) error {
	return s.rollupStore.BulkInsertDirRollups(ctx, rollups, params)
}

func (s *SQLiteTransactionalStore) DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error {
	return s.rollupStore.DeleteOldRollups(ctx, cutoffTime)
}

func (s *SQLiteTransactionalStore) DeleteRollupsByDirID(ctx context.Context, dirID int64) error {
	return s.rollupStore.DeleteRollupsByDirID(ctx, dirID)
}

func (s *SQLiteTransactionalStore) CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error) {
	return s.rollupStore.CountRollupsByDirID(ctx, dirID)
}

func (s *SQLiteTransactionalStore) GetRollupStats(ctx context.Context) (*interfaces.RollupStats, error) {
	return s.rollupStore.GetRollupStats(ctx)
}

// DockerStore methods
func (s *SQLiteTransactionalStore) UpsertVolume(ctx context.Context, volume *interfaces.Volume) error {
	return s.dockerStore.UpsertVolume(ctx, volume)
}

func (s *SQLiteTransactionalStore) DeleteVolume(ctx context.Context, volumeID string) error {
	return s.dockerStore.DeleteVolume(ctx, volumeID)
}

func (s *SQLiteTransactionalStore) GetVolumeByName(ctx context.Context, name string) (*interfaces.Volume, error) {
	return s.dockerStore.GetVolumeByName(ctx, name)
}

func (s *SQLiteTransactionalStore) ListAllVolumes(ctx context.Context) ([]*interfaces.Volume, error) {
	return s.dockerStore.ListAllVolumes(ctx)
}

func (s *SQLiteTransactionalStore) UpsertContainer(ctx context.Context, container *interfaces.Container) error {
	return s.dockerStore.UpsertContainer(ctx, container)
}

func (s *SQLiteTransactionalStore) DeleteContainer(ctx context.Context, containerID string) error {
	return s.dockerStore.DeleteContainer(ctx, containerID)
}

func (s *SQLiteTransactionalStore) GetContainerByID(ctx context.Context, containerID string) (*interfaces.Container, error) {
	return s.dockerStore.GetContainerByID(ctx, containerID)
}

func (s *SQLiteTransactionalStore) GetContainerByContainerID(ctx context.Context, containerID string) (*interfaces.Container, error) {
	return s.dockerStore.GetContainerByContainerID(ctx, containerID)
}

func (s *SQLiteTransactionalStore) GetVolumeByVolumeID(ctx context.Context, volumeID string) (*interfaces.Volume, error) {
	return s.dockerStore.GetVolumeByVolumeID(ctx, volumeID)
}

func (s *SQLiteTransactionalStore) ListAllContainers(ctx context.Context) ([]*interfaces.Container, error) {
	return s.dockerStore.ListAllContainers(ctx)
}

func (s *SQLiteTransactionalStore) UpsertVolumeMount(ctx context.Context, mount *interfaces.VolumeMount) error {
	return s.dockerStore.UpsertVolumeMount(ctx, mount)
}

func (s *SQLiteTransactionalStore) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	return s.dockerStore.DeleteVolumeMount(ctx, volumeID, containerID)
}

func (s *SQLiteTransactionalStore) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*interfaces.VolumeMount, error) {
	return s.dockerStore.GetVolumeMountsByContainer(ctx, containerID)
}

func (s *SQLiteTransactionalStore) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*interfaces.VolumeMount, error) {
	return s.dockerStore.GetVolumeMountsByVolume(ctx, volumeID)
}

func (s *SQLiteTransactionalStore) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	return s.dockerStore.DeactivateVolumeMounts(ctx, containerID)
}

func (s *SQLiteTransactionalStore) ListAllVolumeMounts(ctx context.Context) ([]*interfaces.VolumeMount, error) {
	return s.dockerStore.ListAllVolumeMounts(ctx)
}

// AnalyticsStore methods
func (s *SQLiteTransactionalStore) Rollup(ctx context.Context, volumeID string, opts *interfaces.RollupOptions) (*interfaces.RollupResult, error) {
	return s.analyticsStore.Rollup(ctx, volumeID, opts)
}

func (s *SQLiteTransactionalStore) CreateUsageSnapshot(ctx context.Context, params interfaces.CreateUsageSnapshotParams) (*interfaces.UsageSnapshot, error) {
	return s.analyticsStore.CreateUsageSnapshot(ctx, params)
}

func (s *SQLiteTransactionalStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*interfaces.UsageSnapshot, error) {
	return s.analyticsStore.GetLatestSnapshot(ctx, volumeID, snapshotType)
}

func (s *SQLiteTransactionalStore) Get7DayTrend(ctx context.Context, volumeID string) (*interfaces.TrendData, error) {
	return s.analyticsStore.Get7DayTrend(ctx, volumeID)
}

func (s *SQLiteTransactionalStore) Get30DayTrend(ctx context.Context, volumeID string) (*interfaces.TrendData, error) {
	return s.analyticsStore.Get30DayTrend(ctx, volumeID)
}

func (s *SQLiteTransactionalStore) GetGrowthDeltas(ctx context.Context, params interfaces.GetGrowthDeltasParams) (*interfaces.GrowthDeltasResult, error) {
	return s.analyticsStore.GetGrowthDeltas(ctx, params)
}

func (s *SQLiteTransactionalStore) GetVolumeStepSeries(ctx context.Context, params interfaces.GetVolumeStepSeriesParams) ([]*interfaces.StepSeriesPoint, error) {
	return s.analyticsStore.GetVolumeStepSeries(ctx, params)
}

func (s *SQLiteTransactionalStore) GetTrendSlope(ctx context.Context, params interfaces.GetTrendSlopeParams) (*interfaces.TrendSlopeResult, error) {
	return s.analyticsStore.GetTrendSlope(ctx, params)
}