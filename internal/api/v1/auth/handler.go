package auth

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	authService "github.com/mantonx/volumeviz/internal/services/auth"
	"github.com/mantonx/volumeviz/internal/store"
)

type Handler struct {
	store       store.Store
	authService *authService.Service
}

func NewHandler(store store.Store, authService *authService.Service) *Handler {
	return &Handler{
		store:       store,
		authService: authService,
	}
}

// LoginRequest represents login request payload
type LoginRequest struct {
	Username       string `json:"username" binding:"required"`
	Password       string `json:"password" binding:"required"`
	OrganizationID *int64 `json:"organization_id,omitempty"`
}

// RegisterRequest represents registration request payload
type RegisterRequest struct {
	OrganizationID int64  `json:"organization_id" binding:"required"`
	Username       string `json:"username" binding:"required,min=3,max=50"`
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required,min=8"`
	Role           string `json:"role,omitempty"` // Only admin can set role
}

// PasswordChangeRequest represents password change payload
type PasswordChangeRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// AuthResponse represents authentication response
type AuthResponse struct {
	Token string                 `json:"token"`
	User  *authService.UserInfo  `json:"user"`
}

// Login handles user login
// @Summary Login
// @Description Authenticate user and get JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param login body LoginRequest true "Login credentials"
// @Success 200 {object} AuthResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.authService.Login(c.Request.Context(), authService.LoginParams{
		Username:       req.Username,
		Password:       req.Password,
		OrganizationID: req.OrganizationID,
	})

	if err != nil {
		switch err {
		case authService.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		case authService.ErrUserInactive:
			c.JSON(http.StatusForbidden, gin.H{"error": "User account is inactive"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to login"})
		}
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token: resp.Token,
		User:  resp.User,
	})
}

// Register handles user registration
// @Summary Register
// @Description Register a new user
// @Tags auth
// @Accept json
// @Produce json
// @Param register body RegisterRequest true "Registration details"
// @Success 201 {object} AuthResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/auth/register [post]
func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.authService.RegisterUser(c.Request.Context(), authService.RegisterUserParams{
		OrganizationID: req.OrganizationID,
		Username:       req.Username,
		Email:          req.Email,
		Password:       req.Password,
		Role:           req.Role,
	})

	if err != nil {
		switch err {
		case authService.ErrUserAlreadyExists:
			c.JSON(http.StatusConflict, gin.H{"error": "Username or email already exists"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register user"})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": user})
}

// ChangePassword handles password change for authenticated users
// @Summary Change password
// @Description Change the current user's password. Requires the current password for verification.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body PasswordChangeRequest true "Current and new password"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{} "Not authenticated, or current password is incorrect"
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/auth/change-password [post]
func (h *Handler) ChangePassword(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	userID, err := strconv.ParseInt(userIDStr.(string), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req PasswordChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.authService.ChangePassword(c.Request.Context(), userID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		switch err {
		case authService.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
		case authService.ErrUserNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to change password"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}

// GetCurrentUser returns information about the currently authenticated user
func (h *Handler) GetCurrentUser(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	userID, err := strconv.ParseInt(userIDStr.(string), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.authService.GetUserInfo(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}
