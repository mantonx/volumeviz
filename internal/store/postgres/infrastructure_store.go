package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/store/config"
	"github.com/mantonx/volumeviz/internal/store/generated/postgres"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
)

// PostgresInfrastructureStore provides core database infrastructure for PostgreSQL
type PostgresInfrastructureStore struct {
	pool    *pgxpool.Pool
	queries *postgres.Queries
	facade  interface{}
}

// NewPostgresInfrastructureStore creates a new PostgreSQL infrastructure store
func NewPostgresInfrastructureStore(pool *pgxpool.Pool) *PostgresInfrastructureStore {
	queries := postgres.New(pool)
	
	return &PostgresInfrastructureStore{
		pool:    pool,
		queries: queries,
	}
}

// GetPool returns the PostgreSQL connection pool
func (s *PostgresInfrastructureStore) GetPool() *pgxpool.Pool {
	return s.pool
}

// GetQueries returns the generated queries
func (s *PostgresInfrastructureStore) GetQueries() *postgres.Queries {
	return s.queries
}

// Close closes the database connection pool
func (s *PostgresInfrastructureStore) Close() error {
	if s.pool != nil {
		s.pool.Close()
	}
	return nil
}

// Health performs a health check on the database connection
func (s *PostgresInfrastructureStore) Health(ctx context.Context) error {
	if s.pool == nil {
		return fmt.Errorf("PostgreSQL pool is not initialized")
	}
	return s.pool.Ping(ctx)
}

// GetDatabaseType returns the database type
func (s *PostgresInfrastructureStore) GetDatabaseType() config.DatabaseType {
	return config.DatabaseTypePostgreSQL
}

// SetFacade sets the facade reference for transaction callbacks
func (s *PostgresInfrastructureStore) SetFacade(facade interface{}) {
	s.facade = facade
}

// Tx executes a function within a transaction
func (s *PostgresInfrastructureStore) Tx(ctx context.Context, fn interfaces.TxFunc) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Create transactional queries
	qtx := s.queries.WithTx(tx)

	// Create transactional store if facade is set
	var txStore interfaces.TransactionalStore
	if s.facade != nil {
		if facade, ok := s.facade.(interfaces.TransactionalStore); ok {
			// Use the facade's transaction method if available
			txStore = facade
		}
	}

	// Execute the function
	if err := fn(ctx, txStore); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// TxWithTimeout executes a function within a transaction with a timeout
func (s *PostgresInfrastructureStore) TxWithTimeout(ctx context.Context, timeout time.Duration, fn interfaces.TxFunc) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	
	return s.Tx(ctx, fn)
}

// ReadOnlyTx executes a read-only transaction
func (s *PostgresInfrastructureStore) ReadOnlyTx(ctx context.Context, fn interfaces.TxFunc) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin read-only transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Set transaction to read-only
	if _, err := tx.Exec(ctx, "SET TRANSACTION READ ONLY"); err != nil {
		return fmt.Errorf("failed to set read-only transaction: %w", err)
	}

	// Create transactional queries
	qtx := s.queries.WithTx(tx)

	// Create transactional store if facade is set
	var txStore interfaces.TransactionalStore
	if s.facade != nil {
		if facade, ok := s.facade.(interfaces.TransactionalStore); ok {
			txStore = facade
		}
	}

	// Execute the function
	if err := fn(ctx, txStore); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// FastTx executes a function within a fast transaction (reduced isolation)
func (s *PostgresInfrastructureStore) FastTx(ctx context.Context, fn interfaces.TxFunc) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin fast transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Set transaction isolation level to read committed for better performance
	if _, err := tx.Exec(ctx, "SET TRANSACTION ISOLATION LEVEL READ COMMITTED"); err != nil {
		return fmt.Errorf("failed to set transaction isolation: %w", err)
	}

	// Create transactional queries
	qtx := s.queries.WithTx(tx)

	// Create transactional store if facade is set
	var txStore interfaces.TransactionalStore
	if s.facade != nil {
		if facade, ok := s.facade.(interfaces.TransactionalStore); ok {
			txStore = facade
		}
	}

	// Execute the function
	if err := fn(ctx, txStore); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// BulkTx executes a function within a transaction optimized for bulk operations
func (s *PostgresInfrastructureStore) BulkTx(ctx context.Context, fn interfaces.TxFunc) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin bulk transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Optimize for bulk operations
	optimizations := []string{
		"SET TRANSACTION ISOLATION LEVEL READ COMMITTED",
		"SET synchronous_commit = off",    // Faster commits for bulk operations
		"SET checkpoint_segments = 32",    // More checkpoints for bulk
	}

	for _, opt := range optimizations {
		if _, err := tx.Exec(ctx, opt); err != nil {
			// Log warning but continue - some settings might not be available
			continue
		}
	}

	// Create transactional queries
	qtx := s.queries.WithTx(tx)

	// Create transactional store if facade is set
	var txStore interfaces.TransactionalStore
	if s.facade != nil {
		if facade, ok := s.facade.(interfaces.TransactionalStore); ok {
			txStore = facade
		}
	}

	// Execute the function
	if err := fn(ctx, txStore); err != nil {
		return err
	}

	return tx.Commit(ctx)
}