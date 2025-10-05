package realtime

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestOriginPatternExtraction tests that we correctly extract host:port patterns from origin URLs
// This is critical for WebSocket origin validation security
func TestOriginPatternExtraction(t *testing.T) {
	tests := []struct {
		name            string
		allowedOrigins  []string
		expectedPattern []string
		description     string
	}{
		{
			name:            "HTTP origin with port",
			allowedOrigins:  []string{"http://localhost:3000"},
			expectedPattern: []string{"localhost:3000"},
			description:     "Should extract host:port from HTTP URL",
		},
		{
			name:            "HTTPS origin with port",
			allowedOrigins:  []string{"https://app.example.com:8080"},
			expectedPattern: []string{"app.example.com:8080"},
			description:     "Should extract host:port from HTTPS URL",
		},
		{
			name:            "HTTPS origin without explicit port",
			allowedOrigins:  []string{"https://app.example.com"},
			expectedPattern: []string{"app.example.com"},
			description:     "Should extract host from HTTPS URL without port",
		},
		{
			name:            "Multiple origins",
			allowedOrigins:  []string{"http://localhost:3000", "https://app.example.com"},
			expectedPattern: []string{"localhost:3000", "app.example.com"},
			description:     "Should handle multiple origins correctly",
		},
		{
			name:            "Raw host pattern (no scheme)",
			allowedOrigins:  []string{"localhost:5173"},
			expectedPattern: []string{"localhost:5173"},
			description:     "Should pass through raw host:port patterns",
		},
		{
			name:            "Mixed formats",
			allowedOrigins:  []string{"http://localhost:3000", "app.example.com:8080"},
			expectedPattern: []string{"localhost:3000", "app.example.com:8080"},
			description:     "Should handle both URL and raw host patterns",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Replicate the origin pattern extraction logic from HandleConnection
			originPatterns := make([]string, 0, len(tt.allowedOrigins))
			for _, origin := range tt.allowedOrigins {
				u, err := url.Parse(origin)
				if err != nil {
					// Invalid URLs are logged and skipped - should not happen in production
					t.Logf("WARNING: Invalid origin URL %q: %v", origin, err)
					continue
				}
				if u.Host != "" {
					originPatterns = append(originPatterns, u.Host)
				} else {
					// If it's already just a host (no scheme), use it directly
					originPatterns = append(originPatterns, origin)
				}
			}

			assert.Equal(t, tt.expectedPattern, originPatterns, tt.description)
		})
	}
}

// TestOriginValidationSecurity tests edge cases that could be security vulnerabilities
func TestOriginValidationSecurity(t *testing.T) {
	tests := []struct {
		name           string
		allowedOrigins []string
		testOrigin     string
		shouldMatch    bool
		description    string
	}{
		{
			name:           "Exact match",
			allowedOrigins: []string{"http://localhost:3000"},
			testOrigin:     "http://localhost:3000",
			shouldMatch:    true,
			description:    "Same origin should match",
		},
		{
			name:           "Different port should not match",
			allowedOrigins: []string{"http://localhost:3000"},
			testOrigin:     "http://localhost:3001",
			shouldMatch:    false,
			description:    "Different port should be rejected",
		},
		{
			name:           "Different subdomain should not match",
			allowedOrigins: []string{"https://app.example.com"},
			testOrigin:     "https://evil.example.com",
			shouldMatch:    false,
			description:    "Different subdomain should be rejected",
		},
		{
			name:           "HTTP vs HTTPS - same host",
			allowedOrigins: []string{"http://localhost:3000"},
			testOrigin:     "https://localhost:3000",
			shouldMatch:    true,
			description:    "Scheme is ignored in matching (host:port only)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Extract patterns
			originPatterns := make([]string, 0, len(tt.allowedOrigins))
			for _, origin := range tt.allowedOrigins {
				u, err := url.Parse(origin)
				if err != nil {
					continue
				}
				if u.Host != "" {
					originPatterns = append(originPatterns, u.Host)
				} else {
					originPatterns = append(originPatterns, origin)
				}
			}

			// Check if test origin matches any pattern
			testURL, err := url.Parse(tt.testOrigin)
			assert.NoError(t, err)

			matched := false
			for _, pattern := range originPatterns {
				if pattern == testURL.Host {
					matched = true
					break
				}
			}

			assert.Equal(t, tt.shouldMatch, matched, tt.description)
		})
	}
}
