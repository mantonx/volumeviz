package postgres

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/store/config"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// PostgresTransactionalStore combines all domain stores to provide transactional operations
type PostgresTransactionalStore struct {
	fileStore      interfaces.FileStore
	directoryStore interfaces.DirectoryStore
	rollupStore    interfaces.RollupStore
	dockerStore    interfaces.DockerStore
	analyticsStore interfaces.AnalyticsStore
	infra          *PostgresInfrastructureStore
}

// NewPostgresTransactionalStore creates a new PostgreSQL transactional store
func NewPostgresTransactionalStore(infra *PostgresInfrastructureStore) interfaces.TransactionalStore {
	return &PostgresTransactionalStore{
		fileStore:      NewPostgresFileStore(infra),
		directoryStore: NewPostgresDirectoryStore(infra),
		rollupStore:    NewPostgresRollupStore(infra),
		dockerStore:    NewPostgresDockerStore(infra),
		analyticsStore: NewPostgresAnalyticsStore(infra),
		infra:          infra,
	}
}

// File operations
func (s *PostgresTransactionalStore) CreateFileEntry(ctx context.Context, entry *models.FileEntry) (*models.FileEntry, error) {
	return s.fileStore.CreateFileEntry(ctx, entry)
}

func (s *PostgresTransactionalStore) GetFileEntry(ctx context.Context, id int64, volumeID string) (*models.FileEntry, error) {
	return s.fileStore.GetFileEntry(ctx, id, volumeID)
}

func (s *PostgresTransactionalStore) GetFileEntriesByVolumeAndParent(ctx context.Context, volumeID string, parentDirID *int64) ([]*models.FileEntry, error) {
	return s.fileStore.GetFileEntriesByVolumeAndParent(ctx, volumeID, parentDirID)
}

func (s *PostgresTransactionalStore) GetLargestFiles(ctx context.Context, volumeID string, limit int32) ([]*models.FileEntry, error) {
	return s.fileStore.GetLargestFiles(ctx, volumeID, limit)
}

func (s *PostgresTransactionalStore) FindFilesByPathHash(ctx context.Context, volumeID string, pathHash []byte) ([]*models.FileEntry, error) {
	return s.fileStore.FindFilesByPathHash(ctx, volumeID, pathHash)
}

func (s *PostgresTransactionalStore) UpsertFileEntry(ctx context.Context, entry *models.FileEntry) (*models.FileEntry, error) {
	return s.fileStore.UpsertFileEntry(ctx, entry)
}

func (s *PostgresTransactionalStore) DeleteFileEntriesByVolume(ctx context.Context, volumeID string) error {
	return s.fileStore.DeleteFileEntriesByVolume(ctx, volumeID)
}

func (s *PostgresTransactionalStore) CountFileEntriesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return s.fileStore.CountFileEntriesByVolume(ctx, volumeID)
}

func (s *PostgresTransactionalStore) GetVolumeFileStats(ctx context.Context, volumeID string) (*models.VolumeFileStats, error) {
	return s.fileStore.GetVolumeFileStats(ctx, volumeID)
}

func (s *PostgresTransactionalStore) BulkInsertFileEntries(ctx context.Context, entries []*models.FileEntry, params models.BulkInsertParams) error {
	return s.fileStore.BulkInsertFileEntries(ctx, entries, params)
}

// Directory operations
func (s *PostgresTransactionalStore) CreateDirNode(ctx context.Context, node *models.DirNode) (*models.DirNode, error) {
	return s.directoryStore.CreateDirNode(ctx, node)
}

func (s *PostgresTransactionalStore) GetDirNode(ctx context.Context, id int64, volumeID string) (*models.DirNode, error) {
	return s.directoryStore.GetDirNode(ctx, id, volumeID)
}

func (s *PostgresTransactionalStore) GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*models.DirNode, error) {
	return s.directoryStore.GetDirNodeByPath(ctx, volumeID, fullPath)
}

func (s *PostgresTransactionalStore) GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*models.DirNode, error) {
	return s.directoryStore.GetChildDirNodes(ctx, volumeID, parentDirID)
}

func (s *PostgresTransactionalStore) GetRootDirNodes(ctx context.Context, volumeID string) ([]*models.DirNode, error) {
	return s.directoryStore.GetRootDirNodes(ctx, volumeID)
}

func (s *PostgresTransactionalStore) GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*models.DirNode, error) {
	return s.directoryStore.GetLargestDirectories(ctx, volumeID, limit)
}

