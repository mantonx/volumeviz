package sqlite

import (
	"github.com/mantonx/volumeviz/internal/store/config"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
)

// SQLiteStore is a complete store implementation using SQLite with domain-specific stores
type SQLiteStore struct {
	// Infrastructure store handles connections, transactions, and health
	infraStore *SQLiteInfrastructureStore

	// Domain-specific stores
	fileStore      *SQLiteFileStore
	directoryStore *SQLiteDirectoryStore
	rollupStore    *SQLiteRollupStore
	dockerStore    *SQLiteDockerStore
	analyticsStore *SQLiteAnalyticsStore
}

// NewSQLiteStore creates a new complete SQLite store with all domain stores
func NewSQLiteStore(cfg *config.Config) (*SQLiteStore, error) {
	// Create the infrastructure store
	infraStore, err := NewSQLiteInfrastructureStore(cfg)
	if err != nil {
		return nil, err
	}

	// Create all domain stores
	fileStore := NewSQLiteFileStore(infraStore)
	directoryStore := NewSQLiteDirectoryStore(infraStore)
	rollupStore := NewSQLiteRollupStore(infraStore)
	dockerStore := NewSQLiteDockerStore(infraStore)
	analyticsStore := NewSQLiteAnalyticsStore(infraStore)

	return &SQLiteStore{
		infraStore:     infraStore,
		fileStore:      fileStore,
		directoryStore: directoryStore,
		rollupStore:    rollupStore,
		dockerStore:    dockerStore,
		analyticsStore: analyticsStore,
	}, nil
}

// GetInfrastructureStore returns the infrastructure store for direct access
func (s *SQLiteStore) GetInfrastructureStore() interfaces.InfrastructureStore {
	return s.infraStore
}

// GetFileStore returns the file store for direct access
func (s *SQLiteStore) GetFileStore() interfaces.FileStore {
	return s.fileStore
}

// GetDirectoryStore returns the directory store for direct access
func (s *SQLiteStore) GetDirectoryStore() interfaces.DirectoryStore {
	return s.directoryStore
}

// GetRollupStore returns the rollup store for direct access
func (s *SQLiteStore) GetRollupStore() interfaces.RollupStore {
	return s.rollupStore
}

// GetDockerStore returns the docker store for direct access
func (s *SQLiteStore) GetDockerStore() interfaces.DockerStore {
	return s.dockerStore
}

// GetAnalyticsStore returns the analytics store for direct access
func (s *SQLiteStore) GetAnalyticsStore() interfaces.AnalyticsStore {
	return s.analyticsStore
}

// Close closes all store connections
func (s *SQLiteStore) Close() error {
	return s.infraStore.Close()
}

// GetFacade returns the legacy facade for backward compatibility
func (s *SQLiteStore) GetFacade() interface{} {
	return s.infraStore.GetFacade()
}