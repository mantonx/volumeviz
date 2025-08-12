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
	"github.com/mantonx/volumeviz/internal/services"
	"github.com/mantonx/volumeviz/internal/store"
	storeconfig "github.com/mantonx/volumeviz/internal/store/config"
	"github.com/mantonx/volumeviz/internal/version"

	_ "github.com/mantonx/volumeviz/docs" // Generated docs
)

// @title VolumeViz API
// @version 1.0
// @description Docker volume monitoring and visualization API
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

// connectionManagerAdapter adapts store.ConnectionManager to health.ConnectionManager
type connectionManagerAdapter struct {
	cm *store.ConnectionManager
}

func (a *connectionManagerAdapter) HealthCheck(ctx context.Context) interface{} {
	status := a.cm.HealthCheck(ctx)
	// Convert to map[string]interface{} for JSON marshaling
	return map[string]interface{}{
		"type":             status.Type,
		"status":           status.Status,
		"latency_ms":       status.LatencyMS,
		"query_latency_ms": status.QueryLatencyMS,
		"connections":      status.Connections,
		"last_check_at":    status.LastCheckAt,
		"error":            status.Error,
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

	// Initialize connection manager for enhanced health checks
	log.Printf("Initializing connection manager for %s database...", dbConfig.Type)
	connManager, err := store.NewConnectionManager(dbConfig)
	if err != nil {
		log.Fatalf("Failed to initialize connection manager: %v", err)
	}
	defer connManager.Close()
	log.Printf("Connection manager initialized successfully")

	// Create store instance from connection manager
	log.Printf("Creating store instance...")
	var storeInstance store.Store
	switch dbConfig.Type {
	case storeconfig.DatabaseTypePostgreSQL:
		storeInstance, err = store.NewPostgresStore(dbConfig)
	case storeconfig.DatabaseTypeSQLite:
		storeInstance, err = store.NewSQLiteStore(dbConfig)
	default:
		log.Fatalf("Unsupported database type: %s", dbConfig.Type)
	}
	if err != nil {
		log.Fatalf("Failed to create store instance: %v", err)
	}
	defer storeInstance.Close()
	log.Printf("Store instance created successfully")

	// Note: Database migrations are now handled by the store layer
	log.Printf("Database migrations managed by store layer")

	// Initialize Docker service
	dockerService, err := services.NewDockerService(cfg.Docker.Host, cfg.Docker.Timeout)
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
