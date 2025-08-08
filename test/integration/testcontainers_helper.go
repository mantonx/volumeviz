package integration

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mantonx/volumeviz/internal/database"
)

// PostgreSQLTestContainer wraps a PostgreSQL testcontainer with helper methods
type PostgreSQLTestContainer struct {
	Container testcontainers.Container
	Host      string
	Port      int
	Database  string
	Username  string
	Password  string
	Config    *database.Config
	DB        *database.DB
}

// NewPostgreSQLTestContainer creates and starts a new PostgreSQL test container
func NewPostgreSQLTestContainer(t *testing.T, dbName, username, password string) *PostgreSQLTestContainer {
	ctx := context.Background()

	// Start PostgreSQL container
	container, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase(dbName),
		postgres.WithUsername(username),
		postgres.WithPassword(password),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(120*time.Second)),
	)
	require.NoError(t, err)

	// Get connection details
	host, err := container.Host(ctx)
	require.NoError(t, err)

	mappedPort, err := container.MappedPort(ctx, "5432")
	require.NoError(t, err)

	port := mappedPort.Int()

	// Create database configuration
	config := &database.Config{
		Host:         host,
		Port:         port,
		User:         username,
		Password:     password,
		Database:     dbName,
		SSLMode:      "disable",
		MaxOpenConns: 10,
		MaxIdleConns: 5,
		ConnMaxLife:  5 * time.Minute,
		Timeout:      30 * time.Second,
	}

	// Connect to database
	db, err := database.NewDB(config)
	require.NoError(t, err)

	// Test connection
	err = db.Ping()
	require.NoError(t, err)

	return &PostgreSQLTestContainer{
		Container: container,
		Host:      host,
		Port:      port,
		Database:  dbName,
		Username:  username,
		Password:  password,
		Config:    config,
		DB:        db,
	}
}

// Close terminates the container and closes the database connection
func (p *PostgreSQLTestContainer) Close(t *testing.T) {
	if p.DB != nil {
		err := p.DB.Close()
		if err != nil {
			t.Logf("Warning: Failed to close database connection: %v", err)
		}
	}

	if p.Container != nil {
		err := testcontainers.TerminateContainer(p.Container)
		if err != nil {
			t.Logf("Warning: Failed to terminate container: %v", err)
		}
	}
}

// ApplyMigrations applies all pending database migrations
func (p *PostgreSQLTestContainer) ApplyMigrations(t *testing.T) {
	migrationMgr := database.NewMigrationManager(p.DB)
	err := migrationMgr.ApplyAllPending()
	require.NoError(t, err)
}

// CreateTestVolume creates a test volume record in the database
func (p *PostgreSQLTestContainer) CreateTestVolume(t *testing.T, volumeID, name string) *database.Volume {
	repo := database.NewVolumeRepository(p.DB)
	
	now := time.Now()
	volume := &database.Volume{
		VolumeID:    volumeID,
		Name:        name,
		Driver:      "local",
		Mountpoint:  fmt.Sprintf("/var/lib/docker/volumes/%s/_data", name),
		Labels:      database.Labels{"test": "true", "integration": "testcontainers"},
		Options:     database.Labels{"type": "none"},
		Scope:       "local",
		Status:      "active",
		IsActive:    true,
		LastScanned: &now,
	}

	err := repo.Create(volume)
	require.NoError(t, err)

	return volume
}

// CreateTestScanJob creates a test scan job record in the database
func (p *PostgreSQLTestContainer) CreateTestScanJob(t *testing.T, scanID, volumeID string) *database.ScanJob {
	repo := database.NewScanJobRepository(p.DB)
	
	duration := 30 * time.Second
	job := &database.ScanJob{
		ScanID:            scanID,
		VolumeID:          volumeID,
		Status:            "queued",
		Progress:          0,
		Method:            "du",
		EstimatedDuration: &duration,
	}

	err := repo.Create(job)
	require.NoError(t, err)

	return job
}

