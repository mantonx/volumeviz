package auth

import (
	"sync"
	"time"
)

// RateLimiter implements a simple in-memory rate limiter
type RateLimiter struct {
	mu       sync.RWMutex
	attempts map[string]*attemptRecord
	max      int
	window   time.Duration
	cleanup  *time.Ticker
}

type attemptRecord struct {
	count      int
	firstAttempt time.Time
	lastAttempt  time.Time
	blocked      bool
	blockedUntil time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxAttempts int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		attempts: make(map[string]*attemptRecord),
		max:      maxAttempts,
		window:   window,
		cleanup:  time.NewTicker(5 * time.Minute),
	}

	// Start cleanup goroutine
	go rl.cleanupRoutine()

	return rl
}

// Check returns true if the key is allowed to proceed
func (rl *RateLimiter) Check(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	
	record, exists := rl.attempts[key]
	if !exists {
		// First attempt
		rl.attempts[key] = &attemptRecord{
			count:        1,
			firstAttempt: now,
			lastAttempt:  now,
		}
		return true
	}

	// Check if blocked
	if record.blocked && now.Before(record.blockedUntil) {
		return false
	}

	// Reset if outside window
	if now.Sub(record.firstAttempt) > rl.window {
		record.count = 1
		record.firstAttempt = now
		record.lastAttempt = now
		record.blocked = false
		return true
	}

	// Increment attempt
	record.count++
	record.lastAttempt = now

	// Check if exceeded
	if record.count > rl.max {
		// Exponential backoff
		blockDuration := time.Duration(record.count-rl.max) * rl.window
		if blockDuration > 1*time.Hour {
			blockDuration = 1 * time.Hour
		}
		record.blocked = true
		record.blockedUntil = now.Add(blockDuration)
		return false
	}

	return true
}

// Reset clears the attempts for a key
func (rl *RateLimiter) Reset(key string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	delete(rl.attempts, key)
}

// GetStatus returns the current status for a key
func (rl *RateLimiter) GetStatus(key string) (attempts int, blocked bool, blockedUntil time.Time) {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	record, exists := rl.attempts[key]
	if !exists {
		return 0, false, time.Time{}
	}

	return record.count, record.blocked, record.blockedUntil
}

// cleanupRoutine removes old entries periodically
func (rl *RateLimiter) cleanupRoutine() {
	for range rl.cleanup.C {
		rl.mu.Lock()
		now := time.Now()
		for key, record := range rl.attempts {
			// Remove entries older than 1 hour with no recent activity
			if now.Sub(record.lastAttempt) > 1*time.Hour {
				delete(rl.attempts, key)
			}
		}
		rl.mu.Unlock()
	}
}

// Stop stops the cleanup routine
func (rl *RateLimiter) Stop() {
	rl.cleanup.Stop()
}

// IPRateLimiter is a specialized rate limiter for IP addresses
type IPRateLimiter struct {
	loginLimiter    *RateLimiter
	registerLimiter *RateLimiter
	resetLimiter    *RateLimiter
}

// NewIPRateLimiter creates a new IP-based rate limiter with different limits for different endpoints
func NewIPRateLimiter() *IPRateLimiter {
	return &IPRateLimiter{
		loginLimiter:    NewRateLimiter(5, 1*time.Minute),    // 5 login attempts per minute
		registerLimiter: NewRateLimiter(3, 10*time.Minute),   // 3 registrations per 10 minutes
		resetLimiter:    NewRateLimiter(3, 10*time.Minute),   // 3 password resets per 10 minutes
	}
}

// CheckLogin checks if login is allowed for this IP
func (irl *IPRateLimiter) CheckLogin(ip string) bool {
	return irl.loginLimiter.Check(ip)
}

// CheckRegister checks if registration is allowed for this IP
func (irl *IPRateLimiter) CheckRegister(ip string) bool {
	return irl.registerLimiter.Check(ip)
}

// CheckReset checks if password reset is allowed for this IP
func (irl *IPRateLimiter) CheckReset(ip string) bool {
	return irl.resetLimiter.Check(ip)
}

// ResetLogin resets the login attempts for an IP (e.g., after successful login)
func (irl *IPRateLimiter) ResetLogin(ip string) {
	irl.loginLimiter.Reset(ip)
}

// Stop stops all rate limiters
func (irl *IPRateLimiter) Stop() {
	irl.loginLimiter.Stop()
	irl.registerLimiter.Stop()
	irl.resetLimiter.Stop()
}