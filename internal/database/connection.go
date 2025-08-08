package database

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"time"

	_ "github.com/lib/pq"  // PostgreSQL driver
	_ "modernc.org/sqlite" // SQLite driver
)

// DatabaseType represents the type of database backend
type DatabaseType string

const (
	DatabaseTypePostgreSQL DatabaseType = "postgres"
	DatabaseTypeSQLite     DatabaseType = "sqlite"
)

// Config holds database configuration
type Config struct {
	Type         DatabaseType  `yaml:"type" env:"DB_TYPE"`
	Host         string        `yaml:"host" env:"DB_HOST"`
	Port         int           `yaml:"port" env:"DB_PORT"`
	User         string        `yaml:"user" env:"DB_USER"`
	Password     string        `yaml:"password" env:"DB_PASSWORD"`
	Database     string        `yaml:"database" env:"DB_NAME"`
	SSLMode      string        `yaml:"ssl_mode" env:"DB_SSL_MODE"`
	Path         string        `yaml:"path" env:"DB_PATH"` // SQLite database file path
	MaxOpenConns int           `yaml:"max_open_conns" env:"DB_MAX_OPEN_CONNS"`
	MaxIdleConns int           `yaml:"max_idle_conns" env:"DB_MAX_IDLE_CONNS"`
	ConnMaxLife  time.Duration `yaml:"conn_max_life" env:"DB_CONN_MAX_LIFE"`
	Timeout      time.Duration `yaml:"timeout" env:"DB_TIMEOUT"`
}

// DefaultConfig returns database configuration with sensible defaults
func DefaultConfig() *Config {
	return &Config{
		Type:         DatabaseTypePostgreSQL,
		Host:         "localhost",
		Port:         5432,
		User:         "volumeviz",
		Password:     "volumeviz",
		Database:     "volumeviz",
		SSLMode:      "disable",
		Path:         "./volumeviz.db", // Default SQLite path
		MaxOpenConns: 50,               // Increased for PostgreSQL's better concurrency handling
		MaxIdleConns: 25,               // Increased to maintain connection pool
		ConnMaxLife:  30 * time.Minute,
		Timeout:      30 * time.Second,
	}
}

// DefaultPostgreSQLConfig returns PostgreSQL-optimized configuration
func DefaultPostgreSQLConfig() *Config {
	return &Config{
		Type:         DatabaseTypePostgreSQL,
		Host:         "localhost",
		Port:         5432,
		User:         "volumeviz",
		Password:     "volumeviz",
		Database:     "volumeviz",
		SSLMode:      "prefer",         // Use SSL when available
		MaxOpenConns: 100,              // PostgreSQL can handle more concurrent connections
		MaxIdleConns: 50,               // Keep more idle connections for high-traffic scenarios
		ConnMaxLife:  1 * time.Hour,    // Longer connection lifetime
		Timeout:      60 * time.Second, // Longer timeout for complex queries
	}
}

// DefaultSQLiteConfig returns SQLite-specific configuration
func DefaultSQLiteConfig() *Config {
	return &Config{
		Type:         DatabaseTypeSQLite,
		Path:         "./volumeviz.db",
		MaxOpenConns: 1, // SQLite doesn't handle concurrent writes well
		MaxIdleConns: 1,
		ConnMaxLife:  30 * time.Minute,
		Timeout:      30 * time.Second,
	}
}

// DSN returns the database connection string based on database type
func (c *Config) DSN() string {
	switch c.Type {
	case DatabaseTypeSQLite:
		return c.sqliteDSN()
	case DatabaseTypePostgreSQL:
		return c.postgresqlDSN()
	default:
		return c.postgresqlDSN() // Default to PostgreSQL
	}
}

// postgresqlDSN returns the PostgreSQL connection string with performance optimizations
func (c *Config) postgresqlDSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s connect_timeout=%d application_name=volumeviz statement_timeout=%d lock_timeout=30000 idle_in_transaction_session_timeout=60000",
		c.Host, c.Port, c.User, c.Password, c.Database, c.SSLMode,
		int(c.Timeout.Seconds()), int(c.Timeout.Milliseconds()),
	)
}

