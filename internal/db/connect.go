// Package db provides database connections and generated sqlc code
// This package contains no business logic - only connection management and sqlc generated types
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
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