func (s *PostgresTransactionalStore) GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*models.DirNode, error) {
	return s.directoryStore.GetDirectoryTree(ctx, volumeID, maxDepth)
}

func (s *PostgresTransactionalStore) UpsertDirNode(ctx context.Context, node *models.DirNode) (*models.DirNode, error) {
	return s.directoryStore.UpsertDirNode(ctx, node)
}

func (s *PostgresTransactionalStore) UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error {
	return s.directoryStore.UpdateDirNodeStats(ctx, id, volumeID, sizeBytes, fileCount)
}

func (s *PostgresTransactionalStore) DeleteDirNodesByVolume(ctx context.Context, volumeID string) error {
	return s.directoryStore.DeleteDirNodesByVolume(ctx, volumeID)
}

func (s *PostgresTransactionalStore) CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error) {
	return s.directoryStore.CountDirNodesByVolume(ctx, volumeID)
}

func (s *PostgresTransactionalStore) BulkInsertDirNodes(ctx context.Context, nodes []*models.DirNode, params models.BulkInsertParams) error {
	return s.directoryStore.BulkInsertDirNodes(ctx, nodes, params)
}

// Rollup operations
func (s *PostgresTransactionalStore) CreateDirRollup(ctx context.Context, rollup *models.DirRollup) (*models.DirRollup, error) {
	return s.rollupStore.CreateDirRollup(ctx, rollup)
}

func (s *PostgresTransactionalStore) GetDirRollup(ctx context.Context, id int64) (*models.DirRollup, error) {
	return s.rollupStore.GetDirRollup(ctx, id)
}

func (s *PostgresTransactionalStore) GetLatestDirRollup(ctx context.Context, dirID int64) (*models.DirRollup, error) {
	return s.rollupStore.GetLatestDirRollup(ctx, dirID)
}

func (s *PostgresTransactionalStore) GetDirRollupHistory(ctx context.Context, dirID int64, limit int32) ([]*models.DirRollup, error) {
	return s.rollupStore.GetDirRollupHistory(ctx, dirID, limit)
}

func (s *PostgresTransactionalStore) GetDirRollupsInTimeRange(ctx context.Context, dirID int64, startTime, endTime time.Time) ([]*models.DirRollup, error) {
	return s.rollupStore.GetDirRollupsInTimeRange(ctx, dirID, startTime, endTime)
}

func (s *PostgresTransactionalStore) DeleteOldRollups(ctx context.Context, cutoffTime time.Time) error {
	return s.rollupStore.DeleteOldRollups(ctx, cutoffTime)
}

func (s *PostgresTransactionalStore) DeleteRollupsByDirID(ctx context.Context, dirID int64) error {
	return s.rollupStore.DeleteRollupsByDirID(ctx, dirID)
}

func (s *PostgresTransactionalStore) CountRollupsByDirID(ctx context.Context, dirID int64) (int64, error) {
	return s.rollupStore.CountRollupsByDirID(ctx, dirID)
}

func (s *PostgresTransactionalStore) GetRollupStats(ctx context.Context) (*models.RollupStats, error) {
	return s.rollupStore.GetRollupStats(ctx)
}

func (s *PostgresTransactionalStore) BulkInsertDirRollups(ctx context.Context, rollups []*models.DirRollup, params models.BulkInsertParams) error {
	return s.rollupStore.BulkInsertDirRollups(ctx, rollups, params)
}

// Docker operations
func (s *PostgresTransactionalStore) UpsertVolume(ctx context.Context, volume *models.Volume) error {
	return s.dockerStore.UpsertVolume(ctx, volume)
}

func (s *PostgresTransactionalStore) DeleteVolume(ctx context.Context, volumeID string) error {
	return s.dockerStore.DeleteVolume(ctx, volumeID)
}

func (s *PostgresTransactionalStore) GetVolumeByName(ctx context.Context, name string) (*models.Volume, error) {
	return s.dockerStore.GetVolumeByName(ctx, name)
}

func (s *PostgresTransactionalStore) ListAllVolumes(ctx context.Context) ([]*models.Volume, error) {
	return s.dockerStore.ListAllVolumes(ctx)
}

func (s *PostgresTransactionalStore) UpsertContainer(ctx context.Context, container *models.Container) error {
	return s.dockerStore.UpsertContainer(ctx, container)
}

func (s *PostgresTransactionalStore) DeleteContainer(ctx context.Context, containerID string) error {
	return s.dockerStore.DeleteContainer(ctx, containerID)
}

func (s *PostgresTransactionalStore) GetContainerByID(ctx context.Context, containerID string) (*models.Container, error) {
	return s.dockerStore.GetContainerByID(ctx, containerID)
}

