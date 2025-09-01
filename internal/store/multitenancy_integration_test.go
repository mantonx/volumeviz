package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mantonx/volumeviz/internal/db"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMultiTenancyIntegration tests complete multi-tenant functionality
func TestMultiTenancyIntegration(t *testing.T) {
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

	// Run multi-tenancy integration tests
	t.Run("Organization Data Isolation", testOrganizationDataIsolation(store))
	t.Run("Cross-Organization Access Prevention", testCrossOrganizationAccessPrevention(store))
	t.Run("Organization Management Flow", testOrganizationManagementFlow(store))
	t.Run("User Invitation and Onboarding", testUserInvitationFlow(store))
	t.Run("Organization Quota Enforcement", testOrganizationQuotaEnforcement(store))
}

// testOrganizationDataIsolation ensures data is isolated between organizations
func testOrganizationDataIsolation(store Store) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create two test organizations
		org1, err := store.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name:        "Test Organization 1",
			Description: "First test organization",
			Plan:        "basic",
		})
		require.NoError(t, err)
		require.NotNil(t, org1)

		org2, err := store.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name:        "Test Organization 2", 
			Description: "Second test organization",
			Plan:        "premium",
		})
		require.NoError(t, err)
		require.NotNil(t, org2)

		// Create users for each organization
		user1, err := store.Users().CreateUser(ctx, sqlc.CreateUserParams{
			Email:          "user1@test.com",
			HashedPassword: "hashedpass1",
			FirstName:      "User",
			LastName:       "One",
			OrganizationID: org1.ID,
		})
		require.NoError(t, err)

		user2, err := store.Users().CreateUser(ctx, sqlc.CreateUserParams{
			Email:          "user2@test.com", 
			HashedPassword: "hashedpass2",
			FirstName:      "User",
			LastName:       "Two",
			OrganizationID: org2.ID,
		})
		require.NoError(t, err)

		// Create volumes for each organization
		volume1, err := store.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
			ID:             "org1-volume1",
			Name:           "Organization 1 Volume",
			MountPath:      "/data/org1",
			Driver:         "local",
			OrganizationID: org1.ID,
		})
		require.NoError(t, err)

		volume2, err := store.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
			ID:             "org2-volume1",
			Name:           "Organization 2 Volume", 
			MountPath:      "/data/org2",
			Driver:         "local",
			OrganizationID: org2.ID,
		})
		require.NoError(t, err)

		// Test data isolation - Org1 should only see its volumes
		org1Volumes, err := store.Volumes().ListVolumesForOrganization(ctx, org1.ID, 100, 0)
		require.NoError(t, err)
		assert.Len(t, org1Volumes, 1)
		assert.Equal(t, volume1.ID, org1Volumes[0].ID)

		// Test data isolation - Org2 should only see its volumes
		org2Volumes, err := store.Volumes().ListVolumesForOrganization(ctx, org2.ID, 100, 0)
		require.NoError(t, err)
		assert.Len(t, org2Volumes, 1)
		assert.Equal(t, volume2.ID, org2Volumes[0].ID)

		// Test user isolation - should only see users from their organization
		org1Users, err := store.Users().ListUsersForOrganization(ctx, org1.ID, 100, 0)
		require.NoError(t, err)
		assert.Len(t, org1Users, 1)
		assert.Equal(t, user1.ID, org1Users[0].ID)

		org2Users, err := store.Users().ListUsersForOrganization(ctx, org2.ID, 100, 0)
		require.NoError(t, err)
		assert.Len(t, org2Users, 1)
		assert.Equal(t, user2.ID, org2Users[0].ID)

		// Cleanup
		_ = store.Organizations().DeleteOrganization(ctx, org1.ID)
		_ = store.Organizations().DeleteOrganization(ctx, org2.ID)
	}
}

