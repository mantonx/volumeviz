package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/crypto/argon2"
)

// Argon2id configuration parameters (OWASP recommended)
const (
	// OWASP recommends at least 2 iterations, we use 3 for better security
	DefaultArgon2Time    = uint32(3)
	DefaultArgon2Memory  = uint32(64 * 1024) // 64MB
	DefaultArgon2Threads = uint8(4)
	DefaultArgon2KeyLen  = uint32(32)
	DefaultSaltLen       = 16
	
	// Password requirements
	MinPasswordLength = 8
	MaxPasswordLength = 128
)

var (
	ErrPasswordTooShort = errors.New("password must be at least 8 characters")
	ErrPasswordTooLong  = errors.New("password must be no more than 128 characters")
	ErrPasswordWeak     = errors.New("password must contain uppercase, lowercase, number, and special character")
	ErrInvalidHash      = errors.New("invalid password hash format")
)

// PasswordConfig holds password hashing configuration
type PasswordConfig struct {
	Time    uint32
	Memory  uint32
	Threads uint8
	KeyLen  uint32
	SaltLen int
}

// DefaultPasswordConfig returns the default password configuration
func DefaultPasswordConfig() *PasswordConfig {
	return &PasswordConfig{
		Time:    DefaultArgon2Time,
		Memory:  DefaultArgon2Memory,
		Threads: DefaultArgon2Threads,
		KeyLen:  DefaultArgon2KeyLen,
		SaltLen: DefaultSaltLen,
	}
}

// PasswordHasher handles password hashing and verification
type PasswordHasher struct {
	config *PasswordConfig
}

// NewPasswordHasher creates a new password hasher with default config
func NewPasswordHasher() *PasswordHasher {
	return &PasswordHasher{
		config: DefaultPasswordConfig(),
	}
}

// NewPasswordHasherWithConfig creates a new password hasher with custom config
func NewPasswordHasherWithConfig(config *PasswordConfig) *PasswordHasher {
	return &PasswordHasher{
		config: config,
	}
}

// ValidatePassword checks if a password meets security requirements
func ValidatePassword(password string) error {
	// Check length
	if len(password) < MinPasswordLength {
		return ErrPasswordTooShort
	}
	if len(password) > MaxPasswordLength {
		return ErrPasswordTooLong
	}

	// Check complexity
	var hasUpper, hasLower, hasNumber, hasSpecial bool
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsNumber(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	if !hasUpper || !hasLower || !hasNumber || !hasSpecial {
		return ErrPasswordWeak
	}

	return nil
}

// HashPassword creates an Argon2id hash of the password
func (h *PasswordHasher) HashPassword(password string) (string, error) {
	// Generate random salt
	salt := make([]byte, h.config.SaltLen)
	_, err := rand.Read(salt)
	if err != nil {
		return "", fmt.Errorf("failed to generate salt: %w", err)
	}

	// Hash password with Argon2id
	hash := argon2.IDKey(
		[]byte(password),
		salt,
		h.config.Time,
		h.config.Memory,
		h.config.Threads,
		h.config.KeyLen,
	)

	// Encode in standard format: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
	// Using base64 encoding for salt and hash for better compatibility
	saltB64 := base64.RawStdEncoding.EncodeToString(salt)
	hashB64 := base64.RawStdEncoding.EncodeToString(hash)

	encodedHash := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		h.config.Memory,
		h.config.Time,
		h.config.Threads,
		saltB64,
		hashB64,
	)

	return encodedHash, nil
}

// VerifyPassword verifies a password against an Argon2id hash
func (h *PasswordHasher) VerifyPassword(password, encodedHash string) (bool, error) {
	// Parse the encoded hash
	params, salt, hash, err := h.parseHash(encodedHash)
	if err != nil {
		// Try legacy bcrypt format for backward compatibility
		if strings.HasPrefix(encodedHash, "$2") {
			return false, errors.New("bcrypt hashes are no longer supported, please reset password")
		}
		return false, err
	}

	// Hash the input password with the same parameters
	actualHash := argon2.IDKey(
		[]byte(password),
		salt,
		params.Time,
		params.Memory,
		params.Threads,
		uint32(len(hash)),
	)

	// Compare hashes in constant time
	return subtle.ConstantTimeCompare(hash, actualHash) == 1, nil
}

// parseHash parses an Argon2id hash string
func (h *PasswordHasher) parseHash(encodedHash string) (*PasswordConfig, []byte, []byte, error) {
	// Expected format: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return nil, nil, nil, fmt.Errorf("%w: expected 6 parts, got %d", ErrInvalidHash, len(parts))
	}

	// Check algorithm and version
	if parts[1] != "argon2id" {
		return nil, nil, nil, fmt.Errorf("%w: unsupported algorithm %s", ErrInvalidHash, parts[1])
	}
	if parts[2] != "v=19" {
		return nil, nil, nil, fmt.Errorf("%w: unsupported version %s", ErrInvalidHash, parts[2])
	}

	// Parse parameters
	config := &PasswordConfig{}
	for _, param := range strings.Split(parts[3], ",") {
		kv := strings.Split(param, "=")
		if len(kv) != 2 {
			continue
		}
		
		switch kv[0] {
		case "m":
			val, err := strconv.ParseUint(kv[1], 10, 32)
			if err != nil {
				return nil, nil, nil, fmt.Errorf("%w: invalid memory parameter", ErrInvalidHash)
			}
			config.Memory = uint32(val)
		case "t":
			val, err := strconv.ParseUint(kv[1], 10, 32)
			if err != nil {
				return nil, nil, nil, fmt.Errorf("%w: invalid time parameter", ErrInvalidHash)
			}
			config.Time = uint32(val)
		case "p":
			val, err := strconv.ParseUint(kv[1], 10, 8)
			if err != nil {
				return nil, nil, nil, fmt.Errorf("%w: invalid parallelism parameter", ErrInvalidHash)
			}
			config.Threads = uint8(val)
		}
	}

	// Decode salt and hash
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		// Try hex decoding for backward compatibility
		salt, err = hex.DecodeString(parts[4])
		if err != nil {
			return nil, nil, nil, fmt.Errorf("%w: invalid salt encoding", ErrInvalidHash)
		}
	}

	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		// Try hex decoding for backward compatibility
		hash, err = hex.DecodeString(parts[5])
		if err != nil {
			return nil, nil, nil, fmt.Errorf("%w: invalid hash encoding", ErrInvalidHash)
		}
	}

	return config, salt, hash, nil
}

// GenerateSecureToken generates a cryptographically secure random token
func GenerateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate secure token: %w", err)
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// GenerateSecureTokenHex generates a cryptographically secure random token in hex
func GenerateSecureTokenHex(length int) (string, error) {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate secure token: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}