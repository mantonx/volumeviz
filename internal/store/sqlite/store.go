package sqlite

import (
	"context"
	"time"

	"github.com/mantonx/volumeviz/internal/store/config"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
)

// SQLiteStore is a complete store implementation using SQLite with domain-specific stores
type SQLiteStore struct {
	// Embed TransactionalStore to implement all Store interface methods
	interfaces.TransactionalStore
	
	// Infrastructure store handles connections, transactions, and health
	infraStore *SQLiteInfrastructureStore
}

// NewSQLiteStore creates a new complete SQLite store with all domain stores
func NewSQLiteStore(cfg *config.Config) (interfaces.Store, error) {
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

	// Create the transactional store
	txStore := NewSQLiteTransactionalStore(fileStore, directoryStore, rollupStore, dockerStore, analyticsStore)

	store := &SQLiteStore{
		TransactionalStore: txStore,
		infraStore:         infraStore,
	}

	// Set facade reference for transaction callbacks
	infraStore.SetFacade(store)

	return store, nil
}

// Infrastructure methods delegated to infraStore
func (s *SQLiteStore) Close() error {
	return s.infraStore.Close()
}

func (s *SQLiteStore) Health(ctx context.Context) error {
	return s.infraStore.Health(ctx)
}

func (s *SQLiteStore) BulkTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infraStore.BulkTx(ctx, fn)
}

func (s *SQLiteStore) Tx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infraStore.Tx(ctx, fn)
}

func (s *SQLiteStore) TxWithTimeout(ctx context.Context, timeout time.Duration, fn interfaces.TxFunc) error {
	return s.infraStore.TxWithTimeout(ctx, timeout, fn)
}

func (s *SQLiteStore) ReadOnlyTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infraStore.ReadOnlyTx(ctx, fn)
}

func (s *SQLiteStore) FastTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infraStore.FastTx(ctx, fn)
}

// GetFacade returns the legacy facade for backward compatibility
func (s *SQLiteStore) GetFacade() interface{} {
	return s
}

// GetInfrastructureStore returns the infrastructure store for testing purposes
func (s *SQLiteStore) GetInfrastructureStore() *SQLiteInfrastructureStore {
	return s.infraStore
}