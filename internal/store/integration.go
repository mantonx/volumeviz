package store

import (
	"context"
	"fmt"

	"github.com/mantonx/volumeviz/internal/store/config"
)

// Integration provides a bridge between the existing ConnectionManager and the new StoreFacade
type Integration struct {
	connManager      *ConnectionManager
	simpleFacade     *SimpleFacade
	storeFacade      *StoreFacade // Full facade with all query methods
	bulkIngestFacade *BulkIngestFacade
	pgPool           interface{} // pgxpool.Pool for PostgreSQL
	sqliteDB         interface{} // sql.DB for SQLite
}

// NewIntegration creates a new integration layer
func NewIntegration(connManager *ConnectionManager) (*Integration, error) {
	if connManager == nil {
		return nil, fmt.Errorf("connection manager is required")
	}

	// Create simple facade for bulk ingestion
	simpleFacade := NewSimpleFacade(
		connManager.dbType,
		connManager.pgPool,
		connManager.sqliteDB,
	)

	// Create full store facade for query operations
	storeFacade := NewStoreFacade(
		connManager.dbType,
		connManager.pgPool,
		connManager.sqliteDB,
	)

	integration := &Integration{
		connManager:  connManager,
		simpleFacade: simpleFacade,
		storeFacade:  storeFacade,
		pgPool:       connManager.pgPool,
		sqliteDB:     connManager.sqliteDB,
	}

	// Create bulk ingestion facade
	bulkFacade, err := NewBulkIngestFacade(integration)
	if err != nil {
		return nil, fmt.Errorf("failed to create bulk ingest facade: %w", err)
	}
	integration.bulkIngestFacade = bulkFacade

	return integration, nil
}

// GetStoreFacade returns the simple facade for basic database operations (legacy method)
func (i *Integration) GetStoreFacade() *SimpleFacade {
	return i.simpleFacade
}

// GetFullStoreFacade returns the full store facade with all query methods
func (i *Integration) GetFullStoreFacade() *StoreFacade {
	return i.storeFacade
}

// GetBulkIngestFacade returns the bulk ingestion facade for high-performance file ingestion
func (i *Integration) GetBulkIngestFacade() *BulkIngestFacade {
	return i.bulkIngestFacade
}

// GetConnectionManager returns the connection manager for legacy database operations
func (i *Integration) GetConnectionManager() *ConnectionManager {
	return i.connManager
}

// HealthCheck performs a health check using both systems
func (i *Integration) HealthCheck(ctx context.Context) error {
	// Check connection manager health
	status := i.connManager.HealthCheck(ctx)
	if status.Status != "healthy" {
		return fmt.Errorf("connection manager health check failed: %s", status.Error)
	}

	// Check simple facade health
	if err := i.simpleFacade.HealthCheck(ctx); err != nil {
		return fmt.Errorf("simple facade health check failed: %w", err)
	}

	// Check full store facade health
	if err := i.storeFacade.HealthCheck(ctx); err != nil {
		return fmt.Errorf("store facade health check failed: %w", err)
	}

	return nil
}

// GetDatabaseType returns the current database type
func (i *Integration) GetDatabaseType() config.DatabaseType {
	return i.connManager.dbType
}

// Close closes the database connections
func (i *Integration) Close() error {
	return i.connManager.Close()
}
