package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/mantonx/volumeviz/internal/store/config"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	_ "modernc.org/sqlite"
)

// Connection pool metrics for the store connection manager
var (
	storeConnectionsOpen = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "volumeviz_store_connections_open",
		Help: "Number of open database connections in store connection manager",
	}, []string{"db_type"})

	storeConnectionsIdle = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "volumeviz_store_connections_idle",
		Help: "Number of idle database connections in store connection manager",
	}, []string{"db_type"})

	storeConnectionsInUse = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "volumeviz_store_connections_in_use",
		Help: "Number of database connections in use in store connection manager",
	}, []string{"db_type"})

	storeQueryDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "volumeviz_store_query_duration_seconds",
		Help:    "Store database query duration in seconds",
		Buckets: prometheus.ExponentialBuckets(0.001, 2, 10), // 1ms to ~1s
	}, []string{"db_type", "operation"})

	storeConnectionErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "volumeviz_store_connection_errors_total",
		Help: "Total number of database connection errors in store connection manager",
	}, []string{"db_type"})
)

// ConnectionManager handles database connections
type ConnectionManager struct {
	pgPool     *pgxpool.Pool
	sqliteDB   *sql.DB
	dbType     config.DatabaseType
	config     *config.Config
	lastPingAt time.Time
	lastPingMS int64
}

// NewConnectionManager creates a new connection manager
func NewConnectionManager(cfg *config.Config) (*ConnectionManager, error) {
	cm := &ConnectionManager{
		config: cfg,
		dbType: cfg.Type,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	switch cfg.Type {
	case config.DatabaseTypePostgreSQL:
		if err := cm.initPostgreSQL(ctx); err != nil {
			return nil, fmt.Errorf("failed to initialize PostgreSQL: %w", err)
		}
	case config.DatabaseTypeSQLite:
		if err := cm.initSQLite(); err != nil {
			return nil, fmt.Errorf("failed to initialize SQLite: %w", err)
		}
	default:
		return nil, fmt.Errorf("unsupported database type: %s", cfg.Type)
	}

	// Perform initial health check
	if err := cm.Ping(ctx); err != nil {
		cm.Close()
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	// Start metrics collection
	cm.startMetricsCollection()

	return cm, nil
}

// initPostgreSQL initializes PostgreSQL connection pool
func (cm *ConnectionManager) initPostgreSQL(ctx context.Context) error {
	// Build pgxpool config
	poolConfig, err := pgxpool.ParseConfig(cm.config.DSN())
	if err != nil {
		storeConnectionErrors.WithLabelValues("postgres").Inc()
		return fmt.Errorf("invalid PostgreSQL DSN: %w", err)
	}

	// Configure pool settings
	poolConfig.MaxConns = int32(cm.config.MaxOpenConns)
	poolConfig.MinConns = int32(cm.config.MaxIdleConns)
	poolConfig.MaxConnLifetime = cm.config.ConnMaxLife
	poolConfig.MaxConnIdleTime = cm.config.ConnMaxIdleTime
	poolConfig.HealthCheckPeriod = 30 * time.Second
	poolConfig.ConnConfig.ConnectTimeout = cm.config.Timeout

	// Connection callbacks for metrics
	poolConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		storeConnectionsOpen.WithLabelValues("postgres").Inc()
		return nil
	}

	poolConfig.BeforeClose = func(conn *pgx.Conn) {
		storeConnectionsOpen.WithLabelValues("postgres").Dec()
	}

	// Create pool
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		storeConnectionErrors.WithLabelValues("postgres").Inc()
		return fmt.Errorf("failed to create PostgreSQL pool: %w", err)
	}

	cm.pgPool = pool
	return nil
}

