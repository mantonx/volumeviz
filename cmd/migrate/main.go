package main

import (
	"log"
	"os"
	"strconv"

	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/database"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: go run ./cmd/migrate <up|down|status>")
	}

	command := os.Args[1]

	// Load configuration
	cfg := config.Load()

	// Parse database port
	dbPort, err := strconv.Atoi(cfg.Database.Port)
	if err != nil {
		log.Printf("Invalid database port '%s', using default 5432", cfg.Database.Port)
		dbPort = 5432
	}

	// Initialize database connection
	dbConfig := &database.Config{
		Type:     database.DatabaseType(cfg.Database.Type),
		Host:     cfg.Database.Host,
		Port:     dbPort,
		User:     cfg.Database.User,
		Password: cfg.Database.Password,
		Database: cfg.Database.Name,
		SSLMode:  cfg.Database.SSLMode,
		Path:     cfg.Database.Path,
	}

	db, err := database.NewDB(dbConfig)
	if err != nil {
		log.Printf("Database configuration:")
		log.Printf("  Type: %s", dbConfig.Type)
		log.Printf("  Host: %s", dbConfig.Host)
		log.Printf("  Port: %d", dbConfig.Port)
		log.Printf("  User: %s", dbConfig.User)
		log.Printf("  Database: %s", dbConfig.Database)
		log.Printf("  SSLMode: %s", dbConfig.SSLMode)
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	migrationManager := database.NewMigrationManager(db)

	switch command {
	case "up":
		log.Println("Running database migrations...")
		if err := migrationManager.ApplyAllPending(); err != nil {
			log.Fatalf("Failed to run migrations: %v", err)
		}
		log.Println("✅ Migrations completed successfully")

	case "status":
		log.Println("Checking migration status...")
		status, err := migrationManager.GetMigrationStatus()
		if err != nil {
			log.Fatalf("Failed to get migration status: %v", err)
		}
		log.Printf("Total migrations: %d", status.TotalMigrations)
		log.Printf("Applied: %d", status.AppliedCount)
		log.Printf("Pending: %d", status.PendingCount)

	case "down":
		log.Println("⚠️  Migration rollback not implemented - this would require implementing Down() methods")
		log.Println("If you need to reset the database, drop and recreate it, then run 'up'")
		os.Exit(1)

	default:
		log.Fatalf("Unknown command: %s. Use: up, down, or status", command)
	}
}