// sqliteDSN returns the SQLite connection string
func (c *Config) sqliteDSN() string {
	path := c.Path
	if path == "" {
		path = "./volumeviz.db"
	}

	// Use absolute path to avoid issues with working directory changes
	if !filepath.IsAbs(path) {
		if absPath, err := filepath.Abs(path); err == nil {
			path = absPath
		}
	}

	// SQLite connection string with performance optimizations
	// WAL mode: Write-Ahead Logging for better concurrency
	// NORMAL synchronous: Balance between safety and performance
	// Shared cache: Allow multiple connections to share cache
	// Foreign keys: Enable referential integrity
	// Other optimizations for VolumeViz workload
	return fmt.Sprintf("file:%s?cache=shared&mode=rwc&_timeout=%d&_journal_mode=WAL&_synchronous=NORMAL&_foreign_keys=on&_cache_size=-64000&_temp_store=memory&_mmap_size=268435456&_page_size=4096",
		path, int(c.Timeout.Milliseconds()))
}

// DB represents the database connection pool
type DB struct {
	*sql.DB
	config *Config
	dbType DatabaseType
}

// NewDB creates a new database connection with proper configuration
func NewDB(config *Config) (*DB, error) {
	var driverName string
	switch config.Type {
	case DatabaseTypeSQLite:
		driverName = "sqlite"
	case DatabaseTypePostgreSQL:
		driverName = "postgres"
	default:
		driverName = "postgres" // Default to PostgreSQL
	}

	sqlDB, err := sql.Open(driverName, config.DSN())
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool based on database type
	if config.Type == DatabaseTypeSQLite {
		// SQLite-specific connection pool settings
		sqlDB.SetMaxOpenConns(1) // SQLite should have only one connection for writes
		sqlDB.SetMaxIdleConns(1)
	} else {
		// PostgreSQL connection pool settings
		sqlDB.SetMaxOpenConns(config.MaxOpenConns)
		sqlDB.SetMaxIdleConns(config.MaxIdleConns)
	}
	sqlDB.SetConnMaxLifetime(config.ConnMaxLife)

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db := &DB{
		DB:     sqlDB,
		config: config,
		dbType: config.Type,
	}

	// Apply database-specific performance optimizations
	if err := db.applyPerformanceOptimizations(); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("failed to apply performance optimizations: %w", err)
	}

	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.DB.Close()
}

// GetDatabaseType returns the database type (postgres or sqlite)
func (db *DB) GetDatabaseType() DatabaseType {
	return db.dbType
}

// IsPostgreSQL returns true if the database is PostgreSQL
func (db *DB) IsPostgreSQL() bool {
	return db.dbType == DatabaseTypePostgreSQL
}

// IsSQLite returns true if the database is SQLite
func (db *DB) IsSQLite() bool {
	return db.dbType == DatabaseTypeSQLite
}

// applyPerformanceOptimizations applies database-specific performance settings
func (db *DB) applyPerformanceOptimizations() error {
	if db.IsSQLite() {
		return db.applySQLiteOptimizations()
	}
	return db.applyPostgreSQLOptimizations()
}

// applySQLiteOptimizations applies SQLite-specific performance optimizations
func (db *DB) applySQLiteOptimizations() error {
	optimizations := []string{
		// Ensure WAL mode is active (should be set via connection string)
		"PRAGMA journal_mode=WAL",

		// Set synchronous mode to NORMAL for better performance
		// FULL is safest but slower, NORMAL is good balance, OFF is fastest but risky
		"PRAGMA synchronous=NORMAL",

		// Set cache size to 64MB (negative value means KB)
		"PRAGMA cache_size=-64000",

		// Use memory for temporary storage
		"PRAGMA temp_store=memory",

		// Enable memory-mapped I/O (256MB)
		"PRAGMA mmap_size=268435456",

		// Optimize page size for modern SSDs
		"PRAGMA page_size=4096",

		// Enable foreign key constraints
		"PRAGMA foreign_keys=ON",

		// Set busy timeout for better concurrency (in milliseconds)
		fmt.Sprintf("PRAGMA busy_timeout=%d", int(db.config.Timeout.Milliseconds())),

		// Optimize for read-heavy workloads (VolumeViz is mostly read-heavy)
		"PRAGMA optimize",

		// Auto-vacuum to prevent database bloat
		"PRAGMA auto_vacuum=INCREMENTAL",
	}

	for _, pragma := range optimizations {
		if _, err := db.Exec(pragma); err != nil {
			// Log warning but don't fail - some pragmas might not be supported
			// In production, you might want to use a proper logger here
			fmt.Printf("Warning: Failed to apply SQLite optimization '%s': %v\n", pragma, err)
		}
	}

	return nil
}

