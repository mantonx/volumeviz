package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	v1 "github.com/mantonx/volumeviz/internal/api/v1"
	"github.com/mantonx/volumeviz/internal/config"
	"github.com/mantonx/volumeviz/internal/db"
	"github.com/mantonx/volumeviz/internal/services/docker"
	"github.com/mantonx/volumeviz/internal/store"
	storeconfig "github.com/mantonx/volumeviz/internal/store/config"
	"github.com/mantonx/volumeviz/internal/version"

	_ "github.com/mantonx/volumeviz/docs" // Generated docs
)

// @title VolumeViz API
// @version 1.0
// @description Docker volume monitoring API with comprehensive volume discovery, size calculation, and container attachment tracking. Focus on user-mounted volumes only.
// @description
// @description ## Volume-First Approach
// @description - Automatic discovery and filtering of user-mounted volumes
// @description - Excludes Docker infrastructure volumes (container filesystems, tmp volumes)
// @description - Real-time volume usage monitoring and size calculation
// @description - Container attachment tracking for each volume
// @description
// @description ## Features
// @description - Multi-method volume size calculation (du, find, stat)
// @description - Asynchronous scanning with progress tracking for large volumes
// @description - Real-time WebSocket progress updates during scan operations
// @description - High-performance caching with TTL-based invalidation
// @description - Comprehensive Prometheus metrics integration
// @description - Circuit breaker patterns for resilience
// @description
// @description ## WebSocket API
// @description WebSocket endpoint: `ws://localhost:8080/ws`
// @description
// @description ### Scan Progress Events
// @description Subscribe to real-time scan progress updates:
// @description ```json
// @description {
// @description   "type": "subscribe",
// @description   "event": "scan_progress",
// @description   "data": {
// @description     "volume_id": "volume_id_here",
// @description     "scan_id": "scan_id_here"
// @description   }
// @description }
// @description ```
// @description
// @description Progress updates are broadcast as:
// @description ```json
// @description {
// @description   "type": "scan_progress_update",
// @description   "data": {
// @description     "scan_id": "scan_id",
// @description     "volume_id": "volume_id",
// @description     "overall_status": "running|completed|failed",
// @description     "overall_progress": 75,
// @description     "phases": [
// @description       {
// @description         "phase_name": "volume_scan",
// @description         "status": "completed",
// @description         "progress": 100,
// @description         "items_processed": 1,
// @description         "items_total": 1
// @description       },
// @description       {
// @description         "phase_name": "filesystem_indexing",
// @description         "status": "running",
// @description         "progress": 50,
// @description         "items_processed": 5000,
// @description         "items_total": 10000,
// @description         "items_per_second": 125.5,
// @description         "current_item": "/path/to/current/file"
// @description       },
// @description       {
// @description         "phase_name": "media_enrichment",
// @description         "status": "pending",
// @description         "progress": 0
// @description       }
// @description     ],
// @description     "errors": []
// @description   }
// @description }
// @description ```
// @description
// @description ## Performance SLO
// @description - 95th percentile response time < 500ms for volume listing
// @description - Supports 1000+ volumes with concurrent access
// @description - Memory usage < 100MB during large volume scans
// @termsOfService https://github.com/mantonx/volumeviz

// @contact.name API Support
// @contact.url https://github.com/mantonx/volumeviz/issues
// @contact.email support@volumeviz.io

// @license.name MIT
// @license.url https://github.com/mantonx/volumeviz/blob/main/LICENSE

// @host localhost:8080
// @BasePath /api/v1
// @schemes http https

// @tag.name volumes
// @tag.description Docker volume operations
// @tag.name health
// @tag.description Health check endpoints
// @tag.name system
// @tag.description System information endpoints
// @tag.name scan
// @tag.description Volume scanning operations

// healthCheckAdapter provides health check functionality for the new store architecture
type healthCheckAdapter struct {
	store store.Store
}

func (a *healthCheckAdapter) HealthCheck(ctx context.Context) interface{} {
	// Perform actual health check using store interface
	if err := a.store.Health(ctx); err != nil {
		return map[string]interface{}{
			"type":      "new-store-architecture",
			"status":    "unhealthy",
			"connected": false,
			"error":     err.Error(),
		}
	}
	return map[string]interface{}{
		"type":      "new-store-architecture",
		"status":    "healthy",
		"connected": true,
	}
}

