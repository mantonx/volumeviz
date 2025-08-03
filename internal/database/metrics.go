// Package database provides metrics collection for database operations
// It integrates with Prometheus for monitoring and observability
package database

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/utils"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Connection metrics
	dbConnectionsTotal = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "volumeviz_db_connections_total",
			Help: "Total number of database connections",
		},
		[]string{"state"}, // open, in_use, idle
	)

	dbConnectionWaitDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "volumeviz_db_connection_wait_duration_seconds",
			Help:    "Time spent waiting for a database connection",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 10), // 1ms to ~1s
		},
	)

	// Query metrics
	dbQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "volumeviz_db_query_duration_seconds",
			Help:    "Database query duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 12), // 1ms to ~4s
		},
		[]string{"operation", "table"},
	)

	dbQueryTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "volumeviz_db_queries_total",
			Help: "Total number of database queries",
		},
		[]string{"operation", "table", "status"}, // status: success, error
	)

	// Transaction metrics
	dbTransactionDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "volumeviz_db_transaction_duration_seconds",
			Help:    "Database transaction duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.01, 2, 10), // 10ms to ~10s
		},
	)

	dbTransactionTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "volumeviz_db_transactions_total",
			Help: "Total number of database transactions",
		},
		[]string{"status"}, // committed, rolled_back, error
	)

	// Migration metrics
	dbMigrationDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "volumeviz_db_migration_duration_seconds",
			Help:    "Database migration duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 10), // 100ms to ~100s
		},
	)

	dbMigrationTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "volumeviz_db_migrations_total",
			Help: "Total number of database migrations",
		},
		[]string{"direction", "status"}, // direction: up, down; status: success, error
	)

	// Table size metrics
	dbTableSize = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "volumeviz_db_table_size_bytes",
			Help: "Size of database tables in bytes",
		},
		[]string{"table"},
	)

	dbTableRows = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "volumeviz_db_table_rows_total",
			Help: "Number of rows in database tables",
		},
		[]string{"table"},
	)

	// Error metrics
	dbErrorTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "volumeviz_db_errors_total",
			Help: "Total number of database errors",
		},
		[]string{"type"}, // connection, query, transaction, migration
	)
)

// MetricsCollector periodically collects database metrics
// It runs in the background and updates Prometheus metrics
type MetricsCollector struct {
	db       *DB
	interval time.Duration
	stopCh   chan struct{}
}

