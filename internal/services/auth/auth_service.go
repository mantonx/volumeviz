package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/mantonx/volumeviz/internal/db/sqlc"
	"github.com/mantonx/volumeviz/internal/repo"
)

var (
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrUserNotFound       = errors.New("user not found")
	ErrUserAlreadyExists  = errors.New("user already exists")
	ErrUserInactive       = errors.New("user account is inactive")
)

// Service provides authentication and user management functionality
type Service struct {
	usersRepo repo.UsersRepository
	jwtSecret string
}

// NewService creates a new auth service
func NewService(usersRepo repo.UsersRepository, jwtSecret string) *Service {
	return &Service{
		usersRepo: usersRepo,
		jwtSecret: jwtSecret,
	}
}

// RegisterUserParams contains parameters for user registration
type RegisterUserParams struct {
	OrganizationID int64
	Username       string
	Email          string
	Password       string
	Role           string // Default: "user"
}

// LoginParams contains parameters for user login
type LoginParams struct {
	Username       string
	Password       string
	OrganizationID *int64 // Optional: if provided, ensures user belongs to this org
}

// LoginResponse contains the result of a successful login
type LoginResponse struct {
	Token string
	User  *UserInfo
}

// UserInfo contains public user information
type UserInfo struct {
	ID             int64
	OrganizationID int64
	Username       string
	Email          string
	Role           string
	IsActive       bool
	CreatedAt      time.Time
	LastLoginAt    *time.Time
}

// JWTClaims represents the claims in our JWT tokens
type JWTClaims struct {
	UserID         string `json:"user_id"`
	Username       string `json:"username"`
	Role           string `json:"role"`
	OrganizationID int64  `json:"org_id"`
	TokenType      string `json:"token_type"`
	SessionID      string `json:"session_id"`
	jwt.RegisteredClaims
}

// RegisterUser creates a new user account
func (s *Service) RegisterUser(ctx context.Context, params RegisterUserParams) (*UserInfo, error) {
	// Hash the password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(params.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Set default role if not provided
	role := params.Role
	if role == "" {
		role = "user"
	}

	// Create the user
	user, err := s.usersRepo.CreateUser(ctx, sqlc.CreateUserParams{
		OrganizationID: params.OrganizationID,
		Username:       params.Username,
		Email:          params.Email,
		PasswordHash:   string(passwordHash),
		Role:           role,
		IsActive:       true,
	})

	if err != nil {
		// Check if it's a duplicate key error
		if contains(err.Error(), "duplicate") || contains(err.Error(), "unique constraint") {
			return nil, ErrUserAlreadyExists
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return toUserInfo(user), nil
}

// Login authenticates a user and returns a JWT token
func (s *Service) Login(ctx context.Context, params LoginParams) (*LoginResponse, error) {
	// Get user by username
	var user sqlc.Users
	var err error

	if params.OrganizationID != nil {
		user, err = s.usersRepo.GetUserByUsernameAndOrg(ctx, params.Username, *params.OrganizationID)
	} else {
		user, err = s.usersRepo.GetUserByUsername(ctx, params.Username)
	}

	if err != nil {
		return nil, ErrInvalidCredentials
	}

	// Check if user is active
	if !user.IsActive {
		return nil, ErrUserInactive
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(params.Password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	// Update last login time
	_ = s.usersRepo.UpdateUserLastLogin(ctx, user.ID)

	// Generate JWT token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &LoginResponse{
		Token: token,
		User:  toUserInfo(user),
	}, nil
}

// ValidateToken validates a JWT token and returns the user ID
func (s *Service) ValidateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// ChangePassword changes a user's password
func (s *Service) ChangePassword(ctx context.Context, userID int64, oldPassword, newPassword string) error {
	// Get user
	user, err := s.usersRepo.GetUserByID(ctx, userID)
	if err != nil {
		return ErrUserNotFound
	}

	// Verify old password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword))
	if err != nil {
		return ErrInvalidCredentials
	}

	// Hash new password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	err = s.usersRepo.UpdateUserPassword(ctx, userID, string(passwordHash))
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

// GetUserInfo retrieves user information
func (s *Service) GetUserInfo(ctx context.Context, userID int64) (*UserInfo, error) {
	user, err := s.usersRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	return toUserInfo(user), nil
}

// generateToken creates a JWT token for a user
func (s *Service) generateToken(user sqlc.Users) (string, error) {
	now := time.Now()
	expiresAt := now.Add(24 * time.Hour) // Token expires in 24 hours

	claims := JWTClaims{
		UserID:         fmt.Sprintf("%d", user.ID),
		Username:       user.Username,
		Role:           user.Role,
		OrganizationID: user.OrganizationID,
		TokenType:      "access",
		SessionID:      "jwt-gen", // TODO: Implement proper session tracking
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "volumeviz",
			Subject:   fmt.Sprintf("%d", user.ID),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// toUserInfo converts a sqlc.Users to UserInfo
func toUserInfo(user sqlc.Users) *UserInfo {
	var lastLoginAt *time.Time
	if user.LastLoginAt.Valid {
		lastLoginAt = &user.LastLoginAt.Time
	}

	return &UserInfo{
		ID:             user.ID,
		OrganizationID: user.OrganizationID,
		Username:       user.Username,
		Email:          user.Email,
		Role:           user.Role,
		IsActive:       user.IsActive,
		CreatedAt:      user.CreatedAt,
		LastLoginAt:    lastLoginAt,
	}
}

// contains is a helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || containsInMiddle(s, substr)))
}

func containsInMiddle(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
