package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidToken     = errors.New("invalid token")
	ErrExpiredToken     = errors.New("token has expired")
	ErrInvalidTokenType = errors.New("invalid token type")
)

// TokenType represents the type of JWT token
type TokenType string

const (
	AccessToken  TokenType = "access"
	RefreshToken TokenType = "refresh"
)

// JWTClaims represents the claims in a JWT token
type JWTClaims struct {
	UserID         string    `json:"user_id"`
	Username       string    `json:"username,omitempty"`
	Email          string    `json:"email,omitempty"`
	Role           string    `json:"role"`
	OrganizationID *int64    `json:"org_id,omitempty"` // Organization ID for multi-tenancy
	TokenType      TokenType `json:"token_type"`
	SessionID      string    `json:"session_id,omitempty"`
	jwt.RegisteredClaims
}

// JWTManager handles JWT operations with support for access and refresh tokens
type JWTManager struct {
	accessSecret      []byte
	refreshSecret     []byte
	accessExpiration  time.Duration
	refreshExpiration time.Duration
	issuer            string
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	AccessSecret      string
	RefreshSecret     string
	AccessExpiration  time.Duration
	RefreshExpiration time.Duration
	Issuer            string
}

// DefaultJWTConfig returns the default JWT configuration
func DefaultJWTConfig() *JWTConfig {
	return &JWTConfig{
		AccessExpiration:  15 * time.Minute,     // Short-lived access token
		RefreshExpiration: 7 * 24 * time.Hour,   // Long-lived refresh token
		Issuer:            "volumeviz",
	}
}

// NewJWTManager creates a new JWT manager
func NewJWTManager(config *JWTConfig) *JWTManager {
	// Use the same secret for both if refresh secret not provided
	refreshSecret := config.RefreshSecret
	if refreshSecret == "" {
		refreshSecret = config.AccessSecret
	}

	return &JWTManager{
		accessSecret:      []byte(config.AccessSecret),
		refreshSecret:     []byte(refreshSecret),
		accessExpiration:  config.AccessExpiration,
		refreshExpiration: config.RefreshExpiration,
		issuer:            config.Issuer,
	}
}

// GenerateAccessToken generates a new access token
func (j *JWTManager) GenerateAccessToken(userID, username, email, role, sessionID string, organizationID *int64) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(j.accessExpiration)

	claims := JWTClaims{
		UserID:         userID,
		Username:       username,
		Email:          email,
		Role:           role,
		OrganizationID: organizationID,
		TokenType:      AccessToken,
		SessionID:      sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    j.issuer,
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ID:        GenerateJTI(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(j.accessSecret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to sign access token: %w", err)
	}

	return tokenString, expiresAt, nil
}

// GenerateRefreshToken generates a new refresh token
func (j *JWTManager) GenerateRefreshToken(userID, sessionID string) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(j.refreshExpiration)

	claims := JWTClaims{
		UserID:    userID,
		TokenType: RefreshToken,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    j.issuer,
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ID:        GenerateJTI(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(j.refreshSecret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return tokenString, expiresAt, nil
}

// ValidateAccessToken validates an access token
func (j *JWTManager) ValidateAccessToken(tokenString string) (*JWTClaims, error) {
	return j.validateToken(tokenString, j.accessSecret, AccessToken)
}

// ValidateRefreshToken validates a refresh token
func (j *JWTManager) ValidateRefreshToken(tokenString string) (*JWTClaims, error) {
	return j.validateToken(tokenString, j.refreshSecret, RefreshToken)
}

// validateToken validates a token with the given secret and type
func (j *JWTManager) validateToken(tokenString string, secret []byte, expectedType TokenType) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	// Check token type
	if claims.TokenType != expectedType {
		return nil, ErrInvalidTokenType
	}

	// Check expiration
	if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
		return nil, ErrExpiredToken
	}

	return claims, nil
}

// RefreshAccessToken creates a new access token from a refresh token
func (j *JWTManager) RefreshAccessToken(refreshToken string, userInfo func(userID string) (username, email, role string, organizationID *int64, err error)) (string, time.Time, error) {
	// Validate refresh token
	claims, err := j.ValidateRefreshToken(refreshToken)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Get updated user information
	username, email, role, organizationID, err := userInfo(claims.UserID)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to get user info: %w", err)
	}

	// Generate new access token with the same session ID
	return j.GenerateAccessToken(claims.UserID, username, email, role, claims.SessionID, organizationID)
}

// GenerateJTI generates a unique JWT ID
func GenerateJTI() string {
	token, _ := GenerateSecureTokenHex(16)
	return token
}

// TokenPair represents an access and refresh token pair
type TokenPair struct {
	AccessToken       string    `json:"access_token"`
	AccessExpiresAt   time.Time `json:"access_expires_at"`
	RefreshToken      string    `json:"refresh_token"`
	RefreshExpiresAt  time.Time `json:"refresh_expires_at"`
	TokenType         string    `json:"token_type"`
}

// GenerateTokenPair generates both access and refresh tokens
func (j *JWTManager) GenerateTokenPair(userID, username, email, role string, organizationID *int64) (*TokenPair, error) {
	// Generate session ID for this token pair
	sessionID, err := GenerateSecureTokenHex(16)
	if err != nil {
		return nil, fmt.Errorf("failed to generate session ID: %w", err)
	}

	// Generate access token
	accessToken, accessExpiry, err := j.GenerateAccessToken(userID, username, email, role, sessionID, organizationID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate refresh token
	refreshToken, refreshExpiry, err := j.GenerateRefreshToken(userID, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:      accessToken,
		AccessExpiresAt:  accessExpiry,
		RefreshToken:     refreshToken,
		RefreshExpiresAt: refreshExpiry,
		TokenType:        "Bearer",
	}, nil
}