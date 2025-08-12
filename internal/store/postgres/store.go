package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
)

// PostgresStore provides a unified interface that combines all domain stores
// This serves as a drop-in replacement for the original monolithic PostgresStore
type PostgresStore struct {
	interfaces.TransactionalStore
	infra *PostgresInfrastructureStore
}

// NewPostgresStore creates a new PostgreSQL store with all domain capabilities
func NewPostgresStore(pool *pgxpool.Pool) interfaces.Store {
	infra := NewPostgresInfrastructureStore(pool)
	txStore := NewPostgresTransactionalStore(infra)
	
	store := &PostgresStore{
		TransactionalStore: txStore,
		infra:              infra,
	}
	
	// Set facade reference for transaction callbacks
	infra.SetFacade(store)
	
	return store
}

// GetFacade returns a facade interface for backward compatibility
func (s *PostgresStore) GetFacade() interface{} {
	// This would typically return a *StoreFacade, but we avoid import cycles
	// by returning the interface. The caller can type-assert if needed.
	return s
}

// Infrastructure methods that need to be delegated
func (s *PostgresStore) Close() error {
	return s.infra.Close()
}

func (s *PostgresStore) Health(ctx context.Context) error {
	return s.infra.Health(ctx)
}

func (s *PostgresStore) BulkTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infra.BulkTx(ctx, fn)
}

func (s *PostgresStore) Tx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infra.Tx(ctx, fn)
}

func (s *PostgresStore) TxWithTimeout(ctx context.Context, timeout time.Duration, fn interfaces.TxFunc) error {
	return s.infra.TxWithTimeout(ctx, timeout, fn)
}

func (s *PostgresStore) ReadOnlyTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infra.ReadOnlyTx(ctx, fn)
}

func (s *PostgresStore) FastTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.infra.FastTx(ctx, fn)
}