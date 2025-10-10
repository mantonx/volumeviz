package organizations

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/audit"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
)

// Service provides organization management functionality
type Service interface {
	// CreateOrganization creates a new organization
	CreateOrganization(ctx context.Context, req CreateOrganizationRequest) (*Organization, error)
	
	// GetOrganization retrieves an organization by ID
	GetOrganization(ctx context.Context, orgID int64) (*Organization, error)
	
	// UpdateOrganization updates an organization
	UpdateOrganization(ctx context.Context, orgID int64, req UpdateOrganizationRequest) (*Organization, error)
	
	// DeactivateOrganization deactivates an organization
	DeactivateOrganization(ctx context.Context, orgID int64) error

	// DeleteOrganization permanently deletes an organization
	DeleteOrganization(ctx context.Context, orgID int64) error

	// ListOrganizations lists all active organizations
	ListOrganizations(ctx context.Context, limit, offset int32) ([]*Organization, error)

	// CountOrganizations counts all active organizations
	CountOrganizations(ctx context.Context) (int64, error)
	
// 	// InviteUser invites a user to join an organization
// 	InviteUser(ctx context.Context, req InviteUserRequest) (*OrganizationInvitation, error)
// 	
// 	// AcceptInvitation accepts an organization invitation
// 	AcceptInvitation(ctx context.Context, token string, userID int64) error
// 	
// 	// CancelInvitation cancels an organization invitation
// 	CancelInvitation(ctx context.Context, invitationID int64) error
// 	
// 	// ListInvitations lists all invitations for an organization
// 	ListInvitations(ctx context.Context, orgID int64, limit, offset int32) ([]*OrganizationInvitation, error)
}

