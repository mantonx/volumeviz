package services

import (
	"context"
	"log"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/db"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/lifecycle"
	"github.com/mantonx/volumeviz/internal/services/stats"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMultiTenantServicesIntegration tests organization-aware services
func TestMultiTenantServicesIntegration(t *testing.T) {
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

	if err := pool.Ping(ctx); err != nil {
		t.Skipf("PostgreSQL ping failed at %s: %v", dsn, err)
	}

	// Create database connection
	conn, err := db.ConnectPostgreSQL(ctx, dsn, 10)
	require.NoError(t, err)
	defer conn.Pool.Close()

	// Create store
	testStore := store.NewPostgreSQLStore(conn)

	// Run service integration tests
	t.Run("StatsService Organization Context", testStatsServiceOrganizationContext(testStore))
	t.Run("RetentionService Organization Policies", testRetentionServiceOrganizationPolicies(testStore))
	t.Run("Service Cross-Organization Access Prevention", testServiceCrossOrganizationPrevention(testStore))
}

// testStatsServiceOrganizationContext tests StatsService organization-aware functionality
func testStatsServiceOrganizationContext(testStore store.Store) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create test organizations
		org1, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Stats Test Org 1",
			Plan: "basic",
		})
		require.NoError(t, err)

		org2, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Stats Test Org 2", 
			Plan: "premium",
		})
		require.NoError(t, err)

		// Create volumes for each organization
		vol1, err := testStore.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
			ID:             "stats-vol-org1",
			Name:           "Org1 Stats Volume",
			MountPath:      "/data/org1/stats",
			Driver:         "local",
			OrganizationID: org1.ID,
		})
		require.NoError(t, err)

		vol2, err := testStore.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
			ID:             "stats-vol-org2",
			Name:           "Org2 Stats Volume",
			MountPath:      "/data/org2/stats", 
			Driver:         "local",
			OrganizationID: org2.ID,
		})
		require.NoError(t, err)

		// Create StatsService
		logger := log.New(os.Stdout, "[TEST] ", log.LstdFlags)
		statsService := stats.NewStatsService(
			testStore.Stats(),
			testStore,
			nil, // metrics collector not needed for this test
			logger,
		)

		// Test organization validation - valid organization
		orgStats, err := statsService.GetOrganizationStats(ctx, org1.ID, time.Now().AddDate(0, 0, -30), time.Now())
		require.NoError(t, err)
		require.NotNil(t, orgStats)
		assert.Equal(t, org1.ID, orgStats.OrganizationID)

		// Test organization validation - invalid organization
		_, err = statsService.GetOrganizationStats(ctx, 99999, time.Now().AddDate(0, 0, -30), time.Now())
		assert.Error(t, err, "Should fail for non-existent organization")

		// Test organization-scoped volume access
		topFiles, err := statsService.GetTopOrganizationFiles(ctx, org1.ID, 10)
		require.NoError(t, err)
		
		// Files should only be from org1 volumes
		for _, file := range topFiles {
			// Verify the volume belongs to org1
			vol, err := testStore.Volumes().GetVolumeForOrganization(ctx, file.VolumeID, org1.ID)
			assert.NoError(t, err, "File should only come from org1 volumes")
			assert.Equal(t, org1.ID, vol.OrganizationID)
		}

		// Test growth trends for organization
		growthTrends, err := statsService.GetOrganizationGrowthTrends(ctx, org2.ID, 7)
		require.NoError(t, err)
		require.NotNil(t, growthTrends)

		// Cleanup
		_ = testStore.Organizations().DeleteOrganization(ctx, org1.ID)
		_ = testStore.Organizations().DeleteOrganization(ctx, org2.ID)
	}
}

