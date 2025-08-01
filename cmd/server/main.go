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

func main() {
	// Load configuration
	cfg := config.Load()

	// Set Gin mode
	gin.SetMode(cfg.Server.Mode)

	// Initialize Docker service
	dockerService, err := services.NewDockerService(cfg.Docker.Host, cfg.Docker.Timeout)
	if err != nil {
		log.Fatalf("Failed to initialize Docker service: %v", err)
	}
	defer dockerService.Close()

	// Setup v1 API router
	apiRouter := v1.NewRouter(dockerService)
	router := apiRouter.Engine()

	// Create server
	srv := &http.Server{
		Addr:    fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port),
		Handler: router,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Starting VolumeViz server on %s:%s", cfg.Server.Host, cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
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
	
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited gracefully")
}

