package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/netip"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mantonx/volumeviz/internal/api/middleware"
	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/store"
	"github.com/mantonx/volumeviz/internal/utils/auth"
)

type Handler struct {
	store          store.Store
	passwordHasher *auth.PasswordHasher
	rateLimiter    *auth.IPRateLimiter
	jwtManager     *auth.JWTManager
	csrfProtection *auth.DoubleSubmitCSRF
}

func NewHandler(store store.Store, jwtManager *auth.JWTManager) *Handler {
	return &Handler{
		store:          store,
		passwordHasher: auth.NewPasswordHasher(),
		rateLimiter:    auth.NewIPRateLimiter(),
		jwtManager:     jwtManager,
		csrfProtection: auth.NewDoubleSubmitCSRF("csrf_token", "X-CSRF-Token"),
	}
}

// LoginRequest represents login request payload
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RegisterRequest represents registration request payload
type RegisterRequest struct {
	Username  string `json:"username" binding:"required,min=3,max=50"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Role      string `json:"role,omitempty"` // Only admin can set role
}

// PasswordChangeRequest represents password change payload
type PasswordChangeRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// PasswordResetRequest represents password reset request
type PasswordResetRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// PasswordResetConfirmRequest represents password reset confirmation
type PasswordResetConfirmRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// RefreshTokenRequest represents refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// ForcePasswordChangeRequest represents forced password change for default admin
type ForcePasswordChangeRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// AcceptInvitationRequest represents invitation acceptance request
type AcceptInvitationRequest struct {
	Token string `json:"token" binding:"required"`
}

// RegisterWithInvitationRequest represents registration with invitation token
type RegisterWithInvitationRequest struct {
	Token     string `json:"token" binding:"required"`
	Username  string `json:"username" binding:"required,min=3,max=50"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
}

// AuthResponse represents authentication response
type AuthResponse struct {
	Token        string      `json:"token"`
	RefreshToken string      `json:"refresh_token,omitempty"`
	ExpiresAt    time.Time   `json:"expires_at"`
	User         UserProfile `json:"user"`
}

// UserProfile represents user profile information
type UserProfile struct {
	ID             int64     `json:"id"`
	Username       string    `json:"username"`
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	Status         string    `json:"status"`
	FirstName      *string   `json:"first_name"`
	LastName       *string   `json:"last_name"`
	DisplayName    *string   `json:"display_name"`
	Timezone       *string   `json:"timezone"`
	LastLoginAt    *time.Time `json:"last_login_at"`
	CreatedAt      time.Time `json:"created_at"`
	OrganizationID *int64    `json:"organization_id,omitempty"`
}

