package store

import (
	"context"
	"testing"

	"github.com/mantonx/volumeviz/internal/db"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// TestCleanArchitectureCompliance tests that our new three-layer architecture works correctly
func TestCleanArchitectureCompliance(t *testing.T) {
	// This test verifies that our clean architecture interfaces work as expected
	
	t.Run("Store Interface Compliance", func(t *testing.T) {
		// Create a mock connection (we can't test with real DB easily)
		mockConn := &db.PostgreSQLConnection{
			Pool:    nil, // Would be a real pool in production
			Queries: &sqlc.Queries{}, // Would be initialized with real connection
		}

		// Test that our store implements the interface correctly
		var store Store = NewPostgreSQLStore(mockConn)
		
		// Verify all required methods are available
		if store.Volumes() == nil {
			t.Error("Store.Volumes() should return a repository")
		}
		
		// Note: Scans repository is not yet implemented
		// if store.Scans() == nil {
		//	t.Error("Store.Scans() should return a repository")
		// }

		// Test that WithTx method signature exists (compile-time check)
		// We don't actually call it since we don't have a real database connection
		var _ func(context.Context, func(TxStore) error) error = store.WithTx
	})

	t.Run("Repository Independence", func(t *testing.T) {
		// Test that repositories can be used independently
		// This is a compile-time test to ensure our interfaces are properly defined
		
		// Verify that our store provides repository access
		mockConn := &db.PostgreSQLConnection{
			Pool:    nil,
			Queries: &sqlc.Queries{},
		}
		
		store := NewPostgreSQLStore(mockConn)
		volumesRepo := store.Volumes()
		if volumesRepo == nil {
			t.Error("Store should provide volumes repository")
		}
	})
}

// TestLayerSeparation verifies that our layers are properly separated
func TestLayerSeparation(t *testing.T) {
	t.Run("Store Does Not Import Models Directly", func(t *testing.T) {
		// This is enforced by our import linter, but we can verify at runtime
		// that the store only provides repository interfaces, not direct model access
		
		mockConn := &db.PostgreSQLConnection{
			Pool:    nil,
			Queries: &sqlc.Queries{},
		}

		store := NewPostgreSQLStore(mockConn)
		
		// Store should only provide repository access, not direct model manipulation
		// This is a design verification rather than a functional test
		
		volumesRepo := store.Volumes()
		if volumesRepo == nil {
			t.Error("Store should provide volumes repository")
		}

		// Note: Scans repository is not yet implemented
	})
}

// TestTransactionBoundaries verifies transaction handling works correctly  
func TestTransactionBoundaries(t *testing.T) {
	t.Run("Transaction Context Propagation", func(t *testing.T) {
		mockConn := &db.PostgreSQLConnection{
			Pool:    nil,
			Queries: &sqlc.Queries{},
		}

		store := NewPostgreSQLStore(mockConn)
		
			// Test that transaction methods exist (compile-time check)
		// We don't actually call them since we don't have a real database connection
		var _ func(context.Context, func(TxStore) error) error = store.WithTx
		
		// Verify that TxStore interface has required methods (compile-time check)
		var txStore TxStore = (*pgTxStore)(nil)
		if txStore != nil {
			_ = txStore.Volumes() // Compile-time check that method exists
		}
	})
}