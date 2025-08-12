package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/mantonx/volumeviz/internal/store/config"
	sqlite "github.com/mantonx/volumeviz/internal/store/generated/sqlite"
	"github.com/mantonx/volumeviz/internal/store/interfaces"
	_ "modernc.org/sqlite"
)

// SQLiteInfrastructureStore implements InfrastructureStore interface using SQLite
type SQLiteInfrastructureStore struct {
	db      *sql.DB
	queries *sqlite.Queries
	facade  interface{} // Legacy facade for compatibility
}

// NewSQLiteInfrastructureStore creates a new SQLite infrastructure store with optimized settings
func NewSQLiteInfrastructureStore(cfg *config.Config) (*SQLiteInfrastructureStore, error) {
	// Use SQLite DSN with performance optimizations
	db, err := sql.Open("sqlite", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("failed to open SQLite database: %w", err)
	}

	// Apply SQLite-specific settings
	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA cache_size=-64000", // 64MB cache
		"PRAGMA temp_store=memory",
		"PRAGMA mmap_size=268435456", // 256MB mmap
		"PRAGMA page_size=4096",
		"PRAGMA foreign_keys=ON",
		fmt.Sprintf("PRAGMA busy_timeout=%d", int(cfg.Timeout.Milliseconds())),
	}

	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			// Log warning but don't fail for unsupported pragmas
			fmt.Printf("Warning: Failed to apply SQLite optimization '%s': %v\n", pragma, err)
		}
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	store := &SQLiteInfrastructureStore{
		db:      db,
		queries: sqlite.New(db),
	}
	
	// Create legacy facade for backward compatibility
	if cfg != nil {
		// Facade will be initialized by the SQLiteStore constructor via SetFacade()
		store.facade = nil
	}
	
	// Run database migrations after store is fully initialized
	if err := store.runMigrations(); err != nil {
		log.Printf("Warning: Failed to run migrations: %v", err)
		// Don't fail store creation due to migration issues during development
	}
	
	return store, nil
}

// runMigrations applies all pending database migrations
func (s *SQLiteInfrastructureStore) runMigrations() error {
	// Note: golang-migrate has issues with SQLite where it closes the database connection
	// This is a known issue when running migrations on the same connection used by the store
	// We disable automatic migrations and require manual migration runs to work around this
	log.Printf("Automatic migrations disabled - use 'migrate up' command to run migrations")
	return nil
}

// GetDB returns the underlying database connection for use by other stores
func (s *SQLiteInfrastructureStore) GetDB() *sql.DB {
	return s.db
}

// GetQueries returns the generated queries for use by other stores
func (s *SQLiteInfrastructureStore) GetQueries() *sqlite.Queries {
	return s.queries
}

// GetFacade returns the legacy facade for backward compatibility
func (s *SQLiteInfrastructureStore) GetFacade() interface{} {
	return s.facade
}

// SetFacade sets the facade reference for transaction callbacks
func (s *SQLiteInfrastructureStore) SetFacade(facade interface{}) {
	s.facade = facade
}

// Close closes the database connection
func (s *SQLiteInfrastructureStore) Close() error {
	return s.db.Close()
}

// Health checks database connectivity
func (s *SQLiteInfrastructureStore) Health(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

// Tx executes a function within a database transaction
func (s *SQLiteInfrastructureStore) Tx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.TxWithTimeout(ctx, 30*time.Second, fn)
}

// TxWithTimeout executes a function within a database transaction with timeout
func (s *SQLiteInfrastructureStore) TxWithTimeout(ctx context.Context, timeout time.Duration, fn interfaces.TxFunc) error {
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Create a transactional infrastructure store for use within the transaction
	txInfraStore := &SQLiteInfrastructureStore{
		db:      s.db,
		queries: s.queries.WithTx(tx),
		facade:  s.facade,
	}

	// Create domain stores that use the transactional queries
	fileStore := NewSQLiteFileStore(txInfraStore)
	directoryStore := NewSQLiteDirectoryStore(txInfraStore)
	rollupStore := NewSQLiteRollupStore(txInfraStore)
	dockerStore := NewSQLiteDockerStore(txInfraStore)
	analyticsStore := NewSQLiteAnalyticsStore(txInfraStore)

	// Create the complete transactional store with all domain stores
	txStore := NewSQLiteTransactionalStore(
		fileStore,
		directoryStore,
		rollupStore,
		dockerStore,
		analyticsStore,
	)

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		} else if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()

	err = fn(ctx, txStore)
	return err
}

// ReadOnlyTx executes a function within a read-only database transaction
func (s *SQLiteInfrastructureStore) ReadOnlyTx(ctx context.Context, fn interfaces.TxFunc) error {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return fmt.Errorf("failed to begin read-only transaction: %w", err)
	}

	// Create a transactional infrastructure store for use within the transaction
	txInfraStore := &SQLiteInfrastructureStore{
		db:      s.db,
		queries: s.queries.WithTx(tx),
		facade:  s.facade,
	}

	// Create domain stores that use the transactional queries
	fileStore := NewSQLiteFileStore(txInfraStore)
	directoryStore := NewSQLiteDirectoryStore(txInfraStore)
	rollupStore := NewSQLiteRollupStore(txInfraStore)
	dockerStore := NewSQLiteDockerStore(txInfraStore)
	analyticsStore := NewSQLiteAnalyticsStore(txInfraStore)

	// Create the complete transactional store with all domain stores
	txStore := NewSQLiteTransactionalStore(
		fileStore,
		directoryStore,
		rollupStore,
		dockerStore,
		analyticsStore,
	)

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		} else if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()

	err = fn(ctx, txStore)
	return err
}

// FastTx executes a function within a fast database transaction (immediate mode)
func (s *SQLiteInfrastructureStore) FastTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.TxWithTimeout(ctx, 5*time.Second, fn)
}

// BulkTx executes a function within a bulk database transaction (deferred mode)
func (s *SQLiteInfrastructureStore) BulkTx(ctx context.Context, fn interfaces.TxFunc) error {
	return s.TxWithTimeout(ctx, 5*time.Minute, fn)
}