func (s *PostgresTransactionalStore) ListAllContainers(ctx context.Context) ([]*models.Container, error) {
	return s.dockerStore.ListAllContainers(ctx)
}

func (s *PostgresTransactionalStore) UpsertVolumeMount(ctx context.Context, mount *models.VolumeMount) error {
	return s.dockerStore.UpsertVolumeMount(ctx, mount)
}

func (s *PostgresTransactionalStore) DeleteVolumeMount(ctx context.Context, volumeID, containerID string) error {
	return s.dockerStore.DeleteVolumeMount(ctx, volumeID, containerID)
}

func (s *PostgresTransactionalStore) GetVolumeMountsByContainer(ctx context.Context, containerID string) ([]*models.VolumeMount, error) {
	return s.dockerStore.GetVolumeMountsByContainer(ctx, containerID)
}

func (s *PostgresTransactionalStore) GetVolumeMountsByVolume(ctx context.Context, volumeID string) ([]*models.VolumeMount, error) {
	return s.dockerStore.GetVolumeMountsByVolume(ctx, volumeID)
}

func (s *PostgresTransactionalStore) DeactivateVolumeMounts(ctx context.Context, containerID string) error {
	return s.dockerStore.DeactivateVolumeMounts(ctx, containerID)
}

func (s *PostgresTransactionalStore) ListAllVolumeMounts(ctx context.Context) ([]*models.VolumeMount, error) {
	return s.dockerStore.ListAllVolumeMounts(ctx)
}

// Analytics operations
func (s *PostgresTransactionalStore) CreateUsageSnapshot(ctx context.Context, params models.CreateUsageSnapshotParams) (*models.UsageSnapshot, error) {
	return s.analyticsStore.CreateUsageSnapshot(ctx, params)
}

func (s *PostgresTransactionalStore) GetLatestSnapshot(ctx context.Context, volumeID, snapshotType string) (*models.UsageSnapshot, error) {
	return s.analyticsStore.GetLatestSnapshot(ctx, volumeID, snapshotType)
}

func (s *PostgresTransactionalStore) Get7DayTrend(ctx context.Context, volumeID string) (*models.TrendData, error) {
	return s.analyticsStore.Get7DayTrend(ctx, volumeID)
}

func (s *PostgresTransactionalStore) Get30DayTrend(ctx context.Context, volumeID string) (*models.TrendData, error) {
	return s.analyticsStore.Get30DayTrend(ctx, volumeID)
}

func (s *PostgresTransactionalStore) GetGrowthDeltas(ctx context.Context, params models.GetGrowthDeltasParams) (*models.GrowthDeltasResult, error) {
	return s.analyticsStore.GetGrowthDeltas(ctx, params)
}

func (s *PostgresTransactionalStore) GetVolumeStepSeries(ctx context.Context, params models.GetVolumeStepSeriesParams) ([]*models.StepSeriesPoint, error) {
	return s.analyticsStore.GetVolumeStepSeries(ctx, params)
}

func (s *PostgresTransactionalStore) GetTrendSlope(ctx context.Context, params models.GetTrendSlopeParams) (*models.TrendSlopeResult, error) {
	return s.analyticsStore.GetTrendSlope(ctx, params)
}

func (s *PostgresTransactionalStore) Rollup(ctx context.Context, volumeID string, opts *models.RollupOptions) (*models.RollupResult, error) {
	return s.analyticsStore.Rollup(ctx, volumeID, opts)
}

// Infrastructure operations
func (s *PostgresTransactionalStore) Close() error {
	return s.infra.Close()
}

func (s *PostgresTransactionalStore) Health(ctx context.Context) error {
	return s.infra.Health(ctx)
}

func (s *PostgresTransactionalStore) GetDatabaseType() config.DatabaseType {
	return s.infra.GetDatabaseType()
}

func (s *PostgresTransactionalStore) Tx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infra.Tx(ctx, fn)
}

func (s *PostgresTransactionalStore) TxWithTimeout(ctx context.Context, timeout time.Duration, fn interfaces.TxFunc) error {
	return s.infra.TxWithTimeout(ctx, timeout, fn)
}

func (s *PostgresTransactionalStore) ReadOnlyTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infra.ReadOnlyTx(ctx, fn)
}

func (s *PostgresTransactionalStore) FastTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infra.FastTx(ctx, fn)
}

func (s *PostgresTransactionalStore) BulkTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infra.BulkTx(ctx, fn)
}