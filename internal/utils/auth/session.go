package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

// SessionManager handles user sessions
type SessionManager struct {
	store         SessionStore
	tokenDuration time.Duration
}

// SessionStore defines the interface for session storage
type SessionStore interface {
	Create(ctx context.Context, session *Session) error
	Get(ctx context.Context, sessionID string) (*Session, error)
	GetByToken(ctx context.Context, token string) (*Session, error)
	Update(ctx context.Context, session *Session) error
	Delete(ctx context.Context, sessionID string) error
	DeleteExpired(ctx context.Context) (int, error)
	DeleteUserSessions(ctx context.Context, userID string) error
}

// Session represents a user session
type Session struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	DeviceInfo   DeviceInfo `json:"device_info"`
	CreatedAt    time.Time `json:"created_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	LastUsedAt   time.Time `json:"last_used_at"`
	IsActive     bool      `json:"is_active"`
}

// DeviceInfo contains device-specific information
type DeviceInfo struct {
	Browser      string `json:"browser,omitempty"`
	OS           string `json:"os,omitempty"`
	Device       string `json:"device,omitempty"`
	IsMobile     bool   `json:"is_mobile"`
	IsTablet     bool   `json:"is_tablet"`
	IsDesktop    bool   `json:"is_desktop"`
	Location     string `json:"location,omitempty"`
}

// NewSessionManager creates a new session manager
func NewSessionManager(store SessionStore, tokenDuration time.Duration) *SessionManager {
	return &SessionManager{
		store:         store,
		tokenDuration: tokenDuration,
	}
}

// CreateSession creates a new session for a user
func (sm *SessionManager) CreateSession(ctx context.Context, userID string, c *gin.Context) (*Session, error) {
	// Generate session ID
	sessionID, err := GenerateSecureTokenHex(16)
	if err != nil {
		return nil, fmt.Errorf("failed to generate session ID: %w", err)
	}

	// Generate session token
	sessionToken, err := GenerateSecureToken(32)
	if err != nil {
		return nil, fmt.Errorf("failed to generate session token: %w", err)
	}

	// Create session
	session := &Session{
		ID:        sessionID,
		UserID:    userID,
		Token:     sessionToken,
		IPAddress: GetClientIP(c),
		UserAgent: c.GetHeader("User-Agent"),
		DeviceInfo: ParseUserAgent(c.GetHeader("User-Agent")),
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(sm.tokenDuration),
		LastUsedAt: time.Now(),
		IsActive:  true,
	}

	// Store session
	if err := sm.store.Create(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	return session, nil
}

// ValidateSession validates and updates a session
func (sm *SessionManager) ValidateSession(ctx context.Context, sessionToken string) (*Session, error) {
	// Get session by token
	session, err := sm.store.GetByToken(ctx, sessionToken)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	// Check if session is active
	if !session.IsActive {
		return nil, fmt.Errorf("session is inactive")
	}

	// Check if session has expired
	if time.Now().After(session.ExpiresAt) {
		session.IsActive = false
		sm.store.Update(ctx, session)
		return nil, fmt.Errorf("session has expired")
	}

	// Update last used time
	session.LastUsedAt = time.Now()
	if err := sm.store.Update(ctx, session); err != nil {
		// Log error but don't fail the validation
		fmt.Printf("failed to update session last used time: %v\n", err)
	}

	return session, nil
}

// RevokeSession revokes a session
func (sm *SessionManager) RevokeSession(ctx context.Context, sessionID string) error {
	session, err := sm.store.Get(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("session not found: %w", err)
	}

	session.IsActive = false
	return sm.store.Update(ctx, session)
}

// RevokeUserSessions revokes all sessions for a user
func (sm *SessionManager) RevokeUserSessions(ctx context.Context, userID string) error {
	return sm.store.DeleteUserSessions(ctx, userID)
}

// CleanupExpiredSessions removes expired sessions from storage
func (sm *SessionManager) CleanupExpiredSessions(ctx context.Context) (int, error) {
	return sm.store.DeleteExpired(ctx)
}

// GetClientIP extracts the real client IP from the request
func GetClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header
	if ip := c.GetHeader("X-Forwarded-For"); ip != "" {
		// Take the first IP if there are multiple
		if idx := stringIndex(ip, ","); idx != -1 {
			return ip[:idx]
		}
		return ip
	}

	// Check X-Real-IP header
	if ip := c.GetHeader("X-Real-IP"); ip != "" {
		return ip
	}

	// Fall back to RemoteAddr
	return c.ClientIP()
}

// ParseUserAgent extracts device information from User-Agent string
func ParseUserAgent(userAgent string) DeviceInfo {
	info := DeviceInfo{}

	// Simple parsing - in production, use a proper User-Agent parser library
	// like github.com/mssola/user_agent
	
	// Check for mobile devices
	if contains(userAgent, "Mobile") || contains(userAgent, "Android") || contains(userAgent, "iPhone") {
		info.IsMobile = true
	} else if contains(userAgent, "iPad") || contains(userAgent, "Tablet") {
		info.IsTablet = true
	} else {
		info.IsDesktop = true
	}

	// Detect browser
	switch {
	case contains(userAgent, "Chrome"):
		info.Browser = "Chrome"
	case contains(userAgent, "Firefox"):
		info.Browser = "Firefox"
	case contains(userAgent, "Safari"):
		info.Browser = "Safari"
	case contains(userAgent, "Edge"):
		info.Browser = "Edge"
	default:
		info.Browser = "Unknown"
	}

	// Detect OS
	switch {
	case contains(userAgent, "Windows"):
		info.OS = "Windows"
	case contains(userAgent, "Mac OS"):
		info.OS = "macOS"
	case contains(userAgent, "Linux"):
		info.OS = "Linux"
	case contains(userAgent, "Android"):
		info.OS = "Android"
	case contains(userAgent, "iOS") || contains(userAgent, "iPhone"):
		info.OS = "iOS"
	default:
		info.OS = "Unknown"
	}

	return info
}

// Helper functions
func contains(s, substr string) bool {
	return stringIndex(s, substr) != -1
}

func stringIndex(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}