// applyPostgreSQLOptimizations applies PostgreSQL-specific performance optimizations
func (db *DB) applyPostgreSQLOptimizations() error {
	// PostgreSQL session-level optimizations for VolumeViz workload
	// These complement server-level postgresql.conf settings

	optimizations := []string{
		// Memory settings for query execution
		"SET work_mem = '64MB'",              // Increased for sorting/hashing operations
		"SET maintenance_work_mem = '256MB'", // For VACUUM, CREATE INDEX, etc.
		"SET temp_buffers = '32MB'",          // Temporary table buffer

		// Query planner settings (assuming SSD storage)
		"SET random_page_cost = 1.1",         // SSD random access cost
		"SET seq_page_cost = 1.0",            // Sequential page cost baseline
		"SET effective_cache_size = '2GB'",   // OS cache size hint
		"SET effective_io_concurrency = 200", // SSD concurrent I/O capacity

		// Enable advanced features (PostgreSQL 11+)
		"SET jit = on",                         // Just-In-Time compilation
		"SET jit_above_cost = 100000",          // JIT for expensive queries
		"SET jit_optimize_above_cost = 500000", // Optimize expensive queries

		// Connection and session settings
		"SET statement_timeout = '300s'",                  // Prevent runaway queries
		"SET lock_timeout = '30s'",                        // Lock acquisition timeout
		"SET idle_in_transaction_session_timeout = '60s'", // Prevent idle txns

		// Query optimization settings
		"SET enable_hashjoin = on",   // Enable hash joins
		"SET enable_mergejoin = on",  // Enable merge joins
		"SET enable_nestloop = on",   // Enable nested loop joins
		"SET enable_seqscan = on",    // Enable sequential scans
		"SET enable_indexscan = on",  // Enable index scans
		"SET enable_bitmapscan = on", // Enable bitmap scans

		// Parallel query settings (PostgreSQL 9.6+)
		"SET max_parallel_workers_per_gather = 4", // Parallel workers
		"SET parallel_tuple_cost = 0.1",           // Cost of transferring tuple
		"SET parallel_setup_cost = 1000.0",        // Cost of setting up parallel workers

		// WAL and durability (if allowed)
		"SET synchronous_commit = on", // Ensure durability

		// Statistics and monitoring
		"SET track_activities = on", // Track running queries
		"SET track_counts = on",     // Track table/index usage
		"SET track_io_timing = on",  // Track I/O timing

		// Logging for performance analysis (session level)
		"SET log_min_duration_statement = 1000", // Log slow queries (1s+)
		"SET log_statement_stats = off",         // Don't log all statement stats

		// GIN/GiST index settings for JSONB (relevant for Labels columns)
		"SET gin_fuzzy_search_limit = 0", // No limit on GIN searches

		// For VolumeViz-specific workload optimizations
		"SET join_collapse_limit = 12", // Allow larger join optimizations
		"SET from_collapse_limit = 12", // Allow larger FROM clause optimizations
		"SET geqo_threshold = 15",      // Use genetic query optimizer for large joins
	}

	for _, setting := range optimizations {
		if _, err := db.Exec(setting); err != nil {
			// Log warning but don't fail - some settings might not be supported
			// or require superuser privileges
			fmt.Printf("Warning: Failed to apply PostgreSQL optimization '%s': %v\n", setting, err)
		}
	}

	return nil
}

// OptimizeDatabase runs database-specific optimization routines
// For SQLite: VACUUM, ANALYZE, and other maintenance operations
// For PostgreSQL: ANALYZE and other maintenance operations
func (db *DB) OptimizeDatabase() error {
	if db.IsSQLite() {
		return db.optimizeSQLite()
	}
	return db.optimizePostgreSQL()
}