// initSQLite initializes SQLite connection
func (cm *ConnectionManager) initSQLite() error {
	// Build SQLite DSN with parameters
	dsn := fmt.Sprintf("%s?_pragma=busy_timeout(%d)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=cache_size(-64000)&_pragma=temp_store(memory)&_pragma=mmap_size(268435456)",
		cm.config.DSN(),
		int(cm.config.Timeout.Milliseconds()))

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		storeConnectionErrors.WithLabelValues("sqlite").Inc()
		return fmt.Errorf("failed to open SQLite database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(cm.config.MaxOpenConns)
	db.SetMaxIdleConns(cm.config.MaxIdleConns)
	db.SetConnMaxLifetime(cm.config.ConnMaxLife)
	db.SetConnMaxIdleTime(cm.config.ConnMaxIdleTime)

	// Enable foreign keys
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		db.Close()
		storeConnectionErrors.WithLabelValues("sqlite").Inc()
		return fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	cm.sqliteDB = db
	return nil
}

// GetPostgreSQLPool returns the PostgreSQL connection pool
func (cm *ConnectionManager) GetPostgreSQLPool() (*pgxpool.Pool, error) {
	if cm.dbType != config.DatabaseTypePostgreSQL {
		return nil, fmt.Errorf("not a PostgreSQL connection")
	}
	if cm.pgPool == nil {
		return nil, fmt.Errorf("PostgreSQL pool not initialized")
	}
	return cm.pgPool, nil
}

// GetSQLiteDB returns the SQLite database connection
func (cm *ConnectionManager) GetSQLiteDB() (*sql.DB, error) {
	if cm.dbType != config.DatabaseTypeSQLite {
		return nil, fmt.Errorf("not a SQLite connection")
	}
	if cm.sqliteDB == nil {
		return nil, fmt.Errorf("SQLite database not initialized")
	}
	return cm.sqliteDB, nil
}

// GetStdDB returns a standard database/sql DB interface
// For PostgreSQL, it uses pgx stdlib driver
func (cm *ConnectionManager) GetStdDB() (*sql.DB, error) {
	switch cm.dbType {
	case config.DatabaseTypePostgreSQL:
		if cm.pgPool == nil {
			return nil, fmt.Errorf("PostgreSQL pool not initialized")
		}
		return stdlib.OpenDBFromPool(cm.pgPool), nil
	case config.DatabaseTypeSQLite:
		return cm.GetSQLiteDB()
	default:
		return nil, fmt.Errorf("unsupported database type: %s", cm.dbType)
	}
}

// Ping checks database connectivity and measures latency
func (cm *ConnectionManager) Ping(ctx context.Context) error {
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		cm.lastPingAt = start
		cm.lastPingMS = duration.Milliseconds()
		storeQueryDuration.WithLabelValues(string(cm.dbType), "ping").Observe(duration.Seconds())
	}()

	switch cm.dbType {
	case config.DatabaseTypePostgreSQL:
		if cm.pgPool == nil {
			return fmt.Errorf("PostgreSQL pool not initialized")
		}
		return cm.pgPool.Ping(ctx)
	case config.DatabaseTypeSQLite:
		if cm.sqliteDB == nil {
			return fmt.Errorf("SQLite database not initialized")
		}
		return cm.sqliteDB.PingContext(ctx)
	default:
		return fmt.Errorf("unsupported database type: %s", cm.dbType)
	}
}