// testCrossOrganizationAccessPrevention ensures users cannot access other organizations' data
func testCrossOrganizationAccessPrevention(store Store) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create two test organizations
		org1, err := store.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Access Test Org 1",
			Plan: "basic",
		})
		require.NoError(t, err)

		org2, err := store.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Access Test Org 2",
			Plan: "basic", 
		})
		require.NoError(t, err)

		// Create volume in org1
		volume1, err := store.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
			ID:             "cross-access-test-vol",
			Name:           "Cross Access Test Volume",
			MountPath:      "/test/cross-access",
			Driver:         "local",
			OrganizationID: org1.ID,
		})
		require.NoError(t, err)

		// Try to access org1's volume from org2 context - should fail or return nothing
		// This tests the repository-level filtering
		org2Volumes, err := store.Volumes().ListVolumesForOrganization(ctx, org2.ID, 100, 0)
		require.NoError(t, err)
		
		// Should not contain org1's volume
		for _, vol := range org2Volumes {
			assert.NotEqual(t, volume1.ID, vol.ID, "Org2 should not see Org1's volumes")
		}

		// Try to get org1's volume by ID with org2 context - should fail
		_, err = store.Volumes().GetVolumeForOrganization(ctx, volume1.ID, org2.ID)
		assert.Error(t, err, "Cross-organization volume access should be prevented")

		// Cleanup
		_ = store.Organizations().DeleteOrganization(ctx, org1.ID)
		_ = store.Organizations().DeleteOrganization(ctx, org2.ID)
	}
}

// testOrganizationManagementFlow tests complete CRUD operations for organizations
func testOrganizationManagementFlow(store Store) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create organization
		createParams := models.CreateOrganizationParams{
			Name:        "Management Test Org",
			Description: "Testing organization management",
			Plan:        "premium",
		}
		
		org, err := store.Organizations().CreateOrganization(ctx, createParams)
		require.NoError(t, err)
		require.NotNil(t, org)
		assert.Equal(t, createParams.Name, org.Name)
		assert.Equal(t, createParams.Plan, org.Plan)

		// Read organization
		retrievedOrg, err := store.Organizations().GetOrganization(ctx, org.ID)
		require.NoError(t, err)
		assert.Equal(t, org.ID, retrievedOrg.ID)
		assert.Equal(t, org.Name, retrievedOrg.Name)

		// Update organization
		updateParams := models.UpdateOrganizationParams{
			ID:          org.ID,
			Name:        "Updated Management Test Org",
			Description: "Updated description",
			Plan:        "enterprise",
		}
		
		updatedOrg, err := store.Organizations().UpdateOrganization(ctx, updateParams)
		require.NoError(t, err)
		assert.Equal(t, updateParams.Name, updatedOrg.Name)
		assert.Equal(t, updateParams.Plan, updatedOrg.Plan)

		// List organizations
		orgs, err := store.Organizations().ListOrganizations(ctx, 100, 0)
		require.NoError(t, err)
		
		found := false
		for _, o := range orgs {
			if o.ID == org.ID {
				found = true
				break
			}
		}
		assert.True(t, found, "Organization should appear in list")

		// Delete organization
		err = store.Organizations().DeleteOrganization(ctx, org.ID)
		require.NoError(t, err)

		// Verify deletion
		_, err = store.Organizations().GetOrganization(ctx, org.ID)
		assert.Error(t, err, "Deleted organization should not be accessible")
	}
}

// testUserInvitationFlow tests the complete user invitation and onboarding process
func testUserInvitationFlow(store Store) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create test organization
		org, err := store.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Invitation Test Org",
			Plan: "basic",
		})
		require.NoError(t, err)

		// Create inviter user
		inviter, err := store.Users().CreateUser(ctx, sqlc.CreateUserParams{
			Email:          "inviter@test.com",
			HashedPassword: "hashedpass",
			FirstName:      "Inviter",
			LastName:       "User",
			OrganizationID: org.ID,
			Role:           "admin",
		})
		require.NoError(t, err)

		// Create organization invitation
		invitation, err := store.Organizations().CreateInvitation(ctx, models.CreateInvitationParams{
			OrganizationID: org.ID,
			InviterID:      inviter.ID,
			Email:          "invitee@test.com",
			Role:           "member",
		})
		require.NoError(t, err)
		require.NotNil(t, invitation)
		assert.Equal(t, "pending", invitation.Status)

		// Accept invitation (create new user)
		newUser, err := store.Users().CreateUser(ctx, sqlc.CreateUserParams{
			Email:          invitation.Email,
			HashedPassword: "inviteepass",
			FirstName:      "Invitee", 
			LastName:       "User",
			OrganizationID: org.ID,
			Role:           invitation.Role,
		})
		require.NoError(t, err)

		// Update invitation status to accepted
		acceptedInvitation, err := store.Organizations().UpdateInvitationStatus(ctx, models.UpdateInvitationStatusParams{
			ID:     invitation.ID,
			Status: "accepted",
		})
		require.NoError(t, err)
		assert.Equal(t, "accepted", acceptedInvitation.Status)

		// Verify new user is in organization
		orgUsers, err := store.Users().ListUsersForOrganization(ctx, org.ID, 100, 0)
		require.NoError(t, err)
		assert.Len(t, orgUsers, 2) // inviter + invitee

		foundInvitee := false
		for _, user := range orgUsers {
			if user.Email == newUser.Email {
				foundInvitee = true
				assert.Equal(t, org.ID, user.OrganizationID)
				assert.Equal(t, "member", user.Role)
				break
			}
		}
		assert.True(t, foundInvitee, "Invitee should be found in organization")

		// Cleanup
		_ = store.Organizations().DeleteOrganization(ctx, org.ID)
	}
}

