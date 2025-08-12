package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/mantonx/volumeviz/internal/store/config"
	"github.com/mantonx/volumeviz/internal/store/sqlite"
	"github.com/mantonx/volumeviz/internal/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSQLiteStore_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Create temporary SQLite database
	dbPath := t.TempDir() + "/test_store.db"
	defer os.Remove(dbPath)

	cfg := &config.Config{
		Type: config.DatabaseTypeSQLite,
		Path: dbPath,
	}

	sqliteStore, err := NewSQLiteStore(cfg)
	require.NoError(t, err)
	defer sqliteStore.Close()

	// Test connectivity
	ctx := context.Background()
	err = sqliteStore.Health(ctx)
	require.NoError(t, err)

	// Create tables manually but with correct schema matching migration files
	// We can't use golang-migrate directly because it closes the database connection
	sqliteStoreImpl := sqliteStore.(*sqlite.SQLiteStore)
	db := sqliteStoreImpl.GetInfrastructureStore().GetDB()
	
	// Create the file_entries table exactly as in migrations/000002_create_file_analytics.up.sql
	createTablesSQL := `
		CREATE TABLE IF NOT EXISTS file_entries (
		    id INTEGER PRIMARY KEY AUTOINCREMENT,
		    volume_id TEXT NOT NULL,
		    parent_dir_id INTEGER,
		    name TEXT NOT NULL,
		    size_bytes INTEGER NOT NULL DEFAULT 0,
		    mtime TEXT NOT NULL,
		    ctime TEXT NOT NULL,
		    inode INTEGER,
		    uid INTEGER,
		    gid INTEGER,
		    type TEXT NOT NULL,
		    hidden INTEGER NOT NULL DEFAULT 0,
		    path_hash BLOB NOT NULL,
		    created_at TEXT DEFAULT (datetime('now')),
		    updated_at TEXT DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS dir_nodes (
		    id INTEGER PRIMARY KEY AUTOINCREMENT,
		    volume_id TEXT NOT NULL,
		    parent_dir_id INTEGER,
		    name TEXT NOT NULL,
		    full_path TEXT NOT NULL,
		    depth INTEGER NOT NULL DEFAULT 0,
		    latest_size_bytes INTEGER NOT NULL DEFAULT 0,
		    latest_file_count INTEGER NOT NULL DEFAULT 0,
		    created_at TEXT DEFAULT (datetime('now')),
		    updated_at TEXT DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS dir_rollups (
		    id INTEGER PRIMARY KEY AUTOINCREMENT,
		    dir_id INTEGER NOT NULL,
		    size_bytes INTEGER NOT NULL DEFAULT 0,
		    file_count INTEGER NOT NULL DEFAULT 0,
		    computed_at TEXT NOT NULL,
		    created_at TEXT DEFAULT (datetime('now'))
		);

		CREATE UNIQUE INDEX IF NOT EXISTS idx_file_entries_volume_path_hash_unique
			ON file_entries(volume_id, path_hash);
		CREATE UNIQUE INDEX IF NOT EXISTS idx_dir_nodes_volume_path 
			ON dir_nodes(volume_id, full_path);
	`;

	_, err = db.ExecContext(ctx, createTablesSQL)
	require.NoError(t, err)

	// Convert to interface for testing
	var store Store = sqliteStore

	// Run integration test suite
	testStoreOperations(t, store)
	testBulkOperations(t, store)
}

