package store

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/db"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestStoreIntegration tests the complete flow from store through repo to database
func TestStoreIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Skip if no PostgreSQL available
	dsn := os.Getenv("POSTGRES_TEST_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/volumeviz_test?sslmode=disable"
	}

	ctx := context.Background()

	// Test database connection
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Skipf("PostgreSQL not available at %s: %v", dsn, err)
	}
	defer pool.Close()

	// Test connectivity
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("PostgreSQL ping failed at %s: %v", dsn, err)
	}

	// Create database connection
	conn, err := db.ConnectPostgreSQL(ctx, dsn, 10)
	require.NoError(t, err)
	defer conn.Pool.Close()

	// Create store
	store := NewPostgreSQLStore(conn)

	// Run integration tests
	t.Run("Volume Operations", func(t *testing.T) {
		testVolumeOperations(t, store)
	})

	t.Run("Transaction Boundaries", func(t *testing.T) {
		testTransactionBoundaries(t, store)
	})
}

func testVolumeOperations(t *testing.T, store Store) {
	ctx := context.Background()

	// Create a volume
	createParams := models.CreateVolumeParams{
		VolumeID:   "test-vol-123",
		Name:       "test-volume",
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/test-volume",
		Labels:     map[string]string{"env": "test", "purpose": "integration-test"},
		Options:    map[string]string{"type": "bind"},
		Scope:      "local",
		Status:     "active",
		IsActive:   true,
	}

	volume, err := store.Volumes().CreateVolume(ctx, createParams)
	require.NoError(t, err)
	require.NotNil(t, volume)
	assert.Equal(t, createParams.VolumeID, volume.VolumeID)
	assert.Equal(t, createParams.Name, volume.Name)
	assert.Equal(t, createParams.IsActive, volume.IsActive)
	assert.NotZero(t, volume.ID)

	// Retrieve by ID
	retrieved, err := store.Volumes().GetVolumeByID(ctx, volume.ID)
	require.NoError(t, err)
	assert.Equal(t, volume.ID, retrieved.ID)
	assert.Equal(t, volume.VolumeID, retrieved.VolumeID)
	assert.Equal(t, volume.Labels["env"], retrieved.Labels["env"])
	assert.Equal(t, volume.Options["type"], retrieved.Options["type"])

	// Retrieve by VolumeID
	byVolumeID, err := store.Volumes().GetVolumeByVolumeID(ctx, volume.VolumeID)
	require.NoError(t, err)
	assert.Equal(t, volume.ID, byVolumeID.ID)

	// List volumes
	volumes, err := store.Volumes().ListVolumes(ctx, 10, 0)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(volumes), 1)

	// Find our volume in the list
	found := false
	for _, v := range volumes {
		if v.ID == volume.ID {
			found = true
			break
		}
	}
	assert.True(t, found, "Created volume should be in list")

	// Count volumes
	count, err := store.Volumes().CountVolumes(ctx)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, count, int64(1))
}

func testTransactionBoundaries(t *testing.T, store Store) {
	ctx := context.Background()

	// Test successful transaction
	var volumeID string
	err := store.WithTx(ctx, func(txStore TxStore) error {
		// Create volume within transaction
		createParams := models.CreateVolumeParams{
			VolumeID:   "tx-test-vol-789",
			Name:       "transaction-test-volume",
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/tx-test",
			Labels:     map[string]string{"test": "transaction"},
			Options:    map[string]string{},
			Scope:      "local",
			Status:     "active",
			IsActive:   true,
		}

		volume, err := txStore.Volumes().CreateVolume(ctx, createParams)
		if err != nil {
			return err
		}
		volumeID = volume.VolumeID

		// Just verify the volume was created within the transaction
		// (No scan operations since they're not implemented yet)
		return nil
	})
	require.NoError(t, err)

	// Verify the volume was created
	volume, err := store.Volumes().GetVolumeByVolumeID(ctx, volumeID)
	require.NoError(t, err)
	assert.Equal(t, volumeID, volume.VolumeID)

	// Test transaction rollback
	err = store.WithTx(ctx, func(txStore TxStore) error {
		// Create volume within transaction
		createParams := models.CreateVolumeParams{
			VolumeID:   "rollback-test-vol-999",
			Name:       "rollback-test-volume",
			Driver:     "local",
			Mountpoint: "/var/lib/docker/volumes/rollback-test",
			Labels:     map[string]string{},
			Options:    map[string]string{},
			Scope:      "local",
			Status:     "active",
			IsActive:   true,
		}

		_, err := txStore.Volumes().CreateVolume(ctx, createParams)
		if err != nil {
			return err
		}

		// Force rollback by returning an error
		return assert.AnError
	})
	require.Error(t, err)

	// Verify the volume was NOT created due to rollback
	_, err = store.Volumes().GetVolumeByVolumeID(ctx, "rollback-test-vol-999")
	assert.Error(t, err, "Volume should not exist after transaction rollback")
}
