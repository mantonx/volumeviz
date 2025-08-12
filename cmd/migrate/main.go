package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/mantonx/volumeviz/internal/config"
	storeConfig "github.com/mantonx/volumeviz/internal/store/config"
	"github.com/mantonx/volumeviz/internal/store/migration"
	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: migrate-new <up|down|version|create>")
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

	// Initialize database configuration
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

	switch command {
	case "up":
		if err := migrateUp(dbConfig); err != nil {
			log.Fatalf("Failed to migrate up: %v", err)
		}
		log.Println("✅ Migrations completed successfully")

	case "down":
		if err := migrateDown(dbConfig); err != nil {
			log.Fatalf("Failed to migrate down: %v", err)
		}
		log.Println("✅ Migration rolled back successfully")

	case "version":
		if err := showVersion(dbConfig); err != nil {
			log.Fatalf("Failed to get version: %v", err)
		}

	case "create":
		if len(os.Args) < 3 {
			log.Fatal("Usage: migrate-new create <migration_name>")
		}
		migrationName := os.Args[2]
		if err := createMigration(migrationName); err != nil {
			log.Fatalf("Failed to create migration: %v", err)
		}

	default:
		log.Fatalf("Unknown command: %s. Use: up, down, version, or create", command)
	}
}

func migrateUp(cfg *storeConfig.Config) error {
	db, err := openDatabase(cfg)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	migrationPath, err := migration.GetMigrationPath()
	if err != nil {
		return fmt.Errorf("failed to find migrations: %w", err)
	}

	migrator := migration.NewMigrator(migrationPath, cfg.Type)
	return migrator.MigrateUp(db)
}

func migrateDown(cfg *storeConfig.Config) error {
	db, err := openDatabase(cfg)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	migrationPath, err := migration.GetMigrationPath()
	if err != nil {
		return fmt.Errorf("failed to find migrations: %w", err)
	}

	migrator := migration.NewMigrator(migrationPath, cfg.Type)
	return migrator.MigrateDown(db)
}

func showVersion(cfg *storeConfig.Config) error {
	db, err := openDatabase(cfg)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	migrationPath, err := migration.GetMigrationPath()
	if err != nil {
		return fmt.Errorf("failed to find migrations: %w", err)
	}

	migrator := migration.NewMigrator(migrationPath, cfg.Type)
	version, dirty, err := migrator.GetVersion(db)
	if err != nil {
		return fmt.Errorf("failed to get version: %w", err)
	}

	log.Printf("Database type: %s", cfg.Type)
	log.Printf("Current migration version: %d", version)
	log.Printf("Dirty state: %v", dirty)

	return nil
}

func createMigration(name string) error {
	migrationPath, err := migration.GetMigrationPath()
	if err != nil {
		return fmt.Errorf("failed to find migrations directory: %w", err)
	}

	// Find the next migration number
	files, err := os.ReadDir(migrationPath)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	nextNumber := 1
	for _, file := range files {
		if !file.IsDir() && len(file.Name()) >= 6 {
			if num, err := strconv.Atoi(file.Name()[:6]); err == nil {
				if num >= nextNumber {
					nextNumber = num + 1
				}
			}
		}
	}

	// Create up and down migration files
	upFile := fmt.Sprintf("%s/%06d_%s.up.sql", migrationPath, nextNumber, name)
	downFile := fmt.Sprintf("%s/%06d_%s.down.sql", migrationPath, nextNumber, name)

	upContent := fmt.Sprintf("-- Migration: %s\n-- Up migration\n\n-- TODO: Add your up migration here\n", name)
	downContent := fmt.Sprintf("-- Migration: %s\n-- Down migration\n\n-- TODO: Add your down migration here\n", name)

	if err := os.WriteFile(upFile, []byte(upContent), 0644); err != nil {
		return fmt.Errorf("failed to create up migration file: %w", err)
	}

	if err := os.WriteFile(downFile, []byte(downContent), 0644); err != nil {
		return fmt.Errorf("failed to create down migration file: %w", err)
	}

	log.Printf("✅ Created migration files:")
	log.Printf("  - %s", upFile)
	log.Printf("  - %s", downFile)

	return nil
}

func openDatabase(cfg *storeConfig.Config) (*sql.DB, error) {
	var db *sql.DB
	var err error

	switch cfg.Type {
	case storeConfig.DatabaseTypePostgreSQL:
		dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Database, cfg.SSLMode)
		db, err = sql.Open("postgres", dsn)

	case storeConfig.DatabaseTypeSQLite:
		db, err = sql.Open("sqlite", cfg.DSN())

	default:
		return nil, fmt.Errorf("unsupported database type: %v", cfg.Type)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}