// testOrganizationQuotaEnforcement tests organization plan limitations and quota enforcement
func testOrganizationQuotaEnforcement(store Store) func(*testing.T) {
	return func(t *testing.T) {
		ctx := context.Background()

		// Create basic plan organization
		basicOrg, err := store.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Basic Plan Org",
			Plan: "basic",
		})
		require.NoError(t, err)

		// Create premium plan organization  
		premiumOrg, err := store.Organizations().CreateOrganization(ctx, models.CreateOrganizationParams{
			Name: "Premium Plan Org", 
			Plan: "premium",
		})
		require.NoError(t, err)

		// Test volume limits (example: basic = 5 volumes, premium = 50 volumes)
		// Create volumes up to basic limit
		for i := 0; i < 5; i++ {
			_, err := store.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
				ID:             fmt.Sprintf("basic-vol-%d", i),
				Name:           fmt.Sprintf("Basic Volume %d", i),
				MountPath:      fmt.Sprintf("/data/basic/%d", i),
				Driver:         "local",
				OrganizationID: basicOrg.ID,
			})
			require.NoError(t, err)
		}

		// Attempt to create volume beyond basic limit - should succeed for now
		// (Quota enforcement would be implemented in service layer)
		_, err = store.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
			ID:             "basic-vol-over-limit",
			Name:           "Over Limit Volume",
			MountPath:      "/data/basic/over",
			Driver:         "local", 
			OrganizationID: basicOrg.ID,
		})
		// Note: Database layer doesn't enforce quotas - this would be service layer logic
		require.NoError(t, err)

		// Test premium plan can create more volumes
		for i := 0; i < 10; i++ {
			_, err := store.Volumes().CreateVolume(ctx, models.CreateVolumeParams{
				ID:             fmt.Sprintf("premium-vol-%d", i),
				Name:           fmt.Sprintf("Premium Volume %d", i),
				MountPath:      fmt.Sprintf("/data/premium/%d", i),
				Driver:         "local",
				OrganizationID: premiumOrg.ID,
			})
			require.NoError(t, err)
		}

		// Verify organization statistics
		basicStats, err := store.Organizations().GetOrganizationStats(ctx, basicOrg.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(6), basicStats.TotalVolumes) // 5 + 1 over limit

		premiumStats, err := store.Organizations().GetOrganizationStats(ctx, premiumOrg.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(10), premiumStats.TotalVolumes)

		// Test user limits (example: basic = 5 users, premium = 25 users)
		for i := 0; i < 3; i++ {
			_, err := store.Users().CreateUser(ctx, sqlc.CreateUserParams{
				Email:          fmt.Sprintf("basic-user-%d@test.com", i),
				HashedPassword: "hashedpass",
				FirstName:      "Basic",
				LastName:       fmt.Sprintf("User %d", i),
				OrganizationID: basicOrg.ID,
			})
			require.NoError(t, err)
		}

		basicUsers, err := store.Users().ListUsersForOrganization(ctx, basicOrg.ID, 100, 0)
		require.NoError(t, err)
		assert.Len(t, basicUsers, 3)

		// Cleanup
		_ = store.Organizations().DeleteOrganization(ctx, basicOrg.ID)
		_ = store.Organizations().DeleteOrganization(ctx, premiumOrg.ID)
	}
}