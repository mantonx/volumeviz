package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"
)

var (
	ErrInvalidCSRFToken = errors.New("invalid CSRF token")
	ErrExpiredCSRFToken = errors.New("expired CSRF token")
)

// CSRFProtection handles CSRF token generation and validation
type CSRFProtection struct {
	secret     []byte
	expiration time.Duration
}

// NewCSRFProtection creates a new CSRF protection handler
func NewCSRFProtection(secret string, expiration time.Duration) *CSRFProtection {
	return &CSRFProtection{
		secret:     []byte(secret),
		expiration: expiration,
	}
}

// GenerateToken generates a new CSRF token for a session
func (c *CSRFProtection) GenerateToken(sessionID string) (string, error) {
	// Generate random bytes
	randomBytes := make([]byte, 32)
	_, err := rand.Read(randomBytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	// Create timestamp
	timestamp := time.Now().Unix()
	
	// Combine session ID, timestamp, and random bytes
	data := fmt.Sprintf("%s:%d:%s", sessionID, timestamp, base64.RawURLEncoding.EncodeToString(randomBytes))
	
	// Create HMAC signature
	h := hmac.New(sha256.New, c.secret)
	h.Write([]byte(data))
	signature := h.Sum(nil)
	
	// Combine data and signature
	token := fmt.Sprintf("%s.%s", 
		base64.RawURLEncoding.EncodeToString([]byte(data)),
		base64.RawURLEncoding.EncodeToString(signature),
	)
	
	return token, nil
}

// ValidateToken validates a CSRF token for a session
func (c *CSRFProtection) ValidateToken(token, sessionID string) error {
	// Split token into data and signature
	parts := splitToken(token, ".")
	if len(parts) != 2 {
		return ErrInvalidCSRFToken
	}
	
	// Decode data
	data, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return ErrInvalidCSRFToken
	}
	
	// Decode signature
	providedSignature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ErrInvalidCSRFToken
	}
	
	// Verify signature
	h := hmac.New(sha256.New, c.secret)
	h.Write(data)
	expectedSignature := h.Sum(nil)
	
	if !hmac.Equal(providedSignature, expectedSignature) {
		return ErrInvalidCSRFToken
	}
	
	// Parse data
	dataStr := string(data)
	dataParts := splitToken(dataStr, ":")
	if len(dataParts) != 3 {
		return ErrInvalidCSRFToken
	}
	
	// Verify session ID
	if dataParts[0] != sessionID {
		return ErrInvalidCSRFToken
	}
	
	// Check expiration
	var timestamp int64
	fmt.Sscanf(dataParts[1], "%d", &timestamp)
	if time.Now().Unix()-timestamp > int64(c.expiration.Seconds()) {
		return ErrExpiredCSRFToken
	}
	
	return nil
}

// splitToken is a helper function to split tokens
func splitToken(token, delimiter string) []string {
	var parts []string
	start := 0
	for i := 0; i < len(token); i++ {
		if string(token[i]) == delimiter {
			parts = append(parts, token[start:i])
			start = i + 1
		}
	}
	if start < len(token) {
		parts = append(parts, token[start:])
	}
	return parts
}

// DoubleSubmitCSRF implements the double-submit cookie pattern
type DoubleSubmitCSRF struct {
	cookieName string
	headerName string
}

// NewDoubleSubmitCSRF creates a new double-submit CSRF handler
func NewDoubleSubmitCSRF(cookieName, headerName string) *DoubleSubmitCSRF {
	return &DoubleSubmitCSRF{
		cookieName: cookieName,
		headerName: headerName,
	}
}

// GenerateToken generates a random CSRF token
func (d *DoubleSubmitCSRF) GenerateToken() (string, error) {
	token := make([]byte, 32)
	_, err := rand.Read(token)
	if err != nil {
		return "", fmt.Errorf("failed to generate CSRF token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(token), nil
}

// Validate compares the cookie and header tokens
func (d *DoubleSubmitCSRF) Validate(cookieToken, headerToken string) bool {
	// Both must be present and equal
	return cookieToken != "" && headerToken != "" && cookieToken == headerToken
}