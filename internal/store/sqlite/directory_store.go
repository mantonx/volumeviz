package sqlite

import (
	"context"
	"fmt"

	sqlite "github.com/mantonx/volumeviz/internal/store/generated/sqlite"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// SQLiteDirectoryStore implements DirectoryStore interface using SQLite
type SQLiteDirectoryStore struct {
	infraStore *SQLiteInfrastructureStore
}

// NewSQLiteDirectoryStore creates a new SQLite directory store
func NewSQLiteDirectoryStore(infraStore *SQLiteInfrastructureStore) interfaces.DirectoryStore {
	return &SQLiteDirectoryStore{
		infraStore: infraStore,
	}
}

// CreateDirNode creates a new directory node
func (s *SQLiteDirectoryStore) CreateDirNode(ctx context.Context, node *models.DirNode) (*models.DirNode, error) {
	dbNode, err := s.infraStore.GetQueries().CreateDirNode(ctx, sqlite.CreateDirNodeParams{
		VolumeID:        node.VolumeID,
		ParentDirID:     toSQLiteInt64(node.ParentDirID),
		Name:            node.Name,
		FullPath:        node.FullPath,
		Depth:           int64(node.Depth),
		LatestSizeBytes: node.LatestSizeBytes,
		LatestFileCount: node.LatestFileCount,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create dir node: %w", err)
	}
	return fromSQLiteDirNode(dbNode)
}

// GetDirNode retrieves a directory node by ID and volume ID
func (s *SQLiteDirectoryStore) GetDirNode(ctx context.Context, id int64, volumeID string) (*models.DirNode, error) {
	dbNode, err := s.infraStore.GetQueries().GetDirNode(ctx, sqlite.GetDirNodeParams{
		ID:       id,
		VolumeID: volumeID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir node: %w", err)
	}
	return fromSQLiteDirNode(dbNode)
}

// UpsertDirNode creates or updates a directory node
func (s *SQLiteDirectoryStore) UpsertDirNode(ctx context.Context, node *models.DirNode) (*models.DirNode, error) {
	dbNode, err := s.infraStore.GetQueries().UpsertDirNode(ctx, sqlite.UpsertDirNodeParams{
		VolumeID:        node.VolumeID,
		ParentDirID:     toSQLiteInt64(node.ParentDirID),
		Name:            node.Name,
		FullPath:        node.FullPath,
		Depth:           int64(node.Depth),
		LatestSizeBytes: 0, // Will be updated later
		LatestFileCount: 0, // Will be updated later
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert dir node: %w", err)
	}
	return fromSQLiteDirNode(dbNode)
}

// UpdateDirNodeStats updates the size and file count statistics for a directory node
func (s *SQLiteDirectoryStore) UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error {
	err := s.infraStore.GetQueries().UpdateDirNodeStats(ctx, sqlite.UpdateDirNodeStatsParams{
		ID:              id,
		VolumeID:        volumeID,
		LatestSizeBytes: sizeBytes,
		LatestFileCount: fileCount,
	})
	if err != nil {
		return fmt.Errorf("failed to update dir node stats: %w", err)
	}
	return nil
}

// GetDirNodeByPath retrieves a directory node by its full path
func (s *SQLiteDirectoryStore) GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*models.DirNode, error) {
	dbNode, err := s.infraStore.GetQueries().GetDirNodeByPath(ctx, sqlite.GetDirNodeByPathParams{
		VolumeID: volumeID,
		FullPath: fullPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dir node by path: %w", err)
	}
	return fromSQLiteDirNode(dbNode)
}

// GetChildDirNodes retrieves child directory nodes
func (s *SQLiteDirectoryStore) GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*models.DirNode, error) {
	dbNodes, err := s.infraStore.GetQueries().GetChildDirNodes(ctx, sqlite.GetChildDirNodesParams{
		VolumeID:    volumeID,
		ParentDirID: toSQLiteInt64(parentDirID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get child dir nodes: %w", err)
	}

	nodes := make([]*models.DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		node, err := fromSQLiteDirNode(dbNode)
		if err != nil {
			return nil, err
		}
		nodes[i] = node
	}
	return nodes, nil
}

// GetRootDirNodes retrieves root-level directory nodes (no parent)
func (s *SQLiteDirectoryStore) GetRootDirNodes(ctx context.Context, volumeID string) ([]*models.DirNode, error) {
	dbNodes, err := s.infraStore.GetQueries().GetRootDirNodes(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get root dir nodes: %w", err)
	}

	nodes := make([]*models.DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		node, err := fromSQLiteDirNode(dbNode)
		if err != nil {
			return nil, err
		}
		nodes[i] = node
	}
	return nodes, nil
}

// GetLargestDirectories retrieves the largest directories in a volume
func (s *SQLiteDirectoryStore) GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*models.DirNode, error) {
	dbNodes, err := s.infraStore.GetQueries().GetLargestDirectories(ctx, sqlite.GetLargestDirectoriesParams{
		VolumeID: volumeID,
		Limit:    int64(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get largest directories: %w", err)
	}

	nodes := make([]*models.DirNode, len(dbNodes))
	for i, dbNode := range dbNodes {
		node, err := fromSQLiteDirNode(dbNode)
		if err != nil {
			return nil, err
		}
		nodes[i] = node
	}
	return nodes, nil
}

// GetDirectoryTree retrieves a directory tree up to a specified depth
func (s *SQLiteDirectoryStore) GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*models.DirNode, error) {
	dbRows, err := s.infraStore.GetQueries().GetDirectoryTree(ctx, sqlite.GetDirectoryTreeParams{
		VolumeID: volumeID,
		MaxDepth: int64(maxDepth),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get directory tree: %w", err)
	}

	nodes := make([]*models.DirNode, len(dbRows))
	for i, dbRow := range dbRows {
		node, err := fromSQLiteGetDirectoryTreeRow(dbRow)
		if err != nil {
			return nil, err
		}
		nodes[i] = node
	}
	return nodes, nil
}

// BulkInsertDirNodes performs bulk insertion of directory nodes
func (s *SQLiteDirectoryStore) BulkInsertDirNodes(ctx context.Context, nodes []*models.DirNode, params interfaces.BulkInsertParams) error {
	if len(nodes) == 0 {
		return nil
	}

	chunkSize := defaultChunkSize()
	if params.BatchSize > 0 {
		chunkSize = params.BatchSize
	}

	chunks := chunkSlice(nodes, chunkSize)
	for _, chunk := range chunks {
		if err := s.executeBatchInsertDirNodes(ctx, chunk); err != nil {
			return fmt.Errorf("failed to execute batch insert: %w", err)
		}
	}

	return nil
}

// DeleteDirNodesByVolume deletes all directory nodes for a volume
func (s *SQLiteDirectoryStore) DeleteDirNodesByVolume(ctx context.Context, volumeID string) error {
	err := s.infraStore.GetQueries().DeleteDirNodesByVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete dir nodes by volume: %w", err)
	}
	return nil
}

// CountDirNodesByVolume counts directory nodes in a volume
func (s *SQLiteDirectoryStore) CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error) {
	count, err := s.infraStore.GetQueries().CountDirNodesByVolume(ctx, volumeID)
	if err != nil {
		return 0, fmt.Errorf("failed to count dir nodes by volume: %w", err)
	}
	return count, nil
}

// executeBatchInsertDirNodes executes a batch insert for directory nodes
func (s *SQLiteDirectoryStore) executeBatchInsertDirNodes(ctx context.Context, nodes []*models.DirNode) error {
	for _, node := range nodes {
		_, err := s.infraStore.GetQueries().CreateDirNode(ctx, sqlite.CreateDirNodeParams{
			VolumeID:        node.VolumeID,
			ParentDirID:     toSQLiteInt64(node.ParentDirID),
			Name:            node.Name,
			FullPath:        node.FullPath,
			Depth:           int64(node.Depth),
			LatestSizeBytes: 0, // Will be updated later
			LatestFileCount: 0, // Will be updated later
		})
		if err != nil {
			return err
		}
	}
	return nil
}