func main() {
	// Print version information
	versionInfo := version.Get()
	log.Printf("Starting VolumeViz %s", versionInfo.Version)
	log.Printf("Build info: commit=%s, date=%s, go=%s, platform=%s",
		versionInfo.GitCommit, versionInfo.BuildDate, versionInfo.GoVersion, versionInfo.Platform)

	// Load configuration
	cfg := config.Load()

	// Set Gin mode
	gin.SetMode(cfg.Server.Mode)

	// Initialize store configuration using config method
	dbConfig := cfg.Database.ToStoreConfig()

	// Use database-specific optimizations
	if dbConfig.Type == storeconfig.DatabaseTypePostgreSQL {
		postgresConfig := storeconfig.DefaultPostgreSQLConfig()
		dbConfig.MaxOpenConns = postgresConfig.MaxOpenConns
		dbConfig.MaxIdleConns = postgresConfig.MaxIdleConns
		dbConfig.ConnMaxLife = postgresConfig.ConnMaxLife
		dbConfig.ConnMaxIdleTime = postgresConfig.ConnMaxIdleTime
		dbConfig.Timeout = postgresConfig.Timeout
	} else if dbConfig.Type == storeconfig.DatabaseTypeSQLite {
		sqliteConfig := storeconfig.DefaultSQLiteConfig()
		dbConfig.MaxOpenConns = sqliteConfig.MaxOpenConns
		dbConfig.MaxIdleConns = sqliteConfig.MaxIdleConns
		dbConfig.ConnMaxLife = sqliteConfig.ConnMaxLife
		dbConfig.ConnMaxIdleTime = sqliteConfig.ConnMaxIdleTime
		dbConfig.Timeout = sqliteConfig.Timeout
	}

	// Initialize database connection
	log.Printf("Initializing %s database connection...", dbConfig.Type)

	// Create store instance
	log.Printf("Creating store instance...")
	var storeInstance store.Store
	switch dbConfig.Type {
	case storeconfig.DatabaseTypePostgreSQL:
		// Build PostgreSQL connection string manually since BuildPostgresDSN doesn't exist yet
		dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
			dbConfig.User, dbConfig.Password, dbConfig.Host, dbConfig.Port, dbConfig.Database)
		ctx := context.Background()
		conn, err := db.ConnectPostgreSQL(ctx, dsn, 10)
		if err != nil {
			log.Fatalf("Failed to connect to PostgreSQL: %v", err)
		}
		storeInstance = store.NewPostgreSQLStore(conn)
	case storeconfig.DatabaseTypeSQLite:
		// Build SQLite DSN - use database path directly
		dsn := dbConfig.Database
		if dsn == "" {
			dsn = "./volumeviz.db" // Default SQLite database file
		}
		ctx := context.Background()
		conn, err := db.ConnectSQLite(ctx, dsn)
		if err != nil {
			log.Fatalf("Failed to connect to SQLite: %v", err)
		}
		storeInstance = store.NewSQLiteStore(conn)
	default:
		log.Fatalf("Unsupported database type: %s (supported types: postgresql, sqlite)", dbConfig.Type)
	}
	log.Printf("Store instance created successfully")

	// Note: Database migrations are now handled by the store layer
	log.Printf("Database migrations managed by store layer")

	// Initialize Docker service
	dockerService, err := docker.NewDockerService(cfg.Docker.Host, cfg.Docker.Timeout)
	if err != nil {
		log.Fatalf("Failed to initialize Docker service: %v", err)
	}
	defer dockerService.Close()

	// Setup v1 API router with store instance
	apiRouter := v1.NewRouter(dockerService, storeInstance, cfg)
	router := apiRouter.Engine()

	// Health handler is now configured with store directly
	log.Printf("Health handler configured with store interface")

	// Start events service if enabled
	if cfg.Events.Enabled && apiRouter.EventsService() != nil {
		if err := apiRouter.EventsService().Start(context.Background()); err != nil {
			log.Printf("[WARN] Failed to start events service: %v", err)
		}
		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if err := apiRouter.EventsService().Stop(ctx); err != nil {
				log.Printf("[ERROR] Failed to stop events service: %v", err)
			}
		}()
	}

	// Create server
	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in goroutine
	go func() {
		if cfg.TLS.Enabled {
			log.Printf("Starting VolumeViz HTTPS server on %s:%s", cfg.Server.Host, cfg.Server.Port)
			log.Printf("Using TLS cert: %s, key: %s", cfg.TLS.CertFile, cfg.TLS.KeyFile)
			if err := srv.ListenAndServeTLS(cfg.TLS.CertFile, cfg.TLS.KeyFile); err != nil && err != http.ErrServerClosed {
				log.Fatalf("Failed to start HTTPS server: %v", err)
			}
		} else {
			log.Printf("Starting VolumeViz HTTP server on %s:%s", cfg.Server.Host, cfg.Server.Port)
			log.Println("⚠️  Running in HTTP mode. For production, enable TLS with TLS_CERT_FILE and TLS_KEY_FILE")
			if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Fatalf("Failed to start HTTP server: %v", err)
			}
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Stop scheduler if running
	if apiRouter.Scheduler() != nil {
		if err := apiRouter.Scheduler().Stop(ctx); err != nil {
			log.Printf("[ERROR] Failed to stop scan scheduler: %v", err)
		}
	}

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited gracefully")
}