// NewMetricsCollector creates a new metrics collector
// interval determines how often metrics are collected (recommend 30s-1m)
func NewMetricsCollector(db *DB, interval time.Duration) *MetricsCollector {
	return &MetricsCollector{
		db:       db,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins collecting metrics
func (mc *MetricsCollector) Start(ctx context.Context) {
	ticker := time.NewTicker(mc.interval)
	defer ticker.Stop()

	// Collect initial metrics
	mc.collect()

	for {
		select {
		case <-ctx.Done():
			return
		case <-mc.stopCh:
			return
		case <-ticker.C:
			mc.collect()
		}
	}
}

// Stop stops the metrics collector
func (mc *MetricsCollector) Stop() {
	close(mc.stopCh)
}

// collect gathers current metrics
func (mc *MetricsCollector) collect() {
	// Connection pool metrics
	stats := mc.db.Stats()
	dbConnectionsTotal.WithLabelValues("open").Set(float64(stats.OpenConnections))
	dbConnectionsTotal.WithLabelValues("in_use").Set(float64(stats.InUse))
	dbConnectionsTotal.WithLabelValues("idle").Set(float64(stats.Idle))
	
	if stats.WaitDuration > 0 && stats.WaitCount > 0 {
		avgWait := stats.WaitDuration / time.Duration(stats.WaitCount)
		dbConnectionWaitDuration.Observe(avgWait.Seconds())
	}

	// Table size metrics (if needed, run in background)
	go mc.collectTableMetrics()
}

// collectTableMetrics collects table size and row count metrics
func (mc *MetricsCollector) collectTableMetrics() {
	tables := []string{
		"volumes", "volume_sizes", "containers", "container_volumes",
		"scan_jobs", "scan_results", "system_metrics", "alerts",
	}

	for _, table := range tables {
		// Get row count
		var count int64
		query := "SELECT COUNT(*) FROM " + table
		if err := mc.db.QueryRow(query).Scan(&count); err == nil {
			dbTableRows.WithLabelValues(table).Set(float64(count))
		}

		// Get table size (PostgreSQL specific)
		var size int64
		sizeQuery := `
			SELECT pg_total_relation_size($1::regclass)
		`
		if err := mc.db.QueryRow(sizeQuery, table).Scan(&size); err == nil {
			dbTableSize.WithLabelValues(table).Set(float64(size))
		}
	}
}

// RecordQuery records metrics for a database query
// operation: select, insert, update, delete, other
// table: the primary table involved in the query
// duration: how long the query took
// err: any error that occurred (nil for success)
func RecordQuery(operation, table string, duration time.Duration, err error) {
	status := "success"
	if err != nil {
		status = "error"
		dbErrorTotal.WithLabelValues("query").Inc()
	}
	
	dbQueryDuration.WithLabelValues(operation, table).Observe(duration.Seconds())
	dbQueryTotal.WithLabelValues(operation, table, status).Inc()
}

// RecordTransaction records metrics for a database transaction
// duration: total transaction duration from begin to commit/rollback
// status: committed, rolled_back, or error
func RecordTransaction(duration time.Duration, status string) {
	dbTransactionDuration.Observe(duration.Seconds())
	dbTransactionTotal.WithLabelValues(status).Inc()
	
	if status == "error" {
		dbErrorTotal.WithLabelValues("transaction").Inc()
	}
}

// RecordMigration records metrics for a database migration
// direction: up or down
// duration: how long the migration took
// err: any error that occurred during migration
func RecordMigration(direction string, duration time.Duration, err error) {
	status := "success"
	if err != nil {
		status = "error"
		dbErrorTotal.WithLabelValues("migration").Inc()
	}
	
	dbMigrationDuration.Observe(duration.Seconds())
	dbMigrationTotal.WithLabelValues(direction, status).Inc()
}

// RecordConnectionError increments the connection error counter
// Call this when unable to establish or maintain a database connection
func RecordConnectionError() {
	dbErrorTotal.WithLabelValues("connection").Inc()
}

// instrumentedDB wraps a database connection with metrics
type instrumentedDB struct {
	*DB
}

// NewInstrumentedDB creates a new instrumented database connection
func NewInstrumentedDB(db *DB) *instrumentedDB {
	return &instrumentedDB{DB: db}
}

// Query executes a query with metrics
func (idb *instrumentedDB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	start := time.Now()
	rows, err := idb.DB.Query(query, args...)
	RecordQuery("select", extractTableName(query), time.Since(start), err)
	return rows, err
}

// Exec executes a statement with metrics
func (idb *instrumentedDB) Exec(query string, args ...interface{}) (sql.Result, error) {
	start := time.Now()
	operation := extractOperation(query)
	table := extractTableName(query)
	result, err := idb.DB.Exec(query, args...)
	RecordQuery(operation, table, time.Since(start), err)
	return result, err
}

// BeginTx starts a transaction with metrics
func (idb *instrumentedDB) BeginTx() (*instrumentedTx, error) {
	start := time.Now()
	tx, err := idb.DB.BeginTx()
	if err != nil {
		RecordTransaction(time.Since(start), "error")
		return nil, err
	}
	return &instrumentedTx{Tx: tx, start: start}, nil
}

// instrumentedTx wraps a transaction with metrics
type instrumentedTx struct {
	*Tx
	start time.Time
}

// Commit commits the transaction with metrics
func (itx *instrumentedTx) Commit() error {
	err := itx.Tx.Commit()
	status := "committed"
	if err != nil {
		status = "error"
	}
	RecordTransaction(time.Since(itx.start), status)
	return err
}

// Rollback rolls back the transaction with metrics
func (itx *instrumentedTx) Rollback() error {
	err := itx.Tx.Rollback()
	RecordTransaction(time.Since(itx.start), "rolled_back")
	return err
}

// extractOperation identifies the SQL operation type from a query
// Handles CTEs and returns lowercase operation name
func extractOperation(query string) string {
	query = utils.TrimAndUpper(query)
	
	// Handle WITH clause (CTE)
	if strings.HasPrefix(query, "WITH") {
		// Find the actual operation after the CTE
		if utils.ContainsAny(query, "SELECT") {
			return "select"
		} else if utils.ContainsAny(query, "INSERT") {
			return "insert"
		} else if utils.ContainsAny(query, "UPDATE") {
			return "update"
		} else if utils.ContainsAny(query, "DELETE") {
			return "delete"
		}
	}
	
	// Check direct operation prefixes
	if utils.HasAnyPrefix(query, "SELECT") {
		return "select"
	} else if utils.HasAnyPrefix(query, "INSERT") {
		return "insert"
	} else if utils.HasAnyPrefix(query, "UPDATE") {
		return "update"
	} else if utils.HasAnyPrefix(query, "DELETE") {
		return "delete"
	}
	return "other"
}

// extractTableName extracts the primary table name from a SQL query
// Handles UPDATE, SELECT, INSERT, and DELETE statements
func extractTableName(query string) string {
	query = utils.TrimAndUpper(query)
	
	// Handle UPDATE statements first (may have FROM clause)
	if strings.HasPrefix(query, "UPDATE") {
		tablePart := utils.SplitAndGetAfter(query, "UPDATE")
		if firstWord := utils.ExtractFirstWord(tablePart); firstWord != "" {
			// Get the table name, removing any alias
			tableName := utils.SafeLower(firstWord)
			// Remove alias if present (e.g., "volumes v" -> "volumes")
			if spaceIdx := strings.Index(tableName, " "); spaceIdx > 0 {
				tableName = tableName[:spaceIdx]
			}
			return tableName
		}
	}
	
	// Handle SELECT/DELETE with FROM clause
	if strings.Contains(query, "FROM") {
		tablePart := utils.SplitAndGetAfter(query, "FROM")
		if firstWord := utils.ExtractFirstWord(tablePart); firstWord != "" {
			return utils.SafeLower(firstWord)
		}
	}
	
	// Handle INSERT INTO
	if strings.Contains(query, "INTO") {
		tablePart := utils.SplitAndGetAfter(query, "INTO")
		if firstWord := utils.ExtractFirstWord(tablePart); firstWord != "" {
			return utils.SafeLower(firstWord)
		}
	}
	
	return "unknown"
}

// MetricsMiddleware provides metrics collection for repositories
type MetricsMiddleware struct {
	next Repository
}

// NewMetricsMiddleware creates a new metrics middleware
func NewMetricsMiddleware(repo Repository) *MetricsMiddleware {
	return &MetricsMiddleware{next: repo}
}

// WithTx wraps transaction with metrics
func (mm *MetricsMiddleware) WithTx(tx *Tx) Repository {
	return &MetricsMiddleware{next: mm.next.WithTx(tx)}
}

// BeginTx starts a transaction with metrics
func (mm *MetricsMiddleware) BeginTx() (*Tx, error) {
	start := time.Now()
	tx, err := mm.next.BeginTx()
	if err != nil {
		RecordTransaction(time.Since(start), "error")
	}
	return tx, err
}

// Health returns health status
func (mm *MetricsMiddleware) Health() *HealthStatus {
	return mm.next.Health()
}

// Ping checks database connectivity
func (mm *MetricsMiddleware) Ping() error {
	return mm.next.Ping()
}