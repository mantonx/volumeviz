package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/mantonx/volumeviz/internal/config"
	storeConfig "github.com/mantonx/volumeviz/internal/store/config"
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
	dbConfig := &storeConfig.Config{
		Type:     storeConfig.DatabaseType(cfg.Database.Type),
		Host:     cfg.Database.Host,
		Port:     dbPort,
		User:     cfg.Database.User,
		Password: cfg.Database.Password,
		Database: cfg.Database.Name,
		SSLMode:  cfg.Database.SSLMode,
		Path:     cfg.Database.Path,
	}

	db, err := storeConfig.NewDB(dbConfig)
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

	// Determine migration directory based on database type
	var migrationDir string
	switch db.GetDatabaseType() {
	case storeConfig.DatabaseTypePostgreSQL:
		migrationDir = "internal/store/migrations/postgres"
	case storeConfig.DatabaseTypeSQLite:
		migrationDir = "internal/store/migrations/sqlite"
	default:
		log.Fatalf("Unsupported database type: %v", db.GetDatabaseType())
	}

	switch command {
	case "up":
		log.Println("Running database migrations...")
		if err := applyMigrations(db.DB, migrationDir); err != nil {
			log.Fatalf("Failed to run migrations: %v", err)
		}
		log.Println("✅ Migrations completed successfully")

	case "status":
		log.Println("Checking migration status...")
		files, err := getMigrationFiles(migrationDir)
		if err != nil {
			log.Fatalf("Failed to get migration files: %v", err)
		}
		log.Printf("Database type: %s", db.GetDatabaseType())
		log.Printf("Migration directory: %s", migrationDir)
		log.Printf("Available migration files: %d", len(files))
		for _, file := range files {
			log.Printf("  - %s", file)
		}

	case "down":
		log.Println("⚠️  Migration rollback not supported with simple SQL files")
		log.Println("If you need to reset the database, drop and recreate it, then run 'up'")
		os.Exit(1)

	default:
		log.Fatalf("Unknown command: %s. Use: up, down, or status", command)
	}
}

// getMigrationFiles returns sorted list of SQL migration files
func getMigrationFiles(migrationDir string) ([]string, error) {
	files, err := os.ReadDir(migrationDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migration directory %s: %w", migrationDir, err)
	}

	var sqlFiles []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			sqlFiles = append(sqlFiles, file.Name())
		}
	}

	sort.Strings(sqlFiles)
	return sqlFiles, nil
}

// applyMigrations applies all SQL files in the migration directory
func applyMigrations(db *sql.DB, migrationDir string) error {
	files, err := getMigrationFiles(migrationDir)
	if err != nil {
		return err
	}

	if len(files) == 0 {
		log.Println("No migration files found")
		return nil
	}

	for _, filename := range files {
		log.Printf("Applying migration: %s", filename)
		
		filePath := filepath.Join(migrationDir, filename)
		content, err := os.ReadFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", filename, err)
		}

		// Execute the SQL content
		if _, err := db.Exec(string(content)); err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", filename, err)
		}
		
		log.Printf("✅ Applied: %s", filename)
	}

	return nil
}
