package security

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/store"
)

// SecureRepositoryWrapper wraps repository operations with organization validation and RLS context
type SecureRepositoryWrapper struct {
	store      store.Store
	dbSecurity *DatabaseSecurityContext
}

// NewSecureRepositoryWrapper creates a new secure repository wrapper
func NewSecureRepositoryWrapper(store store.Store, db *sql.DB) *SecureRepositoryWrapper {
	return &SecureRepositoryWrapper{
		store:      store,
		dbSecurity: NewDatabaseSecurityContext(db),
	}
}

// SecureVolumesRepo provides organization-validated volume operations
type SecureVolumesRepo struct {
	wrapper *SecureRepositoryWrapper
	ctx     context.Context
}

// Volumes returns a secure volumes repository with organization context
func (srw *SecureRepositoryWrapper) Volumes(ctx context.Context) *SecureVolumesRepo {
	return &SecureVolumesRepo{
		wrapper: srw,
		ctx:     ctx,
	}
}

// GetVolume retrieves a volume with organization validation
func (svr *SecureVolumesRepo) GetVolume(volumeID string) (*models.Volume, error) {
	var result *models.Volume
	var err error

	// Execute with secure context
	queryErr := WithSecureQuery(svr.ctx, func(ctx context.Context, tx *sql.Tx) error {
		// Get organization context to validate access
		orgCtx, ok := GetOrganizationContext(ctx)
		if !ok {
			return fmt.Errorf("no organization context available")
		}

		// Use system-level query if system admin, otherwise organization-scoped
		if orgCtx.IsSystemAdmin {
			result, err = svr.wrapper.store.Volumes().GetVolumeByVolumeIDSystemLevel(ctx, volumeID)
		} else if orgCtx.OrganizationID != nil {
			result, err = svr.wrapper.store.Volumes().GetVolumeByVolumeID(ctx, *orgCtx.OrganizationID, volumeID)
		} else {
			return fmt.Errorf("invalid organization context")
		}

		if err != nil {
			// Log potential security violation
			LogSecurityEvent(ctx, "VOLUME_ACCESS_ATTEMPT", map[string]interface{}{
				"volume_id": volumeID,
				"success":   false,
				"error":     err.Error(),
			})
		} else {
			// Validate that returned volume belongs to user's organization (double-check)
			if result != nil && !orgCtx.IsSystemAdmin {
				if result.OrganizationID == nil || *result.OrganizationID != *orgCtx.OrganizationID {
					LogSecurityEvent(ctx, "CROSS_ORGANIZATION_ACCESS_BLOCKED", map[string]interface{}{
						"volume_id":            volumeID,
						"volume_organization":  result.OrganizationID,
						"user_organization":    orgCtx.OrganizationID,
					})
					return fmt.Errorf("access denied: volume belongs to different organization")
				}
			}

			LogSecurityEvent(ctx, "VOLUME_ACCESS_GRANTED", map[string]interface{}{
				"volume_id": volumeID,
				"volume_organization": func() interface{} {
					if result.OrganizationID != nil {
						return *result.OrganizationID
					}
					return nil
				}(),
			})
		}

		return err
	})

	if queryErr != nil {
		return nil, queryErr
	}

	return result, nil
}

// ListVolumes lists volumes with organization filtering
func (svr *SecureVolumesRepo) ListVolumes(limit, offset int32) ([]*models.Volume, error) {
	var result []*models.Volume
	var err error

	queryErr := WithSecureQuery(svr.ctx, func(ctx context.Context, tx *sql.Tx) error {
		orgCtx, ok := GetOrganizationContext(ctx)
		if !ok {
			return fmt.Errorf("no organization context available")
		}

		// Use appropriate query based on context
		if orgCtx.IsSystemAdmin {
			result, err = svr.wrapper.store.Volumes().ListAllVolumes(ctx, limit, offset)
		} else if orgCtx.OrganizationID != nil {
			result, err = svr.wrapper.store.Volumes().ListVolumes(ctx, *orgCtx.OrganizationID, limit, offset)
		} else {
			return fmt.Errorf("invalid organization context")
		}

		// Log the operation
		LogSecurityEvent(ctx, "VOLUMES_LIST_ACCESS", map[string]interface{}{
			"limit":          limit,
			"offset":         offset,
			"results_count":  len(result),
			"is_system_admin": orgCtx.IsSystemAdmin,
		})

		return err
	})

	return result, queryErr
}

// CreateVolume creates a volume with organization assignment
func (svr *SecureVolumesRepo) CreateVolume(params models.CreateVolumeParams) (*models.Volume, error) {
	var result *models.Volume
	var err error

	queryErr := WithSecureQuery(svr.ctx, func(ctx context.Context, tx *sql.Tx) error {
		orgCtx, ok := GetOrganizationContext(ctx)
		if !ok {
			return fmt.Errorf("no organization context available")
		}

		// Determine organization for new volume
		var organizationID int64
		if orgCtx.OrganizationID != nil {
			organizationID = *orgCtx.OrganizationID
		} else if orgCtx.IsSystemAdmin {
			// System admin can create volumes, default to organization 1
			organizationID = 1
		} else {
			return fmt.Errorf("cannot create volume without organization context")
		}

		result, err = svr.wrapper.store.Volumes().CreateVolume(ctx, organizationID, params)

		LogSecurityEvent(ctx, "VOLUME_CREATE_ATTEMPT", map[string]interface{}{
			"volume_id":       params.VolumeID,
			"organization_id": organizationID,
			"success":         err == nil,
		})

		return err
	})

	return result, queryErr
}

