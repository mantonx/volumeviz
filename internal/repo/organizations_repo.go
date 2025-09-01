package repo

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// OrganizationsRepo provides organization management operations
type OrganizationsRepo interface {
	// Organization CRUD operations
	CreateOrganization(ctx context.Context, params sqlc.CreateOrganizationParams) (sqlc.Organizations, error)
	GetOrganizationByID(ctx context.Context, id int64) (sqlc.Organizations, error)
	GetOrganizationByName(ctx context.Context, name string) (sqlc.Organizations, error)
	GetOrganizationBySubdomain(ctx context.Context, subdomain string) (sqlc.Organizations, error)
	UpdateOrganization(ctx context.Context, params sqlc.UpdateOrganizationParams) (sqlc.Organizations, error)
	DeactivateOrganization(ctx context.Context, id int64) error
	ListOrganizations(ctx context.Context, params sqlc.ListOrganizationsParams) ([]sqlc.Organizations, error)

	// Organization invitations
	CreateOrganizationInvitation(ctx context.Context, params sqlc.CreateOrganizationInvitationParams) (sqlc.OrganizationInvitations, error)
	GetOrganizationInvitationByToken(ctx context.Context, token string) (sqlc.OrganizationInvitations, error)
	AcceptOrganizationInvitation(ctx context.Context, params sqlc.AcceptOrganizationInvitationParams) error
	CancelOrganizationInvitation(ctx context.Context, id int64) error
	ListOrganizationInvitations(ctx context.Context, params sqlc.ListOrganizationInvitationsParams) ([]sqlc.OrganizationInvitations, error)

	// Organization statistics
	GetOrganizationUserCount(ctx context.Context, orgID int64) (int64, error)
	GetOrganizationVolumeCount(ctx context.Context, orgID int64) (int64, error)
	GetOrganizationStorageUsage(ctx context.Context, orgID int64) (int64, error)
}

// PostgreSQLOrganizationsRepo implements OrganizationsRepo for PostgreSQL
type PostgreSQLOrganizationsRepo struct {
	queries *sqlc.Queries
	db      sqlc.DBTX
}

// NewPostgreSQLOrganizationsRepo creates a new PostgreSQL organizations repository
func NewPostgreSQLOrganizationsRepo(queries *sqlc.Queries, db sqlc.DBTX) *PostgreSQLOrganizationsRepo {
	return &PostgreSQLOrganizationsRepo{
		queries: queries,
		db:      db,
	}
}

// Organization CRUD operations

func (r *PostgreSQLOrganizationsRepo) CreateOrganization(ctx context.Context, params sqlc.CreateOrganizationParams) (sqlc.Organizations, error) {
	return r.queries.CreateOrganization(ctx, params)
}

func (r *PostgreSQLOrganizationsRepo) GetOrganizationByID(ctx context.Context, id int64) (sqlc.Organizations, error) {
	return r.queries.GetOrganizationByID(ctx, id)
}

func (r *PostgreSQLOrganizationsRepo) GetOrganizationByName(ctx context.Context, name string) (sqlc.Organizations, error) {
	return r.queries.GetOrganizationByName(ctx, name)
}

func (r *PostgreSQLOrganizationsRepo) GetOrganizationBySubdomain(ctx context.Context, subdomain string) (sqlc.Organizations, error) {
	subdomainText := pgtype.Text{String: subdomain, Valid: true}
	return r.queries.GetOrganizationBySubdomain(ctx, subdomainText)
}

func (r *PostgreSQLOrganizationsRepo) UpdateOrganization(ctx context.Context, params sqlc.UpdateOrganizationParams) (sqlc.Organizations, error) {
	return r.queries.UpdateOrganization(ctx, params)
}

func (r *PostgreSQLOrganizationsRepo) DeactivateOrganization(ctx context.Context, id int64) error {
	return r.queries.DeactivateOrganization(ctx, id)
}

func (r *PostgreSQLOrganizationsRepo) ListOrganizations(ctx context.Context, params sqlc.ListOrganizationsParams) ([]sqlc.Organizations, error) {
	return r.queries.ListOrganizations(ctx, params)
}

// Organization invitations

func (r *PostgreSQLOrganizationsRepo) CreateOrganizationInvitation(ctx context.Context, params sqlc.CreateOrganizationInvitationParams) (sqlc.OrganizationInvitations, error) {
	return r.queries.CreateOrganizationInvitation(ctx, params)
}

func (r *PostgreSQLOrganizationsRepo) GetOrganizationInvitationByToken(ctx context.Context, token string) (sqlc.OrganizationInvitations, error) {
	return r.queries.GetOrganizationInvitationByToken(ctx, token)
}