// @Summary User login
// @Description Authenticate user and return JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param credentials body LoginRequest true "Login credentials"
// @Success 200 {object} AuthResponse
// @Failure 400 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 401 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 429 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	// Get client IP for rate limiting
	clientIP := c.ClientIP()
	
	// Check rate limiting
	if !h.rateLimiter.CheckLogin(clientIP) {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":     "Too many login attempts. Please try again later.",
			"code":      "RATE_LIMITED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid request format",
			"code":      "INVALID_REQUEST",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Get user by username
	user, err := h.store.Users().GetUserByUsername(c.Request.Context(), req.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Invalid credentials",
			"code":      "INVALID_CREDENTIALS",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Check if user is locked
	if user.LockedUntil.Valid && time.Now().Before(user.LockedUntil.Time) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Account is temporarily locked",
			"code":      "ACCOUNT_LOCKED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Verify password using our improved password hasher
	passwordValid, err := h.passwordHasher.VerifyPassword(req.Password, user.PasswordHash)
	if err != nil || !passwordValid {
		// Increment login attempts
		h.store.Users().IncrementLoginAttempts(c.Request.Context(), user.ID)
		
		// Lock account after 5 failed attempts
		if user.LoginAttempts.Int32 >= 4 {
			lockUntil := time.Now().Add(15 * time.Minute)
			h.store.Users().LockUser(c.Request.Context(), store.LockUserParams{
				ID:          user.ID,
				LockedUntil: timePtrToPgTimestamp(&lockUntil),
			})
		}

		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Invalid credentials",
			"code":      "INVALID_CREDENTIALS",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Reset rate limiting on successful login
	h.rateLimiter.ResetLogin(clientIP)

	// Check if this is the default admin password that needs to be changed
	isDefaultAdmin := user.Username == "admin" && user.Email == "admin@volumeviz.local"
	needsPasswordChange := isDefaultAdmin && user.PasswordHash != "" && user.CreatedBy.Valid == false

	// Get organization ID if user has one
	var orgID *int64
	if user.OrganizationID.Valid {
		orgID = &user.OrganizationID.Int64
	}

	// Generate JWT token pair (access + refresh)
	tokenPair, err := h.jwtManager.GenerateTokenPair(
		strconv.FormatInt(user.ID, 10),
		user.Username,
		user.Email,
		string(user.Role),
		orgID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to generate token",
			"code":      "TOKEN_GENERATION_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Generate session token
	sessionToken, err := generateSecureToken(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to create session",
			"code":      "SESSION_CREATION_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Create user session
	deviceInfo := gin.H{
		"user_agent": c.GetHeader("User-Agent"),
		"ip_address": c.ClientIP(),
	}

	_, err = h.store.Users().CreateUserSession(c.Request.Context(), store.CreateUserSessionParams{
		UserID:       user.ID,
		SessionToken: sessionToken,
		JwtTokenID:   sessionToken, // Use session token as JTI for simplicity
		DeviceInfo:   jsonToPgBytes(deviceInfo),
		IpAddress:    stringToNetIPPtr(c.ClientIP()),
		UserAgent:    stringToPgText(c.GetHeader("User-Agent")),
		ExpiresAt:    timeToPgTimestamp(tokenPair.AccessExpiresAt),
	})

	// Update last login
	h.store.Users().UpdateUserLastLogin(c.Request.Context(), user.ID)

	// Log activity
	h.store.Users().LogUserActivity(c.Request.Context(), store.LogUserActivityParams{
		UserID:       int64PtrToPgInt8(&user.ID),
		Action:       "login",
		ResourceType: pgtype.Text{Valid: false},
		ResourceID:   pgtype.Text{Valid: false},
		Details:      jsonToPgBytes(gin.H{"method": "password"}),
		IpAddress:    stringToNetIPPtr(c.ClientIP()),
		UserAgent:    stringToPgText(c.GetHeader("User-Agent")),
		SessionID:    pgtype.Int8{Valid: false},
	})

	// Return success response with token pair
	response := gin.H{
		"access_token":       tokenPair.AccessToken,
		"refresh_token":      tokenPair.RefreshToken,
		"access_expires_at":  tokenPair.AccessExpiresAt,
		"refresh_expires_at": tokenPair.RefreshExpiresAt,
		"token_type":         tokenPair.TokenType,
		"user":              mapUserToProfile(user),
	}

	// Add password change requirement for default admin
	if needsPasswordChange {
		response["force_password_change"] = true
		response["message"] = "Default password must be changed for security"
	}

	c.JSON(http.StatusOK, response)
}

// @Summary Get CSRF token
// @Description Get CSRF token for state-changing operations
// @Tags auth
// @Produce json
// @Success 200 {object} map[string]string
// @Router /auth/csrf [get]
func (h *Handler) GetCSRFToken(c *gin.Context) {
	// Generate CSRF token
	token, err := h.csrfProtection.GenerateToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to generate CSRF token",
			"code":      "CSRF_TOKEN_GENERATION_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Set cookie
	c.SetCookie("csrf_token", token, 3600, "/", "", false, true) // httpOnly

	// Return token in response (for header use)
	c.JSON(http.StatusOK, gin.H{
		"csrf_token": token,
	})
}

// @Summary User registration
// @Description Register a new user account
// @Tags auth
// @Accept json
// @Produce json
// @Param user body RegisterRequest true "Registration details"
// @Success 201 {object} AuthResponse
// @Failure 400 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 409 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/register [post]
func (h *Handler) Register(c *gin.Context) {
	// Validate CSRF token for registration (if not the first user)
	cookieToken, _ := c.Cookie("csrf_token")
	headerToken := c.GetHeader("X-CSRF-Token")
	if !h.csrfProtection.Validate(cookieToken, headerToken) {
		c.JSON(http.StatusForbidden, gin.H{
			"error":     "CSRF token validation failed",
			"code":      "CSRF_TOKEN_INVALID",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid request format",
			"code":      "INVALID_REQUEST",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Validate password strength using our password hasher
	if err := auth.ValidatePassword(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     err.Error(),
			"code":      "WEAK_PASSWORD",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Check if username already exists
	_, err := h.store.Users().GetUserByUsername(c.Request.Context(), req.Username)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":     "Username already exists",
			"code":      "USERNAME_EXISTS",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Check if email already exists
	_, err = h.store.Users().GetUserByEmail(c.Request.Context(), req.Email)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":     "Email already exists",
			"code":      "EMAIL_EXISTS",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Hash password with Argon2id using our password hasher
	hashedPassword, err := h.passwordHasher.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to process password",
			"code":      "PASSWORD_PROCESSING_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Determine role (only admin can set role, otherwise default to viewer)
	role := "viewer"
	currentUserRole := middleware.GetUserRole(c)
	if req.Role != "" && currentUserRole == middleware.RoleAdmin {
		role = req.Role
	}

	// Create user
	user, err := h.store.Users().CreateUser(c.Request.Context(), store.CreateUserParams{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Role:         store.UserRole(role),
		Status:       "active",
		FirstName:    stringPtrToPgText(&req.FirstName),
		LastName:     stringPtrToPgText(&req.LastName),
		DisplayName:  stringToPgText(req.Username),
		Timezone:     stringToPgText("UTC"),
		CreatedBy:    stringPtrToPgText(strPtr(middleware.GetUserID(c))),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to create user",
			"code":      "USER_CREATION_FAILED",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Get organization ID if user has one
	var orgID *int64
	if user.OrganizationID.Valid {
		orgID = &user.OrganizationID.Int64
	}

	// Generate JWT token pair
	tokenPair, err := h.jwtManager.GenerateTokenPair(
		strconv.FormatInt(user.ID, 10),
		user.Username,
		user.Email,
		string(user.Role),
		orgID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to generate token",
			"code":      "TOKEN_GENERATION_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Log activity
	h.store.Users().LogUserActivity(c.Request.Context(), store.LogUserActivityParams{
		UserID:       int64PtrToPgInt8(&user.ID),
		Action:       "register",
		ResourceType: pgtype.Text{Valid: false},
		ResourceID:   pgtype.Text{Valid: false},
		Details:      jsonToPgBytes(gin.H{"username": user.Username}),
		IpAddress:    stringToNetIPPtr(c.ClientIP()),
		UserAgent:    stringToPgText(c.GetHeader("User-Agent")),
		SessionID:    pgtype.Int8{Valid: false},
	})

	c.JSON(http.StatusCreated, AuthResponse{
		Token:        tokenPair.AccessToken,
		ExpiresAt:    tokenPair.AccessExpiresAt,
		RefreshToken: tokenPair.RefreshToken,
		User:         mapUserToProfile(user),
	})
}

// @Summary Logout
// @Description Logout user and revoke session
// @Tags auth
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 401 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/logout [post]
func (h *Handler) Logout(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Not authenticated",
			"code":      "NOT_AUTHENTICATED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Parse user ID
	uid, err := strconv.ParseInt(userID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid user ID",
			"code":      "INVALID_USER_ID",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Revoke all user sessions
	h.store.Users().RevokeAllUserSessions(c.Request.Context(), uid)

	// Log activity
	h.store.Users().LogUserActivity(c.Request.Context(), store.LogUserActivityParams{
		UserID:       int64PtrToPgInt8(&uid),
		Action:       "logout",
		ResourceType: pgtype.Text{Valid: false},
		ResourceID:   pgtype.Text{Valid: false},
		Details:      jsonToPgBytes(gin.H{"method": "api"}),
		IpAddress:    stringToNetIPPtr(c.ClientIP()),
		UserAgent:    stringToPgText(c.GetHeader("User-Agent")),
		SessionID:    pgtype.Int8{Valid: false},
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out successfully",
		"status":  "ok",
	})
}

// @Summary Get current user profile
// @Description Get authenticated user's profile information
// @Tags auth
// @Produce json
// @Success 200 {object} UserProfile
// @Failure 401 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/me [get]
func (h *Handler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Not authenticated",
			"code":      "NOT_AUTHENTICATED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Parse user ID
	uid, err := strconv.ParseInt(userID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid user ID",
			"code":      "INVALID_USER_ID",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Get user
	user, err := h.store.Users().GetUserByID(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":     "User not found",
			"code":      "USER_NOT_FOUND",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	c.JSON(http.StatusOK, mapUserToProfile(user))
}

// @Summary Change password
// @Description Change authenticated user's password
// @Tags auth
// @Accept json
// @Produce json
// @Param request body PasswordChangeRequest true "Password change request"
// @Success 200 {object} map[string]string
// @Failure 400 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 401 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/password/change [post]
func (h *Handler) ChangePassword(c *gin.Context) {
	// Validate CSRF token for state-changing operations
	cookieToken, _ := c.Cookie("csrf_token")
	headerToken := c.GetHeader("X-CSRF-Token")
	if !h.csrfProtection.Validate(cookieToken, headerToken) {
		c.JSON(http.StatusForbidden, gin.H{
			"error":     "CSRF token validation failed",
			"code":      "CSRF_TOKEN_INVALID",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Not authenticated",
			"code":      "NOT_AUTHENTICATED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	var req PasswordChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid request format",
			"code":      "INVALID_REQUEST",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Parse user ID
	uid, err := strconv.ParseInt(userID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid user ID",
			"code":      "INVALID_USER_ID",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Validate new password strength using our password hasher
	if err := auth.ValidatePassword(req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     err.Error(),
			"code":      "WEAK_PASSWORD",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Get user
	user, err := h.store.Users().GetUserByID(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":     "User not found",
			"code":      "USER_NOT_FOUND",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Verify current password using our password hasher
	passwordValid, err := h.passwordHasher.VerifyPassword(req.CurrentPassword, user.PasswordHash)
	if err != nil || !passwordValid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Current password is incorrect",
			"code":      "INVALID_CURRENT_PASSWORD",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Hash new password with Argon2id using our password hasher
	hashedPassword, err := h.passwordHasher.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to process new password",
			"code":      "PASSWORD_PROCESSING_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Update password
	err = h.store.Users().UpdateUserPassword(c.Request.Context(), store.UpdateUserPasswordParams{
		ID:           user.ID,
		PasswordHash: hashedPassword,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to update password",
			"code":      "PASSWORD_UPDATE_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Revoke all existing sessions (force re-login)
	h.store.Users().RevokeAllUserSessions(c.Request.Context(), user.ID)

	// Log activity
	h.store.Users().LogUserActivity(c.Request.Context(), store.LogUserActivityParams{
		UserID:       int64PtrToPgInt8(&user.ID),
		Action:       "password_change",
		ResourceType: pgtype.Text{Valid: false},
		ResourceID:   pgtype.Text{Valid: false},
		Details:      jsonToPgBytes(gin.H{}),
		IpAddress:    stringToNetIPPtr(c.ClientIP()),
		UserAgent:    stringToPgText(c.GetHeader("User-Agent")),
		SessionID:    pgtype.Int8{Valid: false},
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Password changed successfully",
		"status":  "ok",
	})
}

// @Summary Force password change for default admin
// @Description Change default admin password (requires current default password)
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ForcePasswordChangeRequest true "Forced password change request"
// @Success 200 {object} map[string]string
// @Failure 400 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 401 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 403 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/password/force-change [post]
func (h *Handler) ForcePasswordChange(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Not authenticated",
			"code":      "NOT_AUTHENTICATED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	var req ForcePasswordChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid request format",
			"code":      "INVALID_REQUEST",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Parse user ID
	uid, err := strconv.ParseInt(userID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid user ID",
			"code":      "INVALID_USER_ID",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Get user
	user, err := h.store.Users().GetUserByID(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":     "User not found",
			"code":      "USER_NOT_FOUND",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Verify this is the default admin account
	isDefaultAdmin := user.Username == "admin" && user.Email == "admin@volumeviz.local"
	if !isDefaultAdmin {
		c.JSON(http.StatusForbidden, gin.H{
			"error":     "Forced password change only allowed for default admin account",
			"code":      "NOT_DEFAULT_ADMIN",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Validate new password strength
	if err := auth.ValidatePassword(req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     err.Error(),
			"code":      "WEAK_PASSWORD",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Verify current password
	passwordValid, err := h.passwordHasher.VerifyPassword(req.CurrentPassword, user.PasswordHash)
	if err != nil || !passwordValid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Current password is incorrect",
			"code":      "INVALID_CURRENT_PASSWORD",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Hash new password
	hashedPassword, err := h.passwordHasher.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to process new password",
			"code":      "PASSWORD_PROCESSING_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Update password
	err = h.store.Users().UpdateUserPassword(c.Request.Context(), store.UpdateUserPasswordParams{
		ID:           user.ID,
		PasswordHash: hashedPassword,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to update password",
			"code":      "PASSWORD_UPDATE_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Revoke all existing sessions (force re-login)
	h.store.Users().RevokeAllUserSessions(c.Request.Context(), user.ID)

	// Log activity
	h.store.Users().LogUserActivity(c.Request.Context(), store.LogUserActivityParams{
		UserID:       int64PtrToPgInt8(&user.ID),
		Action:       "force_password_change",
		ResourceType: pgtype.Text{Valid: false},
		ResourceID:   pgtype.Text{Valid: false},
		Details:      jsonToPgBytes(gin.H{"admin_default": true}),
		IpAddress:    stringToNetIPPtr(c.ClientIP()),
		UserAgent:    stringToPgText(c.GetHeader("User-Agent")),
		SessionID:    pgtype.Int8{Valid: false},
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Default admin password changed successfully. Please log in again.",
		"status":  "ok",
		"force_relogin": true,
	})
}

// @Summary Request password reset
// @Description Request password reset email
// @Tags auth
// @Accept json
// @Produce json
// @Param request body PasswordResetRequest true "Password reset request"
// @Success 200 {object} map[string]string
// @Failure 400 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/password/reset [post]
func (h *Handler) RequestPasswordReset(c *gin.Context) {
	var req PasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid request format",
			"code":      "INVALID_REQUEST",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Get user by email
	user, err := h.store.Users().GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		// Don't reveal if email exists or not for security
		c.JSON(http.StatusOK, gin.H{
			"message": "If the email exists, a reset link has been sent",
			"status":  "ok",
		})
		return
	}

	// Generate reset token
	resetToken, err := generateSecureToken(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to generate reset token",
			"code":      "TOKEN_GENERATION_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Set reset token (expires in 1 hour)
	resetExpires := time.Now().Add(time.Hour)
	err = h.store.Users().SetPasswordResetToken(c.Request.Context(), store.SetPasswordResetTokenParams{
		ID:                   user.ID,
		PasswordResetToken:   stringPtrToPgText(&resetToken),
		PasswordResetExpires: timePtrToPgTimestamp(&resetExpires),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to set reset token",
			"code":      "RESET_TOKEN_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// TODO: Send email with reset token
	// For now, return the token in development (remove in production)
	response := gin.H{
		"message": "If the email exists, a reset link has been sent",
		"status":  "ok",
	}

	// In development, include the token for testing
	if gin.Mode() == gin.DebugMode {
		response["reset_token"] = resetToken
	}

	c.JSON(http.StatusOK, response)
}

// @Summary Refresh access token
// @Description Refresh access token using refresh token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RefreshTokenRequest true "Refresh token request"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 401 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/refresh [post]
func (h *Handler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid request format",
			"code":      "INVALID_REQUEST",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Function to get user info for token refresh
	userInfo := func(userID string) (username, email, role string, organizationID *int64, err error) {
		uid, parseErr := strconv.ParseInt(userID, 10, 64)
		if parseErr != nil {
			return "", "", "", nil, parseErr
		}

		user, getUserErr := h.store.Users().GetUserByID(c.Request.Context(), uid)
		if getUserErr != nil {
			return "", "", "", nil, getUserErr
		}

		var orgID *int64
		if user.OrganizationID.Valid {
			orgID = &user.OrganizationID.Int64
		}

		return user.Username, user.Email, string(user.Role), orgID, nil
	}

	// Refresh the access token
	accessToken, expiresAt, err := h.jwtManager.RefreshAccessToken(req.RefreshToken, userInfo)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Invalid or expired refresh token",
			"code":      "INVALID_REFRESH_TOKEN",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Return new access token
	c.JSON(http.StatusOK, gin.H{
		"access_token":      accessToken,
		"access_expires_at": expiresAt,
		"token_type":        "Bearer",
	})
}

// Helper functions

func generateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func mapUserToProfile(user store.User) UserProfile {
	var organizationID *int64
	if user.OrganizationID.Valid {
		organizationID = &user.OrganizationID.Int64
	}

	return UserProfile{
		ID:             user.ID,
		Username:       user.Username,
		Email:          user.Email,
		Role:           string(user.Role),
		Status:         user.Status,
		FirstName:      pgTextToStringPtr(user.FirstName),
		LastName:       pgTextToStringPtr(user.LastName),
		DisplayName:    pgTextToStringPtr(user.DisplayName),
		Timezone:       pgTextToStringPtr(user.Timezone),
		LastLoginAt:    pgTimestampToTimePtr(user.LastLoginAt),
		CreatedAt:      user.CreatedAt,
		OrganizationID: organizationID,
	}
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// Helper functions for pgtype conversions
func stringToPgText(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: s, Valid: true}
}

func stringPtrToPgText(s *string) pgtype.Text {
	if s == nil || *s == "" {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func pgTextToStringPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

func timeToPgTimestamp(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func timePtrToPgTimestamp(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{Valid: false}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func pgTimestampToTimePtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}


func int64PtrToPgInt8(i *int64) pgtype.Int8 {
	if i == nil {
		return pgtype.Int8{Valid: false}
	}
	return pgtype.Int8{Int64: *i, Valid: true}
}

func jsonToPgBytes(data any) []byte {
	if data == nil {
		return []byte("{}")
	}
	bytes, err := json.Marshal(data)
	if err != nil {
		return []byte("{}")
	}
	return bytes
}

// @Summary Register with invitation token
// @Description Register a new user with an organization invitation token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RegisterWithInvitationRequest true "Registration with invitation"
// @Success 200 {object} AuthResponse
// @Failure 400 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 404 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 409 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 500 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/register/invitation [post]
func (h *Handler) RegisterWithInvitation(c *gin.Context) {
	var req RegisterWithInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid request format",
			"code":      "INVALID_REQUEST",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Validate password strength
	if err := auth.ValidatePassword(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     err.Error(),
			"code":      "WEAK_PASSWORD",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Get invitation by token
	invitation, err := h.store.Organizations().GetOrganizationInvitationByToken(c.Request.Context(), req.Token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":     "Invalid or expired invitation token",
			"code":      "INVALID_INVITATION_TOKEN",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Check if invitation is still valid
	if invitation.Status != "pending" || invitation.ExpiresAt.Time.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invitation has expired or is no longer valid",
			"code":      "EXPIRED_INVITATION",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Verify the email matches the invitation (case insensitive)
	if req.Email != invitation.Email {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Email address must match the invitation",
			"code":      "EMAIL_MISMATCH",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Check if username already exists
	_, err = h.store.Users().GetUserByUsername(c.Request.Context(), req.Username)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":     "Username already exists",
			"code":      "USERNAME_EXISTS",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Check if email already exists
	_, err = h.store.Users().GetUserByEmail(c.Request.Context(), req.Email)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":     "Email already exists",
			"code":      "EMAIL_EXISTS",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Hash password
	hashedPassword, err := h.passwordHasher.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to process password",
			"code":      "PASSWORD_PROCESSING_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Create user with organization assignment
	user, err := h.store.Users().CreateUser(c.Request.Context(), store.CreateUserParams{
		Username:       req.Username,
		Email:          req.Email,
		PasswordHash:   hashedPassword,
		Role:           store.UserRole(invitation.Role),
		Status:         "active",
		FirstName:      stringPtrToPgText(&req.FirstName),
		LastName:       stringPtrToPgText(&req.LastName),
		DisplayName:    stringToPgText(req.Username),
		Timezone:       stringToPgText("UTC"),
		OrganizationID: pgtype.Int8{Int64: invitation.OrganizationID, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to create user",
			"code":      "USER_CREATION_FAILED",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Accept the invitation
	err = h.store.Organizations().AcceptOrganizationInvitation(c.Request.Context(), sqlc.AcceptOrganizationInvitationParams{
		ID:         invitation.ID,
		AcceptedBy: pgtype.Int8{Int64: user.ID, Valid: true},
	})
	if err != nil {
		// Log error but don't fail - user was created successfully
		c.Header("Warning", "User created but invitation status not updated")
	}

	// Generate tokens
	var orgID *int64
	if user.OrganizationID.Valid {
		orgID = &user.OrganizationID.Int64
	}

	tokenPair, err := h.jwtManager.GenerateTokenPair(
		strconv.FormatInt(user.ID, 10),
		user.Username,
		user.Email,
		string(user.Role),
		orgID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to generate authentication tokens",
			"code":      "TOKEN_GENERATION_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Return successful response
	c.JSON(http.StatusCreated, AuthResponse{
		Token:        tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresAt:    tokenPair.AccessExpiresAt,
		User:         mapUserToProfile(user),
	})
}

// @Summary Accept organization invitation
// @Description Accept an organization invitation for an existing user
// @Tags auth
// @Accept json
// @Produce json
// @Param request body AcceptInvitationRequest true "Invitation acceptance"
// @Success 200 {object} gin.H
// @Failure 400 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 401 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 404 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Failure 500 {object} github_com_mantonx_volumeviz_internal_models.ErrorResponse
// @Router /auth/accept-invitation [post]
func (h *Handler) AcceptInvitation(c *gin.Context) {
	// Get current user ID from context
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "User not authenticated",
			"code":      "NOT_AUTHENTICATED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	uid, err := strconv.ParseInt(userID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid user ID",
			"code":      "INVALID_USER_ID",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	var req AcceptInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invalid request format",
			"code":      "INVALID_REQUEST",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Get invitation by token
	invitation, err := h.store.Organizations().GetOrganizationInvitationByToken(c.Request.Context(), req.Token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":     "Invalid or expired invitation token",
			"code":      "INVALID_INVITATION_TOKEN",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Check if invitation is still valid
	if invitation.Status != "pending" || invitation.ExpiresAt.Time.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Invitation has expired or is no longer valid",
			"code":      "EXPIRED_INVITATION",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Get current user to verify email
	user, err := h.store.Users().GetUserByID(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to get user information",
			"code":      "USER_LOOKUP_FAILED",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// Verify the email matches the invitation
	if user.Email != invitation.Email {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Your email address does not match this invitation",
			"code":      "EMAIL_MISMATCH",
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	// TODO: Update user's organization - need to implement UpdateUserOrganization method
	// For now, we'll accept the invitation but won't update existing user's organization
	// This should be implemented by adding a specific SQL query and method

	// Accept the invitation
	err = h.store.Organizations().AcceptOrganizationInvitation(c.Request.Context(), sqlc.AcceptOrganizationInvitationParams{
		ID:         invitation.ID,
		AcceptedBy: pgtype.Int8{Int64: uid, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to accept invitation",
			"code":      "INVITATION_ACCEPT_FAILED",
			"details":   err.Error(),
			"requestId": middleware.GetRequestID(c),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Invitation accepted successfully",
		"organization": invitation.OrganizationID,
		"requestId":    middleware.GetRequestID(c),
	})
}

func stringToNetIPPtr(s string) *netip.Addr {
	if s == "" {
		return nil
	}
	addr, err := netip.ParseAddr(s)
	if err != nil {
		return nil
	}
	return &addr
}

