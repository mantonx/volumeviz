package database

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
)

// Config holds database configuration
type Config struct {
	Host         string        `yaml:"host" env:"DB_HOST"`
	Port         int           `yaml:"port" env:"DB_PORT"`
	User         string        `yaml:"user" env:"DB_USER"`
	Password     string        `yaml:"password" env:"DB_PASSWORD"`
	Database     string        `yaml:"database" env:"DB_NAME"`
	SSLMode      string        `yaml:"ssl_mode" env:"DB_SSL_MODE"`
	MaxOpenConns int           `yaml:"max_open_conns" env:"DB_MAX_OPEN_CONNS"`
	MaxIdleConns int           `yaml:"max_idle_conns" env:"DB_MAX_IDLE_CONNS"`
	ConnMaxLife  time.Duration `yaml:"conn_max_life" env:"DB_CONN_MAX_LIFE"`
	Timeout      time.Duration `yaml:"timeout" env:"DB_TIMEOUT"`
}

// DefaultConfig returns database configuration with sensible defaults
func DefaultConfig() *Config {
	return &Config{
		Host:         "localhost",
		Port:         5432,
		User:         "volumeviz",
		Password:     "volumeviz",
		Database:     "volumeviz",
		SSLMode:      "disable",
		MaxOpenConns: 25,
		MaxIdleConns: 10,
		ConnMaxLife:  30 * time.Minute,
		Timeout:      30 * time.Second,
	}
}

// DSN returns the PostgreSQL connection string
func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s connect_timeout=%d",
		c.Host, c.Port, c.User, c.Password, c.Database, c.SSLMode, int(c.Timeout.Seconds()),
	)
}

// DB represents the database connection pool
type DB struct {
	*sql.DB
	config *Config
}

// NewDB creates a new database connection with proper configuration
func NewDB(config *Config) (*DB, error) {
	sqlDB, err := sql.Open("postgres", config.DSN())
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	sqlDB.SetMaxOpenConns(config.MaxOpenConns)
	sqlDB.SetMaxIdleConns(config.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(config.ConnMaxLife)

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db := &DB{
		DB:     sqlDB,
		config: config,
	}

	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.DB.Close()
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