func (r *PostgreSQLOrganizationsRepo) AcceptOrganizationInvitation(ctx context.Context, params sqlc.AcceptOrganizationInvitationParams) error {
	return r.queries.AcceptOrganizationInvitation(ctx, params)
}

func (r *PostgreSQLOrganizationsRepo) CancelOrganizationInvitation(ctx context.Context, id int64) error {
	return r.queries.CancelOrganizationInvitation(ctx, id)
}

func (r *PostgreSQLOrganizationsRepo) ListOrganizationInvitations(ctx context.Context, params sqlc.ListOrganizationInvitationsParams) ([]sqlc.OrganizationInvitations, error) {
	return r.queries.ListOrganizationInvitations(ctx, params)
}

// Organization statistics

func (r *PostgreSQLOrganizationsRepo) GetOrganizationUserCount(ctx context.Context, orgID int64) (int64, error) {
	query := `SELECT COUNT(*) FROM users WHERE organization_id = $1`
	
	var count int64
	row := r.db.QueryRow(ctx, query, orgID)
	err := row.Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get user count: %w", err)
	}
	
	return count, nil
}

func (r *PostgreSQLOrganizationsRepo) GetOrganizationVolumeCount(ctx context.Context, orgID int64) (int64, error) {
	query := `SELECT COUNT(*) FROM volumes WHERE organization_id = $1 AND is_active = true`
	
	var count int64
	row := r.db.QueryRow(ctx, query, orgID)
	err := row.Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get volume count: %w", err)
	}
	
	return count, nil
}

func (r *PostgreSQLOrganizationsRepo) GetOrganizationStorageUsage(ctx context.Context, orgID int64) (int64, error) {
	query := `
		SELECT COALESCE(SUM(total_size_bytes), 0) 
		FROM volumes 
		WHERE organization_id = $1 AND is_active = true
	`
	
	var usage int64
	row := r.db.QueryRow(ctx, query, orgID)
	err := row.Scan(&usage)
	if err != nil {
		return 0, fmt.Errorf("failed to get storage usage: %w", err)
	}
	
	return usage, nil
}

// Helper function to check if organization has reached its limits
func (r *PostgreSQLOrganizationsRepo) CheckOrganizationLimits(ctx context.Context, orgID int64) error {
	org, err := r.GetOrganizationByID(ctx, orgID)
	if err != nil {
		return fmt.Errorf("failed to get organization: %w", err)
	}

	// Check user limit
	if org.MaxUsers.Valid && org.MaxUsers.Int32 > 0 {
		userCount, err := r.GetOrganizationUserCount(ctx, orgID)
		if err != nil {
			return err
		}
		if userCount >= int64(org.MaxUsers.Int32) {
			return fmt.Errorf("organization has reached maximum user limit (%d)", org.MaxUsers.Int32)
		}
	}

	// Check volume limit
	if org.MaxVolumes.Valid && org.MaxVolumes.Int32 > 0 {
		volumeCount, err := r.GetOrganizationVolumeCount(ctx, orgID)
		if err != nil {
			return err
		}
		if volumeCount >= int64(org.MaxVolumes.Int32) {
			return fmt.Errorf("organization has reached maximum volume limit (%d)", org.MaxVolumes.Int32)
		}
	}

	// Check storage limit
	if org.MaxStorageGb.Valid && org.MaxStorageGb.Int64 > 0 {
		storageUsage, err := r.GetOrganizationStorageUsage(ctx, orgID)
		if err != nil {
			return err
		}
		maxStorageBytes := org.MaxStorageGb.Int64 * 1024 * 1024 * 1024
		if storageUsage >= maxStorageBytes {
			return fmt.Errorf("organization has reached maximum storage limit (%d GB)", org.MaxStorageGb.Int64)
		}
	}

	return nil
}


// CreateOrganizationWithDefaults creates an organization with default settings
func (r *PostgreSQLOrganizationsRepo) CreateOrganizationWithDefaults(ctx context.Context, name, displayName string) (sqlc.Organizations, error) {
	params := sqlc.CreateOrganizationParams{
		Name:        name,
		DisplayName: displayName,
		Description: pgtype.Text{String: "", Valid: false},
		Subdomain:   pgtype.Text{String: "", Valid: false},
		Settings:    []byte("{}"),
		MaxUsers:    pgtype.Int4{Int32: 50, Valid: true},
		MaxVolumes:  pgtype.Int4{Int32: 100, Valid: true},
		MaxStorageGb: pgtype.Int8{Int64: 1000, Valid: true},
		PlanType:    pgtype.Text{String: "free", Valid: true},
	}
	
	return r.CreateOrganization(ctx, params)
}