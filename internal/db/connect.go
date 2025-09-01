// Package db provides database connections and generated sqlc code
// This package contains no business logic - only connection management and sqlc generated types
package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	sqlcSQLite "github.com/mantonx/volumeviz/internal/db/sqlc-sqlite"
	_ "modernc.org/sqlite"
)

// PostgreSQLConnection wraps a PostgreSQL connection pool and sqlc queries
type PostgreSQLConnection struct {
	Pool    *pgxpool.Pool
	Queries *sqlc.Queries
}

// ConnectPostgreSQL creates a PostgreSQL connection with proper configuration
func ConnectPostgreSQL(ctx context.Context, dsn string, maxConns int) (*PostgreSQLConnection, error) {
	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PostgreSQL DSN: %w", err)
	}

	poolConfig.MaxConns = int32(maxConns)
	poolConfig.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	return &PostgreSQLConnection{
		Pool:    pool,
		Queries: sqlc.New(pool),
	}, nil
}

// Close closes the PostgreSQL connection pool
func (c *PostgreSQLConnection) Close() {
	if c.Pool != nil {
		c.Pool.Close()
	}
}

// Health checks the PostgreSQL connection health
func (c *PostgreSQLConnection) Health(ctx context.Context) error {
	return c.Pool.Ping(ctx)
}

// SQLiteConnection wraps a SQLite database connection and sqlc queries
type SQLiteConnection struct {
	DB      *sql.DB
	Queries *sqlcSQLite.Queries
}

// ConnectSQLite creates a SQLite connection with proper configuration
func ConnectSQLite(ctx context.Context, dsn string) (*SQLiteConnection, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open SQLite database: %w", err)
	}

	// Configure connection pool for SQLite
	db.SetMaxOpenConns(1) // SQLite should have only one connection for writes
	db.SetMaxIdleConns(1)

	// Test the connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping SQLite database: %w", err)
	}

	return &SQLiteConnection{
		DB:      db,
		Queries: sqlcSQLite.New(db),
	}, nil
}

// Close closes the SQLite database connection
func (c *SQLiteConnection) Close() {
	if c.DB != nil {
		c.DB.Close()
	}
}

// Health checks the SQLite connection health
func (c *SQLiteConnection) Health(ctx context.Context) error {
	return c.DB.PingContext(ctx)
}
