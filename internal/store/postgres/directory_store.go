package postgres

import (
	"context"
	"fmt"

	"github.com/mantonx/volumeviz/internal/store/generated/postgres"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	"github.com/mantonx/volumeviz/internal/store/models"
)

// PostgresDirectoryStore implements DirectoryStore interface for PostgreSQL
type PostgresDirectoryStore struct {
	*PostgresInfrastructureStore
}

// NewPostgresDirectoryStore creates a new PostgreSQL directory store
func NewPostgresDirectoryStore(infra *PostgresInfrastructureStore) interfaces.DirectoryStore {
	return &PostgresDirectoryStore{
		PostgresInfrastructureStore: infra,
	}
}

// CreateDirNode creates a new directory node in the database
func (s *PostgresDirectoryStore) CreateDirNode(ctx context.Context, node *models.DirNode) (*models.DirNode, error) {
	params := toPostgresCreateDirNodeParams(node)
	
	row, err := s.queries.CreateDirNode(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create directory node: %w", err)
	}

	return fromPostgresDirNode(&row), nil
}

// GetDirNode retrieves a directory node by ID and volume ID
func (s *PostgresDirectoryStore) GetDirNode(ctx context.Context, id int64, volumeID string) (*models.DirNode, error) {
	row, err := s.queries.GetDirNode(ctx, postgres.GetDirNodeParams{
		ID:       id,
		VolumeID: volumeID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get directory node: %w", err)
	}

	return fromPostgresDirNode(&row), nil
}

// GetDirNodeByPath retrieves a directory node by path
func (s *PostgresDirectoryStore) GetDirNodeByPath(ctx context.Context, volumeID string, fullPath string) (*models.DirNode, error) {
	row, err := s.queries.GetDirNodeByPath(ctx, postgres.GetDirNodeByPathParams{
		VolumeID: volumeID,
		FullPath: fullPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get directory node by path: %w", err)
	}

	return fromPostgresDirNode(&row), nil
}

// GetChildDirNodes retrieves child directory nodes
func (s *PostgresDirectoryStore) GetChildDirNodes(ctx context.Context, volumeID string, parentDirID *int64) ([]*models.DirNode, error) {
	params := postgres.GetChildDirNodesParams{
		VolumeID:    volumeID,
		ParentDirID: nullInt64FromInt64Ptr(parentDirID),
	}

	rows, err := s.queries.GetChildDirNodes(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get child directory nodes: %w", err)
	}

	nodes := make([]*models.DirNode, len(rows))
	for i, row := range rows {
		nodes[i] = fromPostgresDirNode(&row)
	}

	return nodes, nil
}

// GetRootDirNodes retrieves root directory nodes for a volume
func (s *PostgresDirectoryStore) GetRootDirNodes(ctx context.Context, volumeID string) ([]*models.DirNode, error) {
	rows, err := s.queries.GetRootDirNodes(ctx, volumeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get root directory nodes: %w", err)
	}

	nodes := make([]*models.DirNode, len(rows))
	for i, row := range rows {
		nodes[i] = fromPostgresDirNode(&row)
	}

	return nodes, nil
}

// GetLargestDirectories retrieves the largest directories in a volume
func (s *PostgresDirectoryStore) GetLargestDirectories(ctx context.Context, volumeID string, limit int32) ([]*models.DirNode, error) {
	rows, err := s.queries.GetLargestDirectories(ctx, postgres.GetLargestDirectoriesParams{
		VolumeID: volumeID,
		Limit:    limit,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get largest directories: %w", err)
	}

	nodes := make([]*models.DirNode, len(rows))
	for i, row := range rows {
		nodes[i] = fromPostgresDirNode(&row)
	}

	return nodes, nil
}

// GetDirectoryTree retrieves directory tree up to a specified depth
func (s *PostgresDirectoryStore) GetDirectoryTree(ctx context.Context, volumeID string, maxDepth int32) ([]*models.DirNode, error) {
	rows, err := s.queries.GetDirectoryTree(ctx, postgres.GetDirectoryTreeParams{
		VolumeID: volumeID,
		MaxDepth: maxDepth,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get directory tree: %w", err)
	}

	nodes := make([]*models.DirNode, len(rows))
	for i, row := range rows {
		nodes[i] = fromPostgresDirNode(&row)
	}

	return nodes, nil
}

// UpsertDirNode creates or updates a directory node
func (s *PostgresDirectoryStore) UpsertDirNode(ctx context.Context, node *models.DirNode) (*models.DirNode, error) {
	params := postgres.UpsertDirNodeParams{
		VolumeID:          node.VolumeID,
		Name:              node.Name,
		FullPath:          node.FullPath,
		ParentDirID:       nullInt64FromInt64Ptr(node.ParentDirID),
		Depth:             node.Depth,
		LatestSizeBytes:   node.LatestSizeBytes,
		LatestFileCount:   node.LatestFileCount,
	}

	row, err := s.queries.UpsertDirNode(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert directory node: %w", err)
	}

	return fromPostgresDirNode(&row), nil
}

// UpdateDirNodeStats updates directory node statistics
func (s *PostgresDirectoryStore) UpdateDirNodeStats(ctx context.Context, id int64, volumeID string, sizeBytes int64, fileCount int64) error {
	err := s.queries.UpdateDirNodeStats(ctx, postgres.UpdateDirNodeStatsParams{
		ID:                id,
		VolumeID:          volumeID,
		LatestSizeBytes:   sizeBytes,
		LatestFileCount:   fileCount,
	})
	if err != nil {
		return fmt.Errorf("failed to update directory node stats: %w", err)
	}
	return nil
}

// DeleteDirNodesByVolume deletes all directory nodes for a volume
func (s *PostgresDirectoryStore) DeleteDirNodesByVolume(ctx context.Context, volumeID string) error {
	err := s.queries.DeleteDirNodesByVolume(ctx, volumeID)
	if err != nil {
		return fmt.Errorf("failed to delete directory nodes by volume: %w", err)
	}
	return nil
}

// CountDirNodesByVolume counts directory nodes in a volume
func (s *PostgresDirectoryStore) CountDirNodesByVolume(ctx context.Context, volumeID string) (int64, error) {
	count, err := s.queries.CountDirNodesByVolume(ctx, volumeID)
	if err != nil {
		return 0, fmt.Errorf("failed to count directory nodes by volume: %w", err)
	}
	return count, nil
}

// BulkInsertDirNodes performs bulk insertion of directory nodes
func (s *PostgresDirectoryStore) BulkInsertDirNodes(ctx context.Context, nodes []*models.DirNode, params models.BulkInsertParams) error {
	// Convert to PostgreSQL batch insert format
	var bulkParams []postgres.BulkInsertDirNodesParams
	for _, node := range nodes {
		bulkParams = append(bulkParams, postgres.BulkInsertDirNodesParams{
			VolumeID:          node.VolumeID,
			Name:              node.Name,
			FullPath:          node.FullPath,
			ParentDirID:       nullInt64FromInt64Ptr(node.ParentDirID),
			Depth:             node.Depth,
			LatestSizeBytes:   node.LatestSizeBytes,
			LatestFileCount:   node.LatestFileCount,
		})
	}

	// Execute bulk insert
	_, err := s.queries.BulkInsertDirNodes(ctx, bulkParams)
	if err != nil {
		return fmt.Errorf("failed to bulk insert directory nodes: %w", err)
	}

	return nil
}