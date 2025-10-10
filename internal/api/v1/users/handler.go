package users

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/store"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	store store.Store
}

func NewHandler(store store.Store) *Handler {
	return &Handler{store: store}
}

// UserResponse is the API response for a user
type UserResponse struct {
	ID             int64  `json:"id"`
	Username       string `json:"username"`
	Email          string `json:"email"`
	Role           string `json:"role"`
	OrganizationID int64  `json:"organization_id"`
	IsActive       bool   `json:"is_active"`
	CreatedAt      string `json:"created_at"`
	LastLoginAt    *string `json:"last_login_at,omitempty"`
}

// CreateUserRequest is the request for creating a user
type CreateUserRequest struct {
	Username       string `json:"username" binding:"required,min=3"`
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required,min=8"`
	Role           string `json:"role" binding:"required,oneof=admin operator user viewer"`
	OrganizationID int64  `json:"organization_id" binding:"required"`
}

// UpdateUserRequest is the request for updating a user
type UpdateUserRequest struct {
	Email    *string `json:"email" binding:"omitempty,email"`
	Role     *string `json:"role" binding:"omitempty,oneof=admin operator user viewer"`
	IsActive *bool   `json:"is_active"`
}

// ListUsers handles GET /users
// @Summary List users
// @Description List all users in the organization (admin only)
// @Tags users
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(25)
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /users [get]
func (h *Handler) ListUsers(c *gin.Context) {
	// Get organization ID from context (set by auth middleware)
	orgID, exists := c.Get("organization_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "organization not found in context"})
		return
	}

	// Parse pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "25"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 25
	}

	offset := int32((page - 1) * pageSize)
	limit := int32(pageSize)

	// Get users from repository
	users, err := h.store.Users().ListUsersByOrg(c.Request.Context(), orgID.(int64), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list users", "details": err.Error()})
		return
	}

	// Get total count
	total, err := h.store.Users().CountUsersByOrg(c.Request.Context(), orgID.(int64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count users", "details": err.Error()})
		return
	}

	// Transform to response
	response := make([]UserResponse, len(users))
	for i, user := range users {
		var lastLogin *string
		if user.LastLoginAt.Valid {
			loginStr := user.LastLoginAt.Time.Format("2006-01-02T15:04:05Z")
			lastLogin = &loginStr
		}

		response[i] = UserResponse{
			ID:             user.ID,
			Username:       user.Username,
			Email:          user.Email,
			Role:           user.Role,
			OrganizationID: user.OrganizationID,
			IsActive:       user.IsActive,
			CreatedAt:      user.CreatedAt.Format("2006-01-02T15:04:05Z"),
			LastLoginAt:    lastLogin,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      response,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

// GetUser handles GET /users/:id
// @Summary Get user by ID
// @Description Get a specific user by ID (admin only)
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} UserResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /users/{id} [get]
func (h *Handler) GetUser(c *gin.Context) {
	// Get organization ID from context
	orgID, exists := c.Get("organization_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "organization not found in context"})
		return
	}

	// Parse user ID
	userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	// Get user
	user, err := h.store.Users().GetUserByIDAndOrg(c.Request.Context(), userID, orgID.(int64))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Transform to response
	var lastLogin *string
	if user.LastLoginAt.Valid {
		loginStr := user.LastLoginAt.Time.Format("2006-01-02T15:04:05Z")
		lastLogin = &loginStr
	}

	response := UserResponse{
		ID:             user.ID,
		Username:       user.Username,
		Email:          user.Email,
		Role:           user.Role,
		OrganizationID: user.OrganizationID,
		IsActive:       user.IsActive,
		CreatedAt:      user.CreatedAt.Format("2006-01-02T15:04:05Z"),
		LastLoginAt:    lastLogin,
	}

	c.JSON(http.StatusOK, response)
}

// CreateUser handles POST /users
// @Summary Create a new user
// @Description Create a new user in the organization (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Param user body CreateUserRequest true "User creation request"
// @Success 201 {object} UserResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /users [post]
func (h *Handler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request", "details": err.Error()})
		return
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	// Create user
	user, err := h.store.Users().CreateUser(c.Request.Context(), sqlc.CreateUserParams{
		Username:       req.Username,
		Email:          req.Email,
		PasswordHash:   string(passwordHash),
		Role:           req.Role,
		OrganizationID: req.OrganizationID,
		IsActive:       true,
	})
	if err != nil {
		// Check for duplicate username/email
		if err.Error() == "duplicate key value violates unique constraint" {
			c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user", "details": err.Error()})
		return
	}

	// Transform to response
	response := UserResponse{
		ID:             user.ID,
		Username:       user.Username,
		Email:          user.Email,
		Role:           user.Role,
		OrganizationID: user.OrganizationID,
		IsActive:       user.IsActive,
		CreatedAt:      user.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}

	c.JSON(http.StatusCreated, response)
}

// UpdateUser handles PUT /users/:id
// @Summary Update a user
// @Description Update user details (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Param id path int true "User ID"
// @Param user body UpdateUserRequest true "User update request"
// @Success 200 {object} UserResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /users/{id} [put]
func (h *Handler) UpdateUser(c *gin.Context) {
	// Get organization ID from context
	orgID, exists := c.Get("organization_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "organization not found in context"})
		return
	}

	// Parse user ID
	userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request", "details": err.Error()})
		return
	}

	// Get current user to preserve unchanged fields
	currentUser, err := h.store.Users().GetUserByIDAndOrg(c.Request.Context(), userID, orgID.(int64))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Prepare update params with defaults from current user
	updateParams := sqlc.UpdateUserParams{
		ID:    userID,
		Email: pgtype.Text{String: currentUser.Email, Valid: true},
		Role:  pgtype.Text{String: currentUser.Role, Valid: true},
	}

	if req.Email != nil {
		updateParams.Email = pgtype.Text{String: *req.Email, Valid: true}
	}
	if req.Role != nil {
		updateParams.Role = pgtype.Text{String: *req.Role, Valid: true}
	}

	// Update user
	user, err := h.store.Users().UpdateUser(c.Request.Context(), updateParams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user", "details": err.Error()})
		return
	}

	// Update active status separately if provided
	if req.IsActive != nil {
		if err := h.store.Users().SetUserActive(c.Request.Context(), userID, *req.IsActive); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user status", "details": err.Error()})
			return
		}
		user.IsActive = *req.IsActive
	}

	// Transform to response
	var lastLogin *string
	if user.LastLoginAt.Valid {
		loginStr := user.LastLoginAt.Time.Format("2006-01-02T15:04:05Z")
		lastLogin = &loginStr
	}

	response := UserResponse{
		ID:             user.ID,
		Username:       user.Username,
		Email:          user.Email,
		Role:           user.Role,
		OrganizationID: user.OrganizationID,
		IsActive:       user.IsActive,
		CreatedAt:      user.CreatedAt.Format("2006-01-02T15:04:05Z"),
		LastLoginAt:    lastLogin,
	}

	c.JSON(http.StatusOK, response)
}

// DeleteUser handles DELETE /users/:id
// @Summary Delete a user
// @Description Delete a user (admin only)
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 204
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /users/{id} [delete]
func (h *Handler) DeleteUser(c *gin.Context) {
	// Get organization ID from context
	orgID, exists := c.Get("organization_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "organization not found in context"})
		return
	}

	// Parse user ID
	userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	// Verify user belongs to organization
	_, err = h.store.Users().GetUserByIDAndOrg(c.Request.Context(), userID, orgID.(int64))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Delete user
	if err := h.store.Users().DeleteUser(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user", "details": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
