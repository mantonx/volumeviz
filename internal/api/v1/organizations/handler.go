package organizations

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/api/middleware"
	organizationsService "github.com/mantonx/volumeviz/internal/services/organizations"
	"github.com/mantonx/volumeviz/internal/store"
)

// Handler handles organization-related HTTP requests
type Handler struct {
	store           store.Store
	organizationSvc organizationsService.Service
}

// NewHandler creates a new organizations handler
func NewHandler(store store.Store, organizationSvc organizationsService.Service) *Handler {
	return &Handler{
		store:           store,
		organizationSvc: organizationSvc,
	}
}

// OrganizationResponse represents an organization in API responses
type OrganizationResponse struct {
	ID           int64   `json:"id" example:"1"`
	Name         string  `json:"name" example:"acme-corp"`
	DisplayName  string  `json:"display_name" example:"ACME Corporation"`
	Description  *string `json:"description,omitempty" example:"A leading technology company"`
	Subdomain    *string `json:"subdomain,omitempty" example:"acme"`
	IsActive     bool    `json:"is_active" example:"true"`
	MaxUsers     *int32  `json:"max_users,omitempty" example:"50"`
	MaxVolumes   *int32  `json:"max_volumes,omitempty" example:"100"`
	MaxStorageGB *int64  `json:"max_storage_gb,omitempty" example:"1000"`
	PlanType     string  `json:"plan_type" example:"pro"`
	CreatedAt    string  `json:"created_at" example:"2024-01-01T12:00:00Z"`
	UpdatedAt    string  `json:"updated_at" example:"2024-01-01T14:30:00Z"`
}

// OrganizationStatsResponse represents organization usage statistics
type OrganizationStatsResponse struct {
	UserCount    int64 `json:"user_count" example:"25"`
	VolumeCount  int64 `json:"volume_count" example:"75"`
	StorageUsage int64 `json:"storage_usage_bytes" example:"536870912000"`
}

// OrganizationWithStatsResponse combines organization info with stats
type OrganizationWithStatsResponse struct {
	Organization OrganizationResponse      `json:"organization"`
	Stats        OrganizationStatsResponse `json:"stats"`
	Limits       OrganizationLimits        `json:"limits"`
}

// OrganizationLimits represents organization limits and availability
type OrganizationLimits struct {
	MaxUsers      *int32  `json:"max_users,omitempty" example:"50"`
	MaxVolumes    *int32  `json:"max_volumes,omitempty" example:"100"`
	MaxStorageGB  *int64  `json:"max_storage_gb,omitempty" example:"1000"`
	UsersUsed     int64   `json:"users_used" example:"25"`
	VolumesUsed   int64   `json:"volumes_used" example:"75"`
	StorageUsedGB float64 `json:"storage_used_gb" example:"500.5"`
	UsersLeft     *int64  `json:"users_left,omitempty" example:"25"`
	VolumesLeft   *int64  `json:"volumes_left,omitempty" example:"25"`
	StorageLeftGB *float64 `json:"storage_left_gb,omitempty" example:"499.5"`
}

// UpdateOrganizationRequest represents a request to update organization details
type UpdateOrganizationRequest struct {
	DisplayName  string  `json:"display_name" binding:"required,min=3" example:"ACME Corporation"`
	Description  *string `json:"description,omitempty" example:"A leading technology company"`
	Subdomain    *string `json:"subdomain,omitempty" example:"acme"`
	MaxUsers     *int32  `json:"max_users,omitempty" example:"50"`
	MaxVolumes   *int32  `json:"max_volumes,omitempty" example:"100"`
	MaxStorageGB *int64  `json:"max_storage_gb,omitempty" example:"1000"`
	PlanType     *string `json:"plan_type,omitempty" example:"pro" enums:"free,pro,enterprise"`
}