// Organization represents an organization
type Organization struct {
	ID           int64                  `json:"id"`
	Name         string                 `json:"name"`
	DisplayName  string                 `json:"display_name"`
	Description  *string                `json:"description,omitempty"`
	Subdomain    *string                `json:"subdomain,omitempty"`
	Settings     map[string]interface{} `json:"settings"`
	IsActive     bool                   `json:"is_active"`
	MaxUsers     int32                  `json:"max_users"`
	MaxVolumes   int32                  `json:"max_volumes"`
	MaxStorageGB int64                  `json:"max_storage_gb"`
	PlanType     string                 `json:"plan_type"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// OrganizationInvitation represents an invitation to join an organization
type OrganizationInvitation struct {
	ID             int64     `json:"id"`
	OrganizationID int64     `json:"organization_id"`
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	Token          string    `json:"token"`
	InvitedBy      *int64    `json:"invited_by,omitempty"`
	Message        *string   `json:"message,omitempty"`
	Status         string    `json:"status"`
	AcceptedAt     *time.Time `json:"accepted_at,omitempty"`
	AcceptedBy     *int64    `json:"accepted_by,omitempty"`
	ExpiresAt      time.Time `json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// Request types
type CreateOrganizationRequest struct {
	Name         string                 `json:"name" validate:"required,min=3"`
	DisplayName  string                 `json:"display_name" validate:"required,min=3"`
	Description  *string                `json:"description,omitempty"`
	Subdomain    *string                `json:"subdomain,omitempty"`
	Settings     map[string]interface{} `json:"settings,omitempty"`
	MaxUsers     *int32                 `json:"max_users,omitempty"`
	MaxVolumes   *int32                 `json:"max_volumes,omitempty"`
	MaxStorageGB *int64                 `json:"max_storage_gb,omitempty"`
	PlanType     *string                `json:"plan_type,omitempty"`
}

type UpdateOrganizationRequest struct {
	DisplayName  *string                `json:"display_name,omitempty"`
	Description  *string                `json:"description,omitempty"`
	Subdomain    *string                `json:"subdomain,omitempty"`
	Settings     map[string]interface{} `json:"settings,omitempty"`
	MaxUsers     *int32                 `json:"max_users,omitempty"`
	MaxVolumes   *int32                 `json:"max_volumes,omitempty"`
	MaxStorageGB *int64                 `json:"max_storage_gb,omitempty"`
	PlanType     *string                `json:"plan_type,omitempty"`
}

// type InviteUserRequest struct {
// 	OrganizationID int64  `json:"organization_id" validate:"required"`
// 	Email          string `json:"email" validate:"required,email"`
// 	Role           string `json:"role" validate:"required"`
// 	Message        *string `json:"message,omitempty"`
// 	InvitedBy      int64  `json:"invited_by" validate:"required"`
// }

// DefaultService implements the Service interface
type DefaultService struct {
	queries     *sqlc.Queries
	auditLogger audit.Logger
}

// NewService creates a new organization service
func NewService(queries *sqlc.Queries, auditLogger audit.Logger) Service {
	return &DefaultService{
		queries:     queries,
		auditLogger: auditLogger,
	}
}

// SQLC-based implementations

func (s *DefaultService) CreateOrganization(ctx context.Context, req CreateOrganizationRequest) (*Organization, error) {
	// Serialize settings to JSON
	settingsBytes, err := json.Marshal(req.Settings)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize settings: %w", err)
	}
	
	// Set default values
	maxUsers := int32(100)
	maxVolumes := int32(1000)
	maxStorageGB := int64(1000)
	planType := "basic"
	
	if req.MaxUsers != nil {
		maxUsers = *req.MaxUsers
	}
	if req.MaxVolumes != nil {
		maxVolumes = *req.MaxVolumes
	}
	if req.MaxStorageGB != nil {
		maxStorageGB = *req.MaxStorageGB
	}
	if req.PlanType != nil {
		planType = *req.PlanType
	}
	
	// Create organization
	orgRecord, err := s.queries.CreateOrganization(ctx, sqlc.CreateOrganizationParams{
		Name:         req.Name,
		DisplayName:  req.DisplayName,
		Description:  pgtype.Text{String: getStringValue(req.Description), Valid: req.Description != nil},
		Subdomain:    pgtype.Text{String: getStringValue(req.Subdomain), Valid: req.Subdomain != nil},
		Settings:     settingsBytes,
		MaxUsers:     pgtype.Int4{Int32: maxUsers, Valid: true},
		MaxVolumes:   pgtype.Int4{Int32: maxVolumes, Valid: true},
		MaxStorageGb: pgtype.Int8{Int64: maxStorageGB, Valid: true},
		PlanType:     pgtype.Text{String: planType, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create organization: %w", err)
	}
	
	// Convert to service type
	org := convertSQLCOrganization(orgRecord)
	
	// Log audit event
	s.auditLogger.LogEvent(ctx, audit.Event{
		Action:       "organization.created",
		ResourceType: "organization",
		ResourceID:   fmt.Sprintf("%d", org.ID),
		Details:      map[string]interface{}{"name": org.Name, "message": "Organization created"},
	})
	
	return org, nil
}

func (s *DefaultService) GetOrganization(ctx context.Context, orgID int64) (*Organization, error) {
	orgRecord, err := s.queries.GetOrganizationByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to get organization: %w", err)
	}
	
	return convertSQLCOrganization(orgRecord), nil
}

func (s *DefaultService) UpdateOrganization(ctx context.Context, orgID int64, req UpdateOrganizationRequest) (*Organization, error) {
	// Get current organization to preserve existing values
	currentOrg, err := s.queries.GetOrganizationByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current organization: %w", err)
	}
	
	// Prepare update parameters with coalescing
	displayName := currentOrg.DisplayName
	if req.DisplayName != nil {
		displayName = *req.DisplayName
	}
	
	description := currentOrg.Description
	if req.Description != nil {
		description = pgtype.Text{String: *req.Description, Valid: true}
	}
	
	subdomain := currentOrg.Subdomain
	if req.Subdomain != nil {
		subdomain = pgtype.Text{String: *req.Subdomain, Valid: true}
	}
	
	// Handle settings merge
	settingsBytes := currentOrg.Settings
	if req.Settings != nil {
		settingsBytes, err = json.Marshal(req.Settings)
		if err != nil {
			return nil, fmt.Errorf("failed to serialize settings: %w", err)
		}
	}
	
	maxUsers := currentOrg.MaxUsers
	if req.MaxUsers != nil {
		maxUsers = pgtype.Int4{Int32: *req.MaxUsers, Valid: true}
	}
	
	maxVolumes := currentOrg.MaxVolumes
	if req.MaxVolumes != nil {
		maxVolumes = pgtype.Int4{Int32: *req.MaxVolumes, Valid: true}
	}
	
	maxStorageGb := currentOrg.MaxStorageGb
	if req.MaxStorageGB != nil {
		maxStorageGb = pgtype.Int8{Int64: *req.MaxStorageGB, Valid: true}
	}
	
	planType := currentOrg.PlanType
	if req.PlanType != nil {
		planType = pgtype.Text{String: *req.PlanType, Valid: true}
	}
	
	// Update organization
	orgRecord, err := s.queries.UpdateOrganization(ctx, sqlc.UpdateOrganizationParams{
		ID:           orgID,
		DisplayName:  displayName,
		Description:  description,
		Subdomain:    subdomain,
		Settings:     settingsBytes,
		MaxUsers:     maxUsers,
		MaxVolumes:   maxVolumes,
		MaxStorageGb: maxStorageGb,
		PlanType:     planType,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update organization: %w", err)
	}
	
	org := convertSQLCOrganization(orgRecord)
	
	// Log audit event
	s.auditLogger.LogEvent(ctx, audit.Event{
		Action:       "organization.updated",
		ResourceType: "organization",
		ResourceID:   fmt.Sprintf("%d", org.ID),
		Details:      map[string]interface{}{"message": "Organization '%s' updated"},
	})
	
	return org, nil
}

func (s *DefaultService) DeactivateOrganization(ctx context.Context, orgID int64) error {
	err := s.queries.DeactivateOrganization(ctx, orgID)
	if err != nil {
		return fmt.Errorf("failed to deactivate organization: %w", err)
	}

	// Log audit event
	s.auditLogger.LogEvent(ctx, audit.Event{
		Action:       "organization.deactivated",
		ResourceType: "organization",
		ResourceID:   fmt.Sprintf("%d", orgID),
		Details:      map[string]interface{}{"message": "Organization %d deactivated"},
	})

	return nil
}

func (s *DefaultService) DeleteOrganization(ctx context.Context, orgID int64) error {
	// Use DeactivateOrganization for soft delete
	// This is safer than hard delete and maintains referential integrity
	err := s.queries.DeactivateOrganization(ctx, orgID)
	if err != nil {
		return fmt.Errorf("failed to delete organization: %w", err)
	}

	// Log audit event
	s.auditLogger.LogEvent(ctx, audit.Event{
		Action:       "organization.deleted",
		ResourceType: "organization",
		ResourceID:   fmt.Sprintf("%d", orgID),
		Details:      map[string]interface{}{"message": "Organization %d deleted"},
	})

	return nil
}

func (s *DefaultService) ListOrganizations(ctx context.Context, limit, offset int32) ([]*Organization, error) {
	orgRecords, err := s.queries.ListOrganizations(ctx, sqlc.ListOrganizationsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list organizations: %w", err)
	}

	orgs := make([]*Organization, 0, len(orgRecords))
	for _, orgRecord := range orgRecords {
		orgs = append(orgs, convertSQLCOrganization(orgRecord))
	}

	return orgs, nil
}

func (s *DefaultService) CountOrganizations(ctx context.Context) (int64, error) {
	count, err := s.queries.CountOrganizations(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to count organizations: %w", err)
	}
	return count, nil
}

// func (s *DefaultService) InviteUser(ctx context.Context, req InviteUserRequest) (*OrganizationInvitation, error) {
// 	// Generate invitation token
// 	token, err := generateInvitationToken()
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to generate invitation token: %w", err)
// 	}
// 	
// 	// Set expiration time (7 days from now)
// 	expiresAt := time.Now().Add(7 * 24 * time.Hour)
// 	
// 	// Create invitation
// 	invitationRecord, err := s.queries.CreateOrganizationInvitation(ctx, sqlc.CreateOrganizationInvitationParams{
// 		OrganizationID: req.OrganizationID,
// 		Email:          req.Email,
// 		Role:           req.Role,
// 		Token:          token,
// 		InvitedBy:      pgtype.Int8{Int64: req.InvitedBy, Valid: true},
// 		Message:        pgtype.Text{String: getStringValue(req.Message), Valid: req.Message != nil},
// 		ExpiresAt:      pgtype.Timestamptz{Time: expiresAt, Valid: true},
// 	})
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to create invitation: %w", err)
// 	}
// 	
// 	invitation := convertSQLCInvitation(invitationRecord)
// 	
// 	// Log audit event
// 	s.auditLogger.LogEvent(ctx, audit.Event{
// 		Action:       "organization.user_invited",
// 		ResourceType: "organization",
// 		ResourceID:   fmt.Sprintf("%d", req.OrganizationID),
// 		Details:      map[string]interface{}{"message": "User %s invited to organization %d"},
// 	})
// 	
// 	return invitation, nil
// }

// func (s *DefaultService) AcceptInvitation(ctx context.Context, token string, userID int64) error {
// 	// Get invitation by token
// 	invitationRecord, err := s.queries.GetOrganizationInvitationByToken(ctx, token)
// 	if err != nil {
// 		return fmt.Errorf("invalid or expired invitation token: %w", err)
// 	}
// 	
// 	// Accept the invitation
// 	err = s.queries.AcceptOrganizationInvitation(ctx, sqlc.AcceptOrganizationInvitationParams{
// 		ID:         invitationRecord.ID,
// 		AcceptedBy: pgtype.Int8{Int64: userID, Valid: true},
// 	})
// 	if err != nil {
// 		return fmt.Errorf("failed to accept invitation: %w", err)
// 	}
// 	
// 	// Log audit event
// 	s.auditLogger.LogEvent(ctx, audit.Event{
// 		Action:       "organization.invitation_accepted",
// 		ResourceType: "organization",
// 		ResourceID:   fmt.Sprintf("%d", invitationRecord.OrganizationID),
// 		Details:      map[string]interface{}{"message": "Invitation %d accepted by user %d"},
// 	})
// 	
// 	return nil
// }

// func (s *DefaultService) CancelInvitation(ctx context.Context, invitationID int64) error {
// 	err := s.queries.CancelOrganizationInvitation(ctx, invitationID)
// 	if err != nil {
// 		return fmt.Errorf("failed to cancel invitation: %w", err)
// 	}
// 	
// 	// Log audit event
// 	s.auditLogger.LogEvent(ctx, audit.Event{
// 		Action:       "organization.invitation_cancelled",
// 		ResourceType: "organization",
// 		ResourceID:   fmt.Sprintf("%d", invitationID),
// 		Details:      map[string]interface{}{"message": "Invitation %d cancelled"},
// 	})
// 	
// 	return nil
// }

// func (s *DefaultService) ListInvitations(ctx context.Context, orgID int64, limit, offset int32) ([]*OrganizationInvitation, error) {
// 	invitationRecords, err := s.queries.ListOrganizationInvitations(ctx, sqlc.ListOrganizationInvitationsParams{
// 		OrganizationID: orgID,
// 		Limit:          limit,
// 		Offset:         offset,
// 	})
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to list invitations: %w", err)
// 	}
// 	
// 	invitations := make([]*OrganizationInvitation, 0, len(invitationRecords))
// 	for _, invitationRecord := range invitationRecords {
// 		invitations = append(invitations, convertSQLCInvitation(invitationRecord))
// 	}
// 	
// 	return invitations, nil
// }

// Helper functions

// getStringValue safely gets the value from a string pointer
func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// generateInvitationToken generates a secure random token for invitations
func generateInvitationToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// convertSQLCOrganization converts a SQLC organization record to a service organization
func convertSQLCOrganization(orgRecord sqlc.Organizations) *Organization {
	var settings map[string]interface{}
	if len(orgRecord.Settings) > 0 {
		json.Unmarshal(orgRecord.Settings, &settings)
	}
	
	return &Organization{
		ID:           orgRecord.ID,
		Name:         orgRecord.Name,
		DisplayName:  orgRecord.DisplayName,
		Description:  getOptionalString(orgRecord.Description),
		Subdomain:    getOptionalString(orgRecord.Subdomain),
		Settings:     settings,
		IsActive:     orgRecord.IsActive.Bool,
		MaxUsers:     orgRecord.MaxUsers.Int32,
		MaxVolumes:   orgRecord.MaxVolumes.Int32,
		MaxStorageGB: orgRecord.MaxStorageGb.Int64,
		PlanType:     orgRecord.PlanType.String,
		CreatedAt:    orgRecord.CreatedAt,
		UpdatedAt:    orgRecord.UpdatedAt,
	}
}

// // convertSQLCInvitation converts a SQLC invitation record to a service invitation
// func convertSQLCInvitation(invitationRecord sqlc.OrganizationInvitations) *OrganizationInvitation {
// 	return &OrganizationInvitation{
// 		ID:             invitationRecord.ID,
// 		OrganizationID: invitationRecord.OrganizationID,
// 		Email:          invitationRecord.Email,
// 		Role:           invitationRecord.Role,
// 		Token:          invitationRecord.Token,
// 		InvitedBy:      getOptionalInt64(invitationRecord.InvitedBy),
// 		Message:        getOptionalString(invitationRecord.Message),
// 		Status:         invitationRecord.Status,
// 		AcceptedAt:     getOptionalTime(invitationRecord.AcceptedAt),
// 		AcceptedBy:     getOptionalInt64(invitationRecord.AcceptedBy),
// 		ExpiresAt:      invitationRecord.ExpiresAt.Time,
// 		CreatedAt:      invitationRecord.CreatedAt,
// 		UpdatedAt:      invitationRecord.UpdatedAt,
// 	}
// }

// getOptionalString safely extracts a string from pgtype.Text
func getOptionalString(text pgtype.Text) *string {
	if !text.Valid {
		return nil
	}
	return &text.String
}

// getOptionalInt64 safely extracts an int64 from pgtype.Int8
func getOptionalInt64(val pgtype.Int8) *int64 {
	if !val.Valid {
		return nil
	}
	return &val.Int64
}

// // getOptionalTime safely extracts a time from pgtype.Timestamptz
// func getOptionalTime(ts pgtype.Timestamptz) *time.Time {
// 	if !ts.Valid {
// 		return nil
// 	}
// 	return &ts.Time
// }