// HealthCheck performs a health check and returns status
func (cm *ConnectionManager) HealthCheck(ctx context.Context) HealthStatus {
	status := HealthStatus{
		Type:        string(cm.dbType),
		Status:      "healthy",
		LastCheckAt: time.Now(),
	}

	// Perform ping
	if err := cm.Ping(ctx); err != nil {
		status.Status = "unhealthy"
		status.Error = err.Error()
		return status
	}

	status.LatencyMS = cm.lastPingMS

	// Get connection stats
	switch cm.dbType {
	case config.DatabaseTypePostgreSQL:
		if cm.pgPool != nil {
			stats := cm.pgPool.Stat()
			status.Connections = ConnectionStats{
				Total:    int(stats.TotalConns()),
				Idle:     int(stats.IdleConns()),
				InUse:    int(stats.TotalConns() - stats.IdleConns()),
				MaxConns: int(stats.MaxConns()),
			}
		}
	case config.DatabaseTypeSQLite:
		if cm.sqliteDB != nil {
			stats := cm.sqliteDB.Stats()
			status.Connections = ConnectionStats{
				Total:    stats.OpenConnections,
				Idle:     stats.Idle,
				InUse:    stats.InUse,
				MaxConns: stats.MaxOpenConnections,
			}
		}
	}

	// Simple query test
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	start := time.Now()
	var result int
	err := cm.queryRow(ctx, "SELECT 1", &result)
	status.QueryLatencyMS = time.Since(start).Milliseconds()

	if err != nil {
		status.Status = "degraded"
		status.Error = fmt.Sprintf("query test failed: %v", err)
	}

	return status
}

// queryRow executes a simple query for health checks
func (cm *ConnectionManager) queryRow(ctx context.Context, query string, dest *int) error {
	switch cm.dbType {
	case config.DatabaseTypePostgreSQL:
		return cm.pgPool.QueryRow(ctx, query).Scan(dest)
	case config.DatabaseTypeSQLite:
		return cm.sqliteDB.QueryRowContext(ctx, query).Scan(dest)
	default:
		return fmt.Errorf("unsupported database type: %s", cm.dbType)
	}
}

// startMetricsCollection starts background metrics collection
func (cm *ConnectionManager) startMetricsCollection() {
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			cm.collectMetrics()
		}
	}()
}

// collectMetrics collects connection pool metrics
func (cm *ConnectionManager) collectMetrics() {
	switch cm.dbType {
	case config.DatabaseTypePostgreSQL:
		if cm.pgPool != nil {
			stats := cm.pgPool.Stat()
			storeConnectionsOpen.WithLabelValues("postgres").Set(float64(stats.TotalConns()))
			storeConnectionsIdle.WithLabelValues("postgres").Set(float64(stats.IdleConns()))
			storeConnectionsInUse.WithLabelValues("postgres").Set(float64(stats.TotalConns() - stats.IdleConns()))
		}
	case config.DatabaseTypeSQLite:
		if cm.sqliteDB != nil {
			stats := cm.sqliteDB.Stats()
			storeConnectionsOpen.WithLabelValues("sqlite").Set(float64(stats.OpenConnections))
			storeConnectionsIdle.WithLabelValues("sqlite").Set(float64(stats.Idle))
			storeConnectionsInUse.WithLabelValues("sqlite").Set(float64(stats.InUse))
		}
	}
}

// Close closes all database connections
func (cm *ConnectionManager) Close() error {
	switch cm.dbType {
	case config.DatabaseTypePostgreSQL:
		if cm.pgPool != nil {
			cm.pgPool.Close()
		}
	case config.DatabaseTypeSQLite:
		if cm.sqliteDB != nil {
			return cm.sqliteDB.Close()
		}
	}
	return nil
}

// HealthStatus represents database health status
type HealthStatus struct {
	Type           string          `json:"type"`
	Status         string          `json:"status"`
	LatencyMS      int64           `json:"latency_ms"`
	QueryLatencyMS int64           `json:"query_latency_ms"`
	Connections    ConnectionStats `json:"connections"`
	LastCheckAt    time.Time       `json:"last_check_at"`
	Error          string          `json:"error,omitempty"`
}

// ConnectionStats represents connection pool statistics
type ConnectionStats struct {
	Total    int `json:"total"`
	Idle     int `json:"idle"`
	InUse    int `json:"in_use"`
	MaxConns int `json:"max_connections"`
}

// RecordQueryDuration records query execution time for metrics
func RecordQueryDuration(dbType string, operation string, duration time.Duration) {
	storeQueryDuration.WithLabelValues(dbType, operation).Observe(duration.Seconds())
}