// GetMyOrganization returns the current user's organization details
// @Summary Get current organization
// @Description Get the organization details for the authenticated user
// @Tags organizations
// @Accept json
// @Produce json
// @Success 200 {object} OrganizationWithStatsResponse "Organization details with stats"
// @Failure 401 {object} map[string]interface{} "Unauthorized"
// @Failure 404 {object} map[string]interface{} "Organization not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/organizations/me [get]
func (h *Handler) GetMyOrganization(c *gin.Context) {
	orgID, hasOrg := middleware.GetOrganizationID(c.Request.Context())
	if !hasOrg {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context required"})
		return
	}

	// Get organization details
	org, err := h.store.Organizations().GetOrganizationByID(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	// Get organization statistics
	userCount, err := h.store.Organizations().GetOrganizationUserCount(c.Request.Context(), orgID)
	if err != nil {
		userCount = 0
	}

	volumeCount, err := h.store.Organizations().GetOrganizationVolumeCount(c.Request.Context(), orgID)
	if err != nil {
		volumeCount = 0
	}

	storageUsage, err := h.store.Organizations().GetOrganizationStorageUsage(c.Request.Context(), orgID)
	if err != nil {
		storageUsage = 0
	}

	response := OrganizationWithStatsResponse{
		Organization: h.convertToResponse(org),
		Stats: OrganizationStatsResponse{
			UserCount:    userCount,
			VolumeCount:  volumeCount,
			StorageUsage: storageUsage,
		},
		Limits: h.calculateLimits(org, userCount, volumeCount, storageUsage),
	}

	c.JSON(http.StatusOK, response)
}

// UpdateMyOrganization updates the current user's organization details
// @Summary Update current organization
// @Description Update organization details (admin only)
// @Tags organizations
// @Accept json
// @Produce json
// @Param request body UpdateOrganizationRequest true "Organization update details"
// @Success 200 {object} OrganizationResponse "Updated organization details"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 401 {object} map[string]interface{} "Unauthorized"
// @Failure 403 {object} map[string]interface{} "Forbidden - admin required"
// @Failure 404 {object} map[string]interface{} "Organization not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/organizations/me [put]
func (h *Handler) UpdateMyOrganization(c *gin.Context) {
	orgID, hasOrg := middleware.GetOrganizationID(c.Request.Context())
	if !hasOrg {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organization context required"})
		return
	}

	// Check if user is admin (this would be checked in middleware in a real app)
	userRole := c.GetString("user_role")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var req UpdateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Convert API request to service request
	updateReq := organizationsService.UpdateOrganizationRequest{
		DisplayName:  &req.DisplayName,
		Description:  req.Description,
		Subdomain:    req.Subdomain,
		MaxUsers:     req.MaxUsers,
		MaxVolumes:   req.MaxVolumes,
		MaxStorageGB: req.MaxStorageGB,
		PlanType:     req.PlanType,
	}

	// Update organization using service
	updatedOrg, err := h.organizationSvc.UpdateOrganization(c.Request.Context(), orgID, updateReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update organization", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, h.convertServiceOrgToResponse(*updatedOrg))
}

// convertServiceOrgToResponse converts a service organization to API response format
func (h *Handler) convertServiceOrgToResponse(org organizationsService.Organization) OrganizationResponse {
	response := OrganizationResponse{
		ID:           org.ID,
		Name:         org.Name,
		DisplayName:  org.DisplayName,
		Description:  org.Description,
		Subdomain:    org.Subdomain,
		IsActive:     org.IsActive,
		MaxUsers:     &org.MaxUsers,
		MaxVolumes:   &org.MaxVolumes,
		MaxStorageGB: &org.MaxStorageGB,
		PlanType:     org.PlanType,
		CreatedAt:    org.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    org.UpdatedAt.Format(time.RFC3339),
	}
	
	return response
}

// convertToResponse converts a sqlc organization to API response format
func (h *Handler) convertToResponse(org store.Organization) OrganizationResponse {
	response := OrganizationResponse{
		ID:          org.ID,
		Name:        org.Name,
		DisplayName: org.DisplayName,
		IsActive:    org.IsActive.Bool,
		CreatedAt:   org.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   org.UpdatedAt.Format(time.RFC3339),
	}

	if org.Description.Valid {
		response.Description = &org.Description.String
	}
	if org.Subdomain.Valid {
		response.Subdomain = &org.Subdomain.String
	}
	if org.MaxUsers.Valid {
		response.MaxUsers = &org.MaxUsers.Int32
	}
	if org.MaxVolumes.Valid {
		response.MaxVolumes = &org.MaxVolumes.Int32
	}
	if org.MaxStorageGb.Valid {
		response.MaxStorageGB = &org.MaxStorageGb.Int64
	}
	if org.PlanType.Valid {
		response.PlanType = org.PlanType.String
	} else {
		response.PlanType = "free"
	}

	return response
}

// calculateLimits calculates current usage vs limits
func (h *Handler) calculateLimits(org store.Organization, userCount, volumeCount, storageUsage int64) OrganizationLimits {
	limits := OrganizationLimits{
		UsersUsed:     userCount,
		VolumesUsed:   volumeCount,
		StorageUsedGB: float64(storageUsage) / (1024 * 1024 * 1024),
	}

	if org.MaxUsers.Valid {
		limits.MaxUsers = &org.MaxUsers.Int32
		usersLeft := int64(org.MaxUsers.Int32) - userCount
		limits.UsersLeft = &usersLeft
	}

	if org.MaxVolumes.Valid {
		limits.MaxVolumes = &org.MaxVolumes.Int32
		volumesLeft := int64(org.MaxVolumes.Int32) - volumeCount
		limits.VolumesLeft = &volumesLeft
	}

	if org.MaxStorageGb.Valid {
		limits.MaxStorageGB = &org.MaxStorageGb.Int64
		storageLeftGB := float64(org.MaxStorageGb.Int64) - limits.StorageUsedGB
		limits.StorageLeftGB = &storageLeftGB
	}

	return limits
}