// SecureFilesRepo provides organization-validated file operations
type SecureFilesRepo struct {
	wrapper *SecureRepositoryWrapper
	ctx     context.Context
}

// Files returns a secure files repository
func (srw *SecureRepositoryWrapper) Files(ctx context.Context) *SecureFilesRepo {
	return &SecureFilesRepo{
		wrapper: srw,
		ctx:     ctx,
	}
}

// GetFile retrieves a file with organization validation
func (sfr *SecureFilesRepo) GetFile(fileID int64) (*models.File, error) {
	var result *models.File
	var err error

	queryErr := WithSecureQuery(sfr.ctx, func(ctx context.Context, tx *sql.Tx) error {
		orgCtx, ok := GetOrganizationContext(ctx)
		if !ok {
			return fmt.Errorf("no organization context available")
		}

		// Get file using appropriate method based on context
		// Note: Files don't have direct organization_id - they inherit from their volume
		// RLS policies at the database level ensure files are filtered by organization
		if orgCtx.IsSystemAdmin || orgCtx.OrganizationID != nil {
			result, err = sfr.wrapper.store.Files().GetFileByID(ctx, fileID)
		} else {
			return fmt.Errorf("invalid organization context")
		}

		LogSecurityEvent(ctx, "FILE_ACCESS_ATTEMPT", map[string]interface{}{
			"file_id": fileID,
			"success": err == nil,
		})

		return err
	})

	return result, queryErr
}

// ValidationResult represents the result of organization validation
type ValidationResult struct {
	Valid           bool
	Error           error
	OrganizationID  *int64
	IsSystemAdmin   bool
	ViolationType   string
	Details         map[string]interface{}
}

// ValidateOrganizationAccess validates organization access for any operation
func (srw *SecureRepositoryWrapper) ValidateOrganizationAccess(ctx context.Context, targetOrgID int64) ValidationResult {
	orgCtx, ok := GetOrganizationContext(ctx)
	if !ok {
		return ValidationResult{
			Valid:         false,
			Error:         fmt.Errorf("no organization context available"),
			ViolationType: "NO_CONTEXT",
		}
	}

	// System admin can access any organization
	if orgCtx.IsSystemAdmin {
		return ValidationResult{
			Valid:          true,
			OrganizationID: &targetOrgID,
			IsSystemAdmin:  true,
		}
	}

	// Regular user can only access their own organization
	if orgCtx.OrganizationID == nil {
		return ValidationResult{
			Valid:         false,
			Error:         fmt.Errorf("user has no organization assignment"),
			ViolationType: "NO_ORGANIZATION",
		}
	}

	if *orgCtx.OrganizationID != targetOrgID {
		return ValidationResult{
			Valid:         false,
			Error:         fmt.Errorf("cross-organization access denied"),
			ViolationType: "CROSS_ORGANIZATION",
			Details: map[string]interface{}{
				"user_org_id":   *orgCtx.OrganizationID,
				"target_org_id": targetOrgID,
			},
		}
	}

	return ValidationResult{
		Valid:          true,
		OrganizationID: orgCtx.OrganizationID,
		IsSystemAdmin:  false,
	}
}

// SecureQueryBuilder helps build secure queries with organization context
type SecureQueryBuilder struct {
	wrapper *SecureRepositoryWrapper
}

// NewSecureQueryBuilder creates a new secure query builder
func (srw *SecureRepositoryWrapper) NewQueryBuilder() *SecureQueryBuilder {
	return &SecureQueryBuilder{wrapper: srw}
}

// BuildWhereClause builds a WHERE clause with organization filtering
func (sqb *SecureQueryBuilder) BuildWhereClause(ctx context.Context, baseClause string) (string, []interface{}, error) {
	orgCtx, ok := GetOrganizationContext(ctx)
	if !ok {
		return "", nil, fmt.Errorf("no organization context available")
	}

	var clause string
	var params []interface{}

	if orgCtx.IsSystemAdmin {
		// System admin sees all data
		clause = baseClause
	} else if orgCtx.OrganizationID != nil {
		// Add organization filtering
		if baseClause != "" {
			clause = fmt.Sprintf("(%s) AND (organization_id = $%d OR organization_id IS NULL)", 
				baseClause, len(params)+1)
		} else {
			clause = fmt.Sprintf("organization_id = $%d OR organization_id IS NULL", len(params)+1)
		}
		params = append(params, *orgCtx.OrganizationID)
	} else {
		return "", nil, fmt.Errorf("invalid organization context")
	}

	return clause, params, nil
}

// SecurityAuditLog tracks security operations for audit purposes
type SecurityAuditLog struct {
	wrapper *SecureRepositoryWrapper
}

// LogSecurityOperation logs a security operation for audit
func (sal *SecurityAuditLog) LogSecurityOperation(ctx context.Context, operation string, details map[string]interface{}) error {
	// Add operation to audit log
	LogSecurityEvent(ctx, operation, details)
	
	// TODO: Store in audit_logs table with proper RLS context
	return nil
}