// optimizeSQLite runs SQLite-specific optimization operations
func (db *DB) optimizeSQLite() error {
	operations := []string{
		// Analyze database for query planner statistics
		"ANALYZE",

		// Incremental vacuum to reclaim space
		"PRAGMA incremental_vacuum",

		// Optimize query planner
		"PRAGMA optimize",
	}

	for _, op := range operations {
		if _, err := db.Exec(op); err != nil {
			return fmt.Errorf("failed to execute SQLite optimization '%s': %w", op, err)
		}
	}

	return nil
}

// optimizePostgreSQL runs PostgreSQL-specific optimization operations
func (db *DB) optimizePostgreSQL() error {
	// Get list of tables in the volumeviz schema
	tables := []string{
		"volumes", "volume_sizes", "containers", "volume_mounts",
		"scan_jobs", "volume_metrics", "system_health", "scan_cache",
		"migration_history",
	}

	// Run table-specific ANALYZE for better statistics
	for _, table := range tables {
		if _, err := db.Exec("ANALYZE " + table); err != nil {
			// Log warning but continue with other tables
			fmt.Printf("Warning: Failed to analyze table '%s': %v\n", table, err)
		}
	}

	// Run global ANALYZE for cross-table statistics
	if _, err := db.Exec("ANALYZE"); err != nil {
		return fmt.Errorf("failed to analyze PostgreSQL database: %w", err)
	}

	// Update extension statistics if available (PostgreSQL 10+)
	extensions := []string{
		"CREATE STATISTICS IF NOT EXISTS volume_stats ON volume_id, created_at FROM volumes",
		"CREATE STATISTICS IF NOT EXISTS scan_stats ON volume_id, status, created_at FROM scan_jobs",
	}

	for _, stmt := range extensions {
		if _, err := db.Exec(stmt); err != nil {
			// Extended statistics might not be supported or might already exist
			// This is not critical, so we just log warnings
			fmt.Printf("Info: Extended statistics creation skipped: %v\n", err)
		}
	}

	// Refresh materialized views if any exist (future-proofing)
	refreshViews := []string{
		// "REFRESH MATERIALIZED VIEW volume_summary_view",
		// Add materialized views here when they're implemented
	}

	for _, refresh := range refreshViews {
		if _, err := db.Exec(refresh); err != nil {
			fmt.Printf("Warning: Failed to refresh materialized view: %v\n", err)
		}
	}

	return nil
}

// BeginTx starts a new database transaction with context
func (db *DB) BeginTx() (*Tx, error) {
	tx, err := db.DB.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	return &Tx{Tx: tx}, nil
}

// Tx wraps sql.Tx to provide additional functionality
type Tx struct {
	*sql.Tx
}

// Rollback rolls back the transaction if it hasn't been committed
func (tx *Tx) Rollback() error {
	if tx.Tx == nil {
		return nil // Already committed or rolled back
	}
	err := tx.Tx.Rollback()
	tx.Tx = nil
	return err
}

// Commit commits the transaction
func (tx *Tx) Commit() error {
	if tx.Tx == nil {
		return fmt.Errorf("transaction already committed or rolled back")
	}
	err := tx.Tx.Commit()
	tx.Tx = nil
	return err
}

// HealthStatus represents database health information
type HealthStatus struct {
	Status       string        `json:"status"`
	ResponseTime time.Duration `json:"response_time"`
	OpenConns    int           `json:"open_connections"`
	IdleConns    int           `json:"idle_connections"`
	MaxOpenConns int           `json:"max_open_connections"`
	Error        string        `json:"error,omitempty"`
}

// Health checks database health and returns status information
func (db *DB) Health() *HealthStatus {
	start := time.Now()

	// Test basic connectivity
	err := db.Ping()
	responseTime := time.Since(start)

	status := &HealthStatus{
		ResponseTime: responseTime,
		MaxOpenConns: db.config.MaxOpenConns,
	}

	if err != nil {
		status.Status = "unhealthy"
		status.Error = err.Error()
		return status
	}

	// Get connection stats
	stats := db.Stats()
	status.OpenConns = stats.OpenConnections
	status.IdleConns = stats.Idle

	// Determine overall status
	if responseTime > 1*time.Second {
		status.Status = "degraded"
	} else {
		status.Status = "healthy"
	}

	return status
}
