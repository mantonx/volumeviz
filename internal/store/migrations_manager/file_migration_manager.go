package migrations_manager

import (
	"database/sql"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mantonx/volumeviz/internal/store/config"
)

// FileMigrationManager handles file-based migrations
type FileMigrationManager struct {
	db       *sql.DB
	dbType   config.DatabaseType
	basePath string
}

// NewFileMigrationManager creates a new file-based migration manager
func NewFileMigrationManager(db *config.DB, basePath string) *FileMigrationManager {
	return &FileMigrationManager{
		db:       db.DB,
		dbType:   db.GetDatabaseType(),
		basePath: basePath,
	}
}

// ApplyMigrations applies all SQL files from the appropriate schema directory
func (fm *FileMigrationManager) ApplyMigrations() error {
	// Determine the schema directory based on database type
	var schemaDir string
	switch fm.dbType {
	case config.DatabaseTypePostgreSQL:
		schemaDir = filepath.Join(fm.basePath, "postgres", "schema")
	case config.DatabaseTypeSQLite:
		schemaDir = filepath.Join(fm.basePath, "sqlite", "schema")
	default:
		return fmt.Errorf("unsupported database type: %v", fm.dbType)
	}

	// Check if directory exists
	if _, err := os.Stat(schemaDir); os.IsNotExist(err) {
		return fmt.Errorf("schema directory does not exist: %s", schemaDir)
	}

	// Read all SQL files from the directory
	files, err := os.ReadDir(schemaDir)
	if err != nil {
		return fmt.Errorf("failed to read schema directory: %w", err)
	}

	// Filter and sort SQL files
	var sqlFiles []fs.DirEntry
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			sqlFiles = append(sqlFiles, file)
		}
	}

	// Sort files by name to ensure consistent order
	sort.Slice(sqlFiles, func(i, j int) bool {
		return sqlFiles[i].Name() < sqlFiles[j].Name()
	})

	// Apply each SQL file
	for _, file := range sqlFiles {
		filePath := filepath.Join(schemaDir, file.Name())
		if err := fm.applyFile(filePath); err != nil {
			return fmt.Errorf("failed to apply %s: %w", file.Name(), err)
		}
		fmt.Printf("Applied schema: %s\n", file.Name())
	}

	return nil
}

// applyFile applies a single SQL file
func (fm *FileMigrationManager) applyFile(filePath string) error {
	// Read file contents
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// Execute the SQL
	// Note: This executes the entire file as one statement.
	// For files with multiple statements, we need to split them.
	statements := fm.splitStatements(string(content))

	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}

		if _, err := fm.db.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute statement %d: %w", i+1, err)
		}
	}

	return nil
}

// splitStatements splits SQL content into individual statements
// This is a simple implementation that splits on semicolons
// A more robust implementation would handle semicolons within strings, etc.
func (fm *FileMigrationManager) splitStatements(content string) []string {
	// For PostgreSQL, we need to handle $$ blocks for functions
	if fm.dbType == config.DatabaseTypePostgreSQL {
		return fm.splitPostgreSQLStatements(content)
	}

	// For SQLite, handle triggers and multi-line statements
	return fm.splitSQLiteStatements(content)
}

// splitPostgreSQLStatements handles PostgreSQL-specific statement splitting
func (fm *FileMigrationManager) splitPostgreSQLStatements(content string) []string {
	var statements []string
	var currentStmt strings.Builder
	lines := strings.Split(content, "\n")
	inDollarQuote := false
	dollarQuoteTag := ""

	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)

		// Check for dollar quote start/end
		if !inDollarQuote && strings.Contains(line, "$$") {
			inDollarQuote = true
			dollarQuoteTag = "$$"
		} else if inDollarQuote && strings.Contains(line, dollarQuoteTag) {
			inDollarQuote = false
			currentStmt.WriteString(line)
			currentStmt.WriteString("\n")
			continue
		}

		currentStmt.WriteString(line)
		currentStmt.WriteString("\n")

		// If we're not in a dollar quote and line ends with semicolon, it's end of statement
		if !inDollarQuote && strings.HasSuffix(trimmedLine, ";") {
			stmt := strings.TrimSpace(currentStmt.String())
			if stmt != "" {
				statements = append(statements, stmt)
			}
			currentStmt.Reset()
		}
	}

	// Add any remaining statement
	if currentStmt.Len() > 0 {
		stmt := strings.TrimSpace(currentStmt.String())
		if stmt != "" {
			statements = append(statements, stmt)
		}
	}

	return statements
}

// GetAppliedSchemas returns a list of schema files that have been applied
// Since these are idempotent, we just return the list of files
func (fm *FileMigrationManager) GetAppliedSchemas() ([]string, error) {
	// Determine the schema directory based on database type
	var schemaDir string
	switch fm.dbType {
	case config.DatabaseTypePostgreSQL:
		schemaDir = filepath.Join(fm.basePath, "postgres", "schema")
	case config.DatabaseTypeSQLite:
		schemaDir = filepath.Join(fm.basePath, "sqlite", "schema")
	default:
		return nil, fmt.Errorf("unsupported database type: %v", fm.dbType)
	}

	files, err := os.ReadDir(schemaDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read schema directory: %w", err)
	}

	var schemas []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			schemas = append(schemas, file.Name())
		}
	}

	sort.Strings(schemas)
	return schemas, nil
}

// splitSQLiteStatements handles SQLite-specific statement splitting
// This handles multi-line statements like triggers
func (fm *FileMigrationManager) splitSQLiteStatements(content string) []string {
	var statements []string
	var currentStmt strings.Builder
	lines := strings.Split(content, "\n")
	inTrigger := false

	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)

		// Skip empty lines and comments
		if trimmedLine == "" || strings.HasPrefix(trimmedLine, "--") {
			continue
		}

		// Check if we're starting a trigger
		if strings.HasPrefix(strings.ToUpper(trimmedLine), "CREATE TRIGGER") {
			inTrigger = true
		}

		currentStmt.WriteString(line)
		currentStmt.WriteString("\n")

		// Check if statement ends with semicolon
		if strings.HasSuffix(trimmedLine, ";") {
			// For triggers, we need to look for "END;" to close the trigger
			if inTrigger && !strings.HasSuffix(strings.ToUpper(trimmedLine), "END;") {
				// Continue building the trigger statement
				continue
			}

			// Statement complete
			stmt := strings.TrimSpace(currentStmt.String())
			if stmt != "" {
				statements = append(statements, stmt)
			}
			currentStmt.Reset()
			inTrigger = false
		}
	}

	// Add any remaining statement
	if currentStmt.Len() > 0 {
		stmt := strings.TrimSpace(currentStmt.String())
		if stmt != "" {
			statements = append(statements, stmt)
		}
	}

	return statements
}