// testRetentionServiceOrganizationPolicies tests RetentionService organization policy functionality
func testRetentionServiceOrganizationPolicies(testStore store.Store) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create test organization
		org, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Retention Test Org",
			Plan: "enterprise",
		})
		require.NoError(t, err)

		// Create RetentionService with organization-aware config
		retentionConfig := lifecycle.Config{
			Enabled:                   true,
			MetricsTTLDays:           30,
			SizesTTLDays:             7,
			RollupEnabled:            true,
			Interval:                 time.Hour,
			InitialDelay:             0,
			EnforceOrganizationScope: true,
			OrganizationPolicies:     make(map[int64]lifecycle.OrganizationPolicy),
		}

		retentionService := lifecycle.New(testStore, retentionConfig)

		// Test default organization policy
		defaultPolicy := lifecycle.OrganizationPolicy{
			OrganizationID:    org.ID,
			MetricsTTLDays:    90,  // Custom longer retention for enterprise
			SizesTTLDays:      14,  // Custom longer retention
			DailyStatsTTLDays: 365, // Year-long stats retention
			ScanJobsTTLDays:   30,  // Month of scan history
			Enabled:           true,
		}

		// Set custom policy for organization
		retentionService.SetOrganizationPolicy(org.ID, defaultPolicy)

		// Test getting organization retention stats
		retentionStats, err := retentionService.GetOrganizationRetentionStats(ctx, org.ID)
		require.NoError(t, err)
		require.NotNil(t, retentionStats)

		statsMap, ok := retentionStats["policy"].(lifecycle.OrganizationPolicy)
		assert.True(t, ok, "Should return organization policy")
		assert.Equal(t, int64(org.ID), statsMap.OrganizationID)
		assert.Equal(t, 90, statsMap.MetricsTTLDays)
		assert.Equal(t, 14, statsMap.SizesTTLDays)

		// Test removing organization policy
		retentionService.RemoveOrganizationPolicy(org.ID)

		// Verify policy was removed (should fall back to default)
		retentionStats2, err := retentionService.GetOrganizationRetentionStats(ctx, org.ID)
		require.NoError(t, err)
		
		fallbackPolicy, ok := retentionStats2["policy"].(lifecycle.OrganizationPolicy)
		assert.True(t, ok)
		assert.Equal(t, 30, fallbackPolicy.MetricsTTLDays, "Should fall back to global config")

		// Test organization validation - invalid organization
		_, err = retentionService.GetOrganizationRetentionStats(ctx, 99999)
		assert.Error(t, err, "Should fail for non-existent organization")

		// Cleanup
		_ = testStore.Organizations().DeleteOrganization(ctx, org.ID)
	}
}

// testServiceCrossOrganizationPrevention tests that services prevent cross-organization access
func testServiceCrossOrganizationPrevention(testStore store.Store) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create two test organizations
		org1, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Cross Access Test Org 1",
			Plan: "basic",
		})
		require.NoError(t, err)

		org2, err := testStore.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Cross Access Test Org 2",
			Plan: "basic",
		})
		require.NoError(t, err)

		// Create volume in org1
		_, err = testStore.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
			ID:             "cross-test-volume",
			Name:           "Cross Test Volume",
			MountPath:      "/data/cross-test",
			Driver:         "local",
			OrganizationID: org1.ID,
		})
		require.NoError(t, err)

		// Create services
		logger := log.New(os.Stdout, "[TEST] ", log.LstdFlags)
		statsService := stats.NewStatsService(testStore.Stats(), testStore, nil, logger)

		// Test StatsService cross-organization access prevention
		// Try to get org1 stats from org2 context - should fail
		_, err = statsService.GetOrganizationStats(ctx, org2.ID, time.Now().AddDate(0, 0, -7), time.Now())
		require.NoError(t, err) // This should succeed but return empty/minimal stats

		// Try to get stats for org1 when requesting org2 data
		org2Stats, err := statsService.GetOrganizationStats(ctx, org2.ID, time.Now().AddDate(0, 0, -7), time.Now())
		require.NoError(t, err)
		assert.Equal(t, int64(0), org2Stats.TotalVolumes, "Org2 should have no volumes")

		org1Stats, err := statsService.GetOrganizationStats(ctx, org1.ID, time.Now().AddDate(0, 0, -7), time.Now())
		require.NoError(t, err)
		assert.Equal(t, int64(1), org1Stats.TotalVolumes, "Org1 should have 1 volume")

		// Test RetentionService organization validation
		retentionService := lifecycle.New(testStore, lifecycle.Config{
			Enabled:                   true,
			EnforceOrganizationScope: true,
		})

		// Valid organization access
		_, err = retentionService.GetOrganizationRetentionStats(ctx, org1.ID)
		assert.NoError(t, err, "Valid organization should succeed")

		// Invalid organization access
		_, err = retentionService.GetOrganizationRetentionStats(ctx, 99999)
		assert.Error(t, err, "Invalid organization should fail")

		// Cleanup
		_ = testStore.Organizations().DeleteOrganization(ctx, org1.ID)
		_ = testStore.Organizations().DeleteOrganization(ctx, org2.ID)
	}
}