func testStoreOperations(t *testing.T, store Store) {
	ctx := context.Background()
	volumeID := fmt.Sprintf("test-volume-%d", time.Now().UnixNano())

	t.Run("Directory Operations", func(t *testing.T) {
		// Create root directory
		rootDir := &DirNode{
			VolumeID:        volumeID,
			Name:            "root",
			FullPath:        "/" + volumeID,
			Depth:           0,
			LatestSizeBytes: 1024,
			LatestFileCount: 5,
		}

		createdRoot, err := store.CreateDirNode(ctx, rootDir)
		require.NoError(t, err)
		require.NotZero(t, createdRoot.ID)
		assert.Equal(t, rootDir.VolumeID, createdRoot.VolumeID)
		assert.Equal(t, rootDir.Name, createdRoot.Name)

		// Create subdirectory
		subDir := &DirNode{
			VolumeID:        volumeID,
			ParentDirID:     &createdRoot.ID,
			Name:            "documents",
			FullPath:        "/" + volumeID + "/documents",
			Depth:           1,
			LatestSizeBytes: 2048,
			LatestFileCount: 10,
		}

		createdSub, err := store.CreateDirNode(ctx, subDir)
		require.NoError(t, err)
		require.NotZero(t, createdSub.ID)

		// Test retrieval
		retrievedRoot, err := store.GetDirNode(ctx, createdRoot.ID, volumeID)
		require.NoError(t, err)
		assert.Equal(t, createdRoot.ID, retrievedRoot.ID)

		// Test by path
		retrievedByPath, err := store.GetDirNodeByPath(ctx, volumeID, "/"+volumeID)
		require.NoError(t, err)
		assert.Equal(t, createdRoot.ID, retrievedByPath.ID)

		// Test child retrieval
		children, err := store.GetChildDirNodes(ctx, volumeID, &createdRoot.ID)
		require.NoError(t, err)
		require.Len(t, children, 1)
		assert.Equal(t, createdSub.ID, children[0].ID)

		// Test root directories
		roots, err := store.GetRootDirNodes(ctx, volumeID)
		require.NoError(t, err)
		require.Len(t, roots, 1)
		assert.Equal(t, createdRoot.ID, roots[0].ID)

		// Test stats update
		err = store.UpdateDirNodeStats(ctx, createdRoot.ID, volumeID, 4096, 20)
		require.NoError(t, err)

		// Verify update
		updated, err := store.GetDirNode(ctx, createdRoot.ID, volumeID)
		require.NoError(t, err)
		assert.Equal(t, int64(4096), updated.LatestSizeBytes)
		assert.Equal(t, int64(20), updated.LatestFileCount)
	})

	t.Run("File Entry Operations", func(t *testing.T) {
		// Create a file entry
		pathHasher := utils.NewPathHasher(0x12345678)
		fullPath := "/" + volumeID + "/test.txt"

		fileEntry := &FileEntry{
			VolumeID:  volumeID,
			Name:      "test.txt",
			SizeBytes: 1024,
			Mtime:     time.Now().Truncate(time.Second), // Truncate for SQLite compatibility
			Ctime:     time.Now().Truncate(time.Second),
			Inode:     storeInt64Ptr(123456),
			UID:       storeInt32Ptr(1000),
			GID:       storeInt32Ptr(1000),
			Type:      "file",
			Hidden:    false,
			PathHash:  pathHasher.HashPath(volumeID, fullPath),
		}

		created, err := store.CreateFileEntry(ctx, fileEntry)
		require.NoError(t, err)
		require.NotZero(t, created.ID)
		assert.Equal(t, fileEntry.VolumeID, created.VolumeID)
		assert.Equal(t, fileEntry.Name, created.Name)

		// Test retrieval
		retrieved, err := store.GetFileEntry(ctx, created.ID, volumeID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Equal(t, fileEntry.SizeBytes, retrieved.SizeBytes)

		// Test path hash search
		byHash, err := store.FindFilesByPathHash(ctx, volumeID, fileEntry.PathHash)
		require.NoError(t, err)
		require.Len(t, byHash, 1)
		assert.Equal(t, created.ID, byHash[0].ID)

		// Test volume stats
		stats, err := store.GetVolumeFileStats(ctx, volumeID)
		require.NoError(t, err)
		assert.Equal(t, int64(1), stats.TotalFiles)
		assert.Equal(t, int64(1024), stats.TotalSize)
	})

	t.Run("Directory Rollup Operations", func(t *testing.T) {
		// Create a rollup
		rollup := &DirRollup{
			DirID:      1, // Assume first directory
			SizeBytes:  8192,
			FileCount:  25,
			ComputedAt: time.Now().Truncate(time.Second),
		}

		created, err := store.CreateDirRollup(ctx, rollup)
		require.NoError(t, err)
		require.NotZero(t, created.ID)
		assert.Equal(t, rollup.SizeBytes, created.SizeBytes)

		// Test retrieval
		retrieved, err := store.GetDirRollup(ctx, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)

		// Test latest rollup
		latest, err := store.GetLatestDirRollup(ctx, rollup.DirID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, latest.ID)

		// Test history
		history, err := store.GetDirRollupHistory(ctx, rollup.DirID, 10)
		require.NoError(t, err)
		require.Len(t, history, 1)
		assert.Equal(t, created.ID, history[0].ID)
	})
}

func testBulkOperations(t *testing.T, store Store) {
	ctx := context.Background()
	volumeID := fmt.Sprintf("bulk-test-%d", time.Now().UnixNano())

	t.Run("Bulk Directory Nodes", func(t *testing.T) {
		// Generate test data
		nodes := make([]*DirNode, 1000)
		for i := 0; i < 1000; i++ {
			nodes[i] = &DirNode{
				VolumeID:        volumeID,
				Name:            fmt.Sprintf("dir_%d", i),
				FullPath:        fmt.Sprintf("/%s/dir_%d", volumeID, i),
				Depth:           int32(i % 5), // Vary depth
				LatestSizeBytes: int64(i * 1024),
				LatestFileCount: int64(i * 10),
			}
		}

		// Bulk insert
		start := time.Now()
		err := store.BulkInsertDirNodes(ctx, nodes, BulkInsertParams{
			BatchSize: 100,
			Timeout:   1 * time.Minute,
		})
		require.NoError(t, err)
		duration := time.Since(start)

		t.Logf("Bulk inserted 1000 directory nodes in %v (%.2f nodes/sec)",
			duration, float64(1000)/duration.Seconds())

		// Verify count
		count, err := store.CountDirNodesByVolume(ctx, volumeID)
		require.NoError(t, err)
		assert.Equal(t, int64(1000), count)

		// Test largest directories
		largest, err := store.GetLargestDirectories(ctx, volumeID, 5)
		require.NoError(t, err)
		require.Len(t, largest, 5)

		// Should be sorted by size descending
		for i := 1; i < len(largest); i++ {
			assert.GreaterOrEqual(t, largest[i-1].LatestSizeBytes, largest[i].LatestSizeBytes)
		}
	})

	t.Run("Bulk File Entries", func(t *testing.T) {
		// Generate test data
		pathHasher := utils.NewPathHasher(0x12345678)
		entries := make([]*FileEntry, 5000)
		now := time.Now().Truncate(time.Second)

		for i := 0; i < 5000; i++ {
			fullPath := fmt.Sprintf("/%s/file_%d.txt", volumeID, i)
			entries[i] = &FileEntry{
				VolumeID:  volumeID,
				Name:      fmt.Sprintf("file_%d.txt", i),
				SizeBytes: int64(i * 100),
				Mtime:     now,
				Ctime:     now,
				Type:      "file",
				Hidden:    i%100 == 0, // 1% hidden
				PathHash:  pathHasher.HashPath(volumeID, fullPath),
			}
		}

		// Bulk insert
		start := time.Now()
		err := store.BulkInsertFileEntries(ctx, entries, BulkInsertParams{
			BatchSize: 500,
			Timeout:   1 * time.Minute,
		})
		require.NoError(t, err)
		duration := time.Since(start)

		t.Logf("Bulk inserted 5000 file entries in %v (%.2f entries/sec)",
			duration, float64(5000)/duration.Seconds())

		// Verify count
		count, err := store.CountFileEntriesByVolume(ctx, volumeID)
		require.NoError(t, err)
		assert.Equal(t, int64(5000), count)

		// Test largest files
		largest, err := store.GetLargestFiles(ctx, volumeID, 10)
		require.NoError(t, err)
		require.Len(t, largest, 10)

		// Should be sorted by size descending
		for i := 1; i < len(largest); i++ {
			assert.GreaterOrEqual(t, largest[i-1].SizeBytes, largest[i].SizeBytes)
		}

		// Test volume stats
		stats, err := store.GetVolumeFileStats(ctx, volumeID)
		require.NoError(t, err)
		assert.Equal(t, int64(5000), stats.TotalFiles)
		assert.Equal(t, int64(50), stats.HiddenFiles) // 1% of 5000
	})

	t.Run("Bulk Rollups", func(t *testing.T) {
		// Generate test rollups
		rollups := make([]*DirRollup, 100)
		now := time.Now().Truncate(time.Second)

		for i := 0; i < 100; i++ {
			rollups[i] = &DirRollup{
				DirID:      int64(i + 1), // Assume directories exist
				SizeBytes:  int64(i * 1024),
				FileCount:  int64(i * 10),
				ComputedAt: now.Add(-time.Duration(i) * time.Hour),
			}
		}

		// Bulk insert
		start := time.Now()
		err := store.BulkInsertDirRollups(ctx, rollups, BulkInsertParams{
			BatchSize: 25,
			Timeout:   1 * time.Minute,
		})
		require.NoError(t, err)
		duration := time.Since(start)

		t.Logf("Bulk inserted 100 rollups in %v", duration)

		// Test rollup stats
		stats, err := store.GetRollupStats(ctx)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, stats.TotalRollups, int64(100))
	})
}

func storeInt64Ptr(v int64) *int64 {
	return &v
}

func storeInt32Ptr(v int32) *int32 {
	return &v
}
