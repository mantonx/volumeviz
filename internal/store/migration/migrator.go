package migration

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/database/sqlite"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/mantonx/volumeviz/internal/store/config"
)

// Migrator handles database migrations using golang-migrate
type Migrator struct {
	migrationPath string
	dbType        config.DatabaseType
}

// NewMigrator creates a new migrator instance
func NewMigrator(migrationPath string, dbType config.DatabaseType) *Migrator {
	return &Migrator{
		migrationPath: migrationPath,
		dbType:        dbType,
	}
}

// MigrateUp runs all pending migrations
func (m *Migrator) MigrateUp(db *sql.DB) error {
	migrator, err := m.createMigrator(db)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}
	defer migrator.Close()

	if err := migrator.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}

// MigrateDown runs one down migration
func (m *Migrator) MigrateDown(db *sql.DB) error {
	migrator, err := m.createMigrator(db)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}
	defer migrator.Close()

	if err := migrator.Steps(-1); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to rollback migration: %w", err)
	}

	return nil
}

// GetVersion returns the current migration version
func (m *Migrator) GetVersion(db *sql.DB) (uint, bool, error) {
	migrator, err := m.createMigrator(db)
	if err != nil {
		return 0, false, fmt.Errorf("failed to create migrator: %w", err)
	}
	defer migrator.Close()

	return migrator.Version()
}

// createMigrator creates a migrate.Migrate instance for the given database
func (m *Migrator) createMigrator(db *sql.DB) (*migrate.Migrate, error) {
	// Create database driver based on type
	var driver database.Driver
	var err error

	switch m.dbType {
	case config.DatabaseTypePostgreSQL:
		driver, err = postgres.WithInstance(db, &postgres.Config{})
		if err != nil {
			return nil, fmt.Errorf("failed to create PostgreSQL driver: %w", err)
		}

	case config.DatabaseTypeSQLite:
		driver, err = sqlite.WithInstance(db, &sqlite.Config{})
		if err != nil {
			return nil, fmt.Errorf("failed to create SQLite driver: %w", err)
		}

	default:
		return nil, fmt.Errorf("unsupported database type: %v", m.dbType)
	}

	// Create migrator with source URL
	sourceURL := fmt.Sprintf("file://%s", m.migrationPath)
	migrator, err := migrate.NewWithDatabaseInstance(sourceURL, string(m.dbType), driver)
	if err != nil {
		return nil, fmt.Errorf("failed to create migrator: %w", err)
	}

	return migrator, nil
}

// GetMigrationPath returns the migration path for the given database type
func GetMigrationPath() (string, error) {
	// Get the current working directory
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current working directory: %w", err)
	}
	
	// List of possible migration directories to check
	// Prefer the new migrations directory structure
	possiblePaths := []string{
		filepath.Join(cwd, "..", "..", "..", "migrations"), // /home/fictional/Projects/volumeviz/migrations
		filepath.Join(cwd, "migrations"),                   // Current dir
		filepath.Join(cwd, "..", "migrations"),             // Parent dir  
		filepath.Join(cwd, "..", "..", "migrations"),       // Grandparent dir
		filepath.Join(cwd, "..", "..", "..", "..", "migrations"), // Great-great-grandparent dir
	}
	
	// Check each possible path
	for _, path := range possiblePaths {
		absPath, err := filepath.Abs(path)
		if err != nil {
			continue
		}
		if _, err := os.Stat(absPath); err == nil {
			// Additional check: prefer the path that contains golang-migrate style files
			files, err := os.ReadDir(absPath)
			if err == nil {
				hasGolangMigrateFiles := false
				for _, file := range files {
					if !file.IsDir() && (
						strings.Contains(file.Name(), ".up.sql") || 
						strings.Contains(file.Name(), ".down.sql")) {
						hasGolangMigrateFiles = true
						break
					}
				}
				if hasGolangMigrateFiles {
					return absPath, nil
				}
			} else {
				// If we can't read the directory or no golang-migrate files, still return it
				return absPath, nil
			}
		}
	}
	
	return "", fmt.Errorf("migrations directory not found, checked paths: %v", possiblePaths)
}