// CreateTestData creates a set of test data for integration tests
func (p *PostgreSQLTestContainer) CreateTestData(t *testing.T) {
	// Create test volumes
	volumes := []struct {
		VolumeID string
		Name     string
	}{
		{"test_vol_001", "integration-test-volume-1"},
		{"test_vol_002", "integration-test-volume-2"},
		{"test_vol_003", "integration-test-volume-3"},
	}

	for _, v := range volumes {
		p.CreateTestVolume(t, v.VolumeID, v.Name)
	}

	// Create test scan jobs
	scanJobs := []struct {
		ScanID   string
		VolumeID string
	}{
		{"scan_001", "test_vol_001"},
		{"scan_002", "test_vol_002"},
		{"scan_003", "test_vol_003"},
	}

	for _, s := range scanJobs {
		p.CreateTestScanJob(t, s.ScanID, s.VolumeID)
	}

	t.Logf("Created test data: %d volumes, %d scan jobs", len(volumes), len(scanJobs))
}

// WaitForHealthy waits for the database to be healthy
func (p *PostgreSQLTestContainer) WaitForHealthy(t *testing.T, timeout time.Duration) {
	start := time.Now()
	for time.Since(start) < timeout {
		health := p.DB.Health()
		if health.Status == "healthy" {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	
	require.Fail(t, "Database failed to become healthy within timeout")
}

// GetConnectionString returns the PostgreSQL connection string
func (p *PostgreSQLTestContainer) GetConnectionString() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		p.Username, p.Password, p.Host, p.Port, p.Database)
}

// ExecuteSQL executes raw SQL against the test database
func (p *PostgreSQLTestContainer) ExecuteSQL(t *testing.T, query string, args ...interface{}) {
	_, err := p.DB.Exec(query, args...)
	require.NoError(t, err)
}

// QueryRowSQL executes a query and scans the result into dest
func (p *PostgreSQLTestContainer) QueryRowSQL(t *testing.T, query string, dest interface{}, args ...interface{}) {
	err := p.DB.QueryRow(query, args...).Scan(dest)
	require.NoError(t, err)
}

// TestContainerCleanup is a helper for test cleanup
type TestContainerCleanup struct {
	containers []*PostgreSQLTestContainer
}

// NewTestContainerCleanup creates a new cleanup helper
func NewTestContainerCleanup() *TestContainerCleanup {
	return &TestContainerCleanup{
		containers: make([]*PostgreSQLTestContainer, 0),
	}
}

// Add adds a container to the cleanup list
func (c *TestContainerCleanup) Add(container *PostgreSQLTestContainer) {
	c.containers = append(c.containers, container)
}

// Cleanup closes all registered containers
func (c *TestContainerCleanup) Cleanup(t *testing.T) {
	for _, container := range c.containers {
		container.Close(t)
	}
}

// WithPostgreSQLContainer is a test helper that creates a PostgreSQL container for the test duration
func WithPostgreSQLContainer(t *testing.T, dbName string, testFunc func(*PostgreSQLTestContainer)) {
	container := NewPostgreSQLTestContainer(t, dbName, "test_user", "test_password")
	defer container.Close(t)
	
	// Apply migrations
	container.ApplyMigrations(t)
	
	// Wait for healthy status
	container.WaitForHealthy(t, 30*time.Second)
	
	// Run the test
	testFunc(container)
}

// DockerRequiredOrSkip skips the test if Docker is not available
func DockerRequiredOrSkip(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping Docker-based integration test in short mode")
	}

	// Try to create a simple container to check if Docker is available
	ctx := context.Background()
	req := testcontainers.ContainerRequest{
		Image:        "alpine:latest",
		Cmd:          []string{"echo", "test"},
		WaitingFor:   wait.ForExit(),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})

	if err != nil {
		t.Skipf("Docker not available: %v", err)
	}

	// Clean up test container
	defer func() {
		if container != nil {
			_ = testcontainers.TerminateContainer(container)
		}
	}()
}