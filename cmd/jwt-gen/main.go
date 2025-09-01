package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/mantonx/volumeviz/internal/utils/auth"
)

func main() {
	var (
		userID   = flag.String("user", "dev-user", "User ID for the token")
		role     = flag.String("role", "viewer", "User role (viewer, operator, admin)")
		secret   = flag.String("secret", "", "JWT secret (or use AUTH_HS256_SECRET env var)")
		duration = flag.Duration("duration", 24*time.Hour, "Token validity duration")
	)
	flag.Parse()

	// Get secret from environment if not provided
	if *secret == "" {
		*secret = os.Getenv("AUTH_HS256_SECRET")
	}

	if *secret == "" {
		log.Fatal("JWT secret must be provided via -secret flag or AUTH_HS256_SECRET environment variable")
	}

	if len(*secret) < 32 {
		log.Fatal("JWT secret must be at least 32 characters long for security")
	}

	// Validate role
	switch *role {
	case "viewer", "operator", "admin":
		// Valid roles
	default:
		log.Fatalf("Invalid role: %s. Must be viewer, operator, or admin", *role)
	}

	// Create JWT config
	jwtConfig := &auth.JWTConfig{
		AccessSecret:     *secret,
		RefreshSecret:    *secret,
		AccessExpiration: *duration,
		Issuer:           "volumeviz",
	}
	
	// Create JWT manager
	jwtManager := auth.NewJWTManager(jwtConfig)
	
	// Convert role to string
	roleStr := *role
	
	// Generate JWT token with organization context
	token, _, err := jwtManager.GenerateAccessToken(*userID, *userID, "", roleStr, "jwt-gen", nil)
	if err != nil {
		log.Fatalf("Failed to generate JWT token: %v", err)
	}

	fmt.Println("JWT Token Generated Successfully")
	fmt.Println("================================")
	fmt.Printf("User ID: %s\n", *userID)
	fmt.Printf("Role: %s\n", *role)
	fmt.Printf("Expires: %s\n", time.Now().Add(*duration).Format(time.RFC3339))
	fmt.Println()
	fmt.Println("Token:")
	fmt.Println(token)
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Printf("curl -H \"Authorization: Bearer %s\" http://localhost:8080/api/v1/volumes\n", token)
	fmt.Println()
	fmt.Println("Environment variable:")
	fmt.Printf("export JWT_TOKEN=\"%s\"\n", token)
}
