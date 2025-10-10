package migrate

import (
	"database/sql"
	"embed"
	"fmt"
	"log"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed migrations/postgresql/*.sql
var postgresqlMigrations embed.FS

// RunMigrations runs database migrations using golang-migrate
func RunMigrations(db *sql.DB, dbType string) error {
	log.Printf("[MIGRATE] Starting automatic database migrations (type: %s)", dbType)

	switch dbType {
	case "postgres", "postgresql":
		// Create PostgreSQL driver
		driver, err := postgres.WithInstance(db, &postgres.Config{})
		if err != nil {
			return fmt.Errorf("failed to create postgres driver: %w", err)
		}

		// Create source driver from embedded migrations
		sourceDriver, err := iofs.New(postgresqlMigrations, "migrations/postgresql")
		if err != nil {
			return fmt.Errorf("failed to create migration source: %w", err)
		}

		// Create migrate instance
		m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", driver)
		if err != nil {
			return fmt.Errorf("failed to create migrate instance: %w", err)
		}

		return runMigrationUp(m)

	case "sqlite":
		// SQLite migrations not yet implemented
		log.Printf("[MIGRATE] SQLite migrations not yet implemented, skipping")
		return nil

	default:
		return fmt.Errorf("unsupported database type: %s", dbType)
	}
}

func runMigrationUp(m *migrate.Migrate) error {
	// Get current version before migration
	currentVersion, dirty, err := m.Version()
	if err != nil && err != migrate.ErrNilVersion {
		log.Printf("[MIGRATE] Warning: could not get current version: %v", err)
	} else if err == migrate.ErrNilVersion {
		log.Printf("[MIGRATE] No migrations applied yet (fresh database)")
	} else {
		log.Printf("[MIGRATE] Current migration version: %d (dirty: %v)", currentVersion, dirty)
	}

	// Run migrations
	err = m.Up()
	if err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migration failed: %w", err)
	}

	if err == migrate.ErrNoChange {
		log.Printf("[MIGRATE] ✅ Database is up to date, no migrations needed")
	} else {
		newVersion, _, _ := m.Version()
		log.Printf("[MIGRATE] ✅ Migrations completed successfully (new version: %d)", newVersion)
	}

	return nil
}
