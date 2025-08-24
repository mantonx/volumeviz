package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
	
	"github.com/mantonx/volumeviz/internal/scheduler"
	"github.com/mantonx/volumeviz/internal/realtime"
	"github.com/mantonx/volumeviz/internal/store/postgres"
	"github.com/mantonx/volumeviz/internal/services/scanner"
	"github.com/mantonx/volumeviz/internal/services/docker"
	"github.com/mantonx/volumeviz/internal/services/enrichers"
	"github.com/mantonx/volumeviz/internal/services/filesystem"
)

func main() {
	fmt.Println("Testing manual resume functionality...")
	
	// Connect to database
	dbURL := "postgres://volumeviz:volumeviz@localhost:5432/volumeviz?sslmode=disable"
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	
	// Create store
	store := postgres.NewStore(db)
	
	// Create progress broadcaster (minimal setup)
	progressBroadcaster := realtime.NewProgressBroadcaster(store)
	
	// Create docker service
	dockerService := docker.NewDockerService()
	
	// Create filesystem indexer (minimal config)
	indexerConfig := filesystem.IndexerConfig{
		DetectMimeTypes: false,
		SkipHidden:     true,
		MaxDepth:       10,
	}
	
	// Create enrichment manager (minimal)
	enrichmentManager := enrichers.NewEnrichmentManager(store, enrichers.EnrichmentConfig{
		Enabled: false, // Keep it simple for testing
	})
	
	// Create volume scanner
	volumeScanner := scanner.NewVolumeScanner(dockerService, store, progressBroadcaster, indexerConfig, nil, enrichmentManager)
	
	// Create resume manager
	resumeManager := scheduler.NewResumeManager(store, volumeScanner, progressBroadcaster)
	
	// Test resume functionality
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	
	fmt.Println("Calling ResumePausedScans...")
	err = resumeManager.ResumePausedScans(ctx)
	if err != nil {
		log.Printf("Resume failed: %v", err)
	} else {
		fmt.Println("Resume operation completed successfully!")
	}
	
	// Get resume stats
	stats := resumeManager.GetResumeStats()
	fmt.Printf("Resume stats: Attempts=%d, Successful=%d, Failed=%d\n", 
		stats.ResumeAttempts, stats.SuccessfulResumes, stats.FailedResumes)
}