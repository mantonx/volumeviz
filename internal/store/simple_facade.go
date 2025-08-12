package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/store/config"
)

// SimpleFacade provides basic database operations for the bulk ingestion system
// This is a minimal implementation to support bulk file ingestion
type SimpleFacade struct {
	dbType   config.DatabaseType
	pgPool   *pgxpool.Pool
	sqliteDB *sql.DB
}

// NewSimpleFacade creates a new simple facade
func NewSimpleFacade(dbType config.DatabaseType, pgPool *pgxpool.Pool, sqliteDB *sql.DB) *SimpleFacade {
	return &SimpleFacade{
		dbType:   dbType,
		pgPool:   pgPool,
		sqliteDB: sqliteDB,
	}
}

// GetDatabaseType returns the database type
func (f *SimpleFacade) GetDatabaseType() config.DatabaseType {
	return f.dbType
}

// HealthCheck performs a basic health check
func (f *SimpleFacade) HealthCheck(ctx context.Context) error {
	switch f.dbType {
	case config.DatabaseTypePostgreSQL:
		if f.pgPool == nil {
			return fmt.Errorf("PostgreSQL pool not available")
		}
		return f.pgPool.Ping(ctx)

	case config.DatabaseTypeSQLite:
		if f.sqliteDB == nil {
			return fmt.Errorf("SQLite database not available")
		}
		return f.sqliteDB.PingContext(ctx)

	default:
		return fmt.Errorf("unsupported database type: %s", f.dbType)
	}
}

// GetPgPool returns the PostgreSQL connection pool
func (f *SimpleFacade) GetPgPool() *pgxpool.Pool {
	return f.pgPool
}

// GetSQLiteDB returns the SQLite database connection
func (f *SimpleFacade) GetSQLiteDB() *sql.DB {
	return f.sqliteDB
}
