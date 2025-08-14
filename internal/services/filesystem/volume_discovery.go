package filesystem

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/services/docker"
	"github.com/mantonx/volumeviz/internal/store"
)

// VolumeDiscoveryService handles discovery and persistence of Docker volumes
type VolumeDiscoveryService struct {
	dockerService *docker.DockerService
	store         store.Store
	config        VolumeDiscoveryConfig
	
	// Discovery state
	lastScan      time.Time
	lastScanMutex sync.RWMutex
	
	// Metrics
	discoveredCount int64
	updatedCount    int64
	errorCount      int64
	statsMutex      sync.RWMutex
}

// VolumeDiscoveryConfig holds configuration for volume discovery
type VolumeDiscoveryConfig struct {
	// Discovery settings
	Enabled         bool          `yaml:"enabled" env:"VV_DISCOVERY_ENABLED" envDefault:"true"`
	Interval        time.Duration `yaml:"interval" env:"VV_DISCOVERY_INTERVAL" envDefault:"5m"`
	InitialDelay    time.Duration `yaml:"initial_delay" env:"VV_DISCOVERY_INITIAL_DELAY" envDefault:"10s"`
	
	// Volume filtering
	IncludeDrivers  []string      `yaml:"include_drivers" env:"VV_DISCOVERY_INCLUDE_DRIVERS"`
	ExcludeDrivers  []string      `yaml:"exclude_drivers" env:"VV_DISCOVERY_EXCLUDE_DRIVERS"`
	IncludeLabels   []string      `yaml:"include_labels" env:"VV_DISCOVERY_INCLUDE_LABELS"`
	ExcludeLabels   []string      `yaml:"exclude_labels" env:"VV_DISCOVERY_EXCLUDE_LABELS"`
	
	// Performance
	ConcurrentScans int           `yaml:"concurrent_scans" env:"VV_DISCOVERY_CONCURRENT_SCANS" envDefault:"3"`
	Timeout         time.Duration `yaml:"timeout" env:"VV_DISCOVERY_TIMEOUT" envDefault:"30s"`
}

// DefaultVolumeDiscoveryConfig returns default configuration
func DefaultVolumeDiscoveryConfig() VolumeDiscoveryConfig {
	return VolumeDiscoveryConfig{
		Enabled:         true,
		Interval:        5 * time.Minute,
		InitialDelay:    10 * time.Second,
		ConcurrentScans: 3,
		Timeout:         30 * time.Second,
	}
}

// VolumeDiscoveryStats holds discovery statistics
type VolumeDiscoveryStats struct {
	LastScan        time.Time `json:"last_scan"`
	DiscoveredCount int64     `json:"discovered_count"`
	UpdatedCount    int64     `json:"updated_count"`
	ErrorCount      int64     `json:"error_count"`
	IsRunning       bool      `json:"is_running"`
}

// NewVolumeDiscoveryService creates a new volume discovery service
func NewVolumeDiscoveryService(dockerService *docker.DockerService, store store.Store, config VolumeDiscoveryConfig) *VolumeDiscoveryService {
	return &VolumeDiscoveryService{
		dockerService: dockerService,
		store:         store,
		config:        config,
	}
}

// Start starts the volume discovery service
func (vds *VolumeDiscoveryService) Start(ctx context.Context) error {
	if !vds.config.Enabled {
		log.Printf("[INFO] Volume discovery disabled")
		return nil
	}

	log.Printf("[INFO] Starting volume discovery service (interval: %v)", vds.config.Interval)

	// Perform initial discovery after delay
	go func() {
		select {
		case <-time.After(vds.config.InitialDelay):
			if err := vds.DiscoverVolumes(ctx); err != nil {
				log.Printf("[ERROR] Initial volume discovery failed: %v", err)
			}
		case <-ctx.Done():
			return
		}

		// Start periodic discovery
		ticker := time.NewTicker(vds.config.Interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if err := vds.DiscoverVolumes(ctx); err != nil {
					log.Printf("[ERROR] Periodic volume discovery failed: %v", err)
					vds.incrementErrorCount()
				}
			case <-ctx.Done():
				log.Printf("[INFO] Volume discovery service stopped")
				return
			}
		}
	}()

	return nil
}

// DiscoverVolumes discovers and persists Docker volumes
func (vds *VolumeDiscoveryService) DiscoverVolumes(ctx context.Context) error {
	vds.setLastScan(time.Now())
	log.Printf("[INFO] Starting volume discovery")

	// Check Docker connection
	if !vds.dockerService.IsConnected(ctx) {
		return fmt.Errorf("Docker daemon not connected")
	}

	// List all volumes from Docker
	dockerVolumes, err := vds.dockerService.ListVolumes(ctx)
	if err != nil {
		return fmt.Errorf("failed to list Docker volumes: %w", err)
	}

	log.Printf("[INFO] Found %d volumes from Docker", len(dockerVolumes))

	// Filter volumes based on configuration
	filteredVolumes := vds.filterVolumes(dockerVolumes)
	log.Printf("[INFO] %d volumes after filtering", len(filteredVolumes))

	// Persist volumes to database
	return vds.persistVolumes(ctx, filteredVolumes)
}

// persistVolumes persists volumes to the database using the store
func (vds *VolumeDiscoveryService) persistVolumes(ctx context.Context, volumes []models.Volume) error {
	discoveredCount := 0
	updatedCount := 0

	for _, vol := range volumes {
		// Check if volume already exists
		existing, err := vds.store.Volumes().GetVolumeByVolumeID(ctx, vol.VolumeID)
		if err != nil && err.Error() != "volume not found" {
			log.Printf("[ERROR] Failed to check existing volume %s: %v", vol.VolumeID, err)
			continue
		}

		if existing == nil {
			// Create new volume
			createParams := models.CreateVolumeParams{
				VolumeID:   vol.VolumeID,
				Name:       vol.Name,
				Driver:     vol.Driver,
				Mountpoint: vol.Mountpoint,
				Labels:     vol.Labels,
				Options:    vol.Options,
				Scope:      vol.Scope,
				Status:     "active",
				IsActive:   true,
			}

			created, err := vds.store.Volumes().CreateVolume(ctx, createParams)
			if err != nil {
				log.Printf("[ERROR] Failed to create volume %s: %v", vol.VolumeID, err)
				continue
			}

			log.Printf("[INFO] Discovered new volume: %s (id: %d)", created.VolumeID, created.ID)
			discoveredCount++
		} else {
			// Update existing volume
			updateParams := models.UpdateVolumeParams{
				ID:         existing.ID,
				Driver:     vol.Driver,
				Mountpoint: vol.Mountpoint,
				Labels:     vol.Labels,
				Options:    vol.Options,
				Scope:      vol.Scope,
				Status:     "active",
				IsActive:   true,
			}

			updated, err := vds.store.Volumes().UpdateVolume(ctx, updateParams)
			if err != nil {
				log.Printf("[ERROR] Failed to update volume %s: %v", vol.VolumeID, err)
				continue
			}

			log.Printf("[DEBUG] Updated volume: %s", updated.VolumeID)
			updatedCount++
		}
	}

	// Mark volumes that are no longer in Docker as inactive
	if err := vds.markMissingVolumesInactive(ctx, volumes); err != nil {
		log.Printf("[ERROR] Failed to mark missing volumes inactive: %v", err)
	}

	vds.updateStats(int64(discoveredCount), int64(updatedCount))
	log.Printf("[INFO] Volume discovery completed: %d discovered, %d updated", discoveredCount, updatedCount)

	return nil
}

// markMissingVolumesInactive marks volumes that are no longer in Docker as inactive
func (vds *VolumeDiscoveryService) markMissingVolumesInactive(ctx context.Context, dockerVolumes []models.Volume) error {
	// Get all active volumes from database
	allVolumes, err := vds.store.Volumes().ListVolumes(ctx, 1000, 0) // TODO: Add pagination for large volume counts
	if err != nil {
		return fmt.Errorf("failed to list stored volumes: %w", err)
	}

	// Create map of Docker volume IDs for quick lookup
	dockerVolumeMap := make(map[string]bool)
	for _, vol := range dockerVolumes {
		dockerVolumeMap[vol.VolumeID] = true
	}

	// Mark volumes not in Docker as inactive
	for _, storedVol := range allVolumes {
		if storedVol.IsActive && !dockerVolumeMap[storedVol.VolumeID] {
			updateParams := models.UpdateVolumeParams{
				ID:       storedVol.ID,
				Status:   "inactive",
				IsActive: false,
			}

			_, err := vds.store.Volumes().UpdateVolume(ctx, updateParams)
			if err != nil {
				log.Printf("[ERROR] Failed to mark volume %s as inactive: %v", storedVol.VolumeID, err)
				continue
			}

			log.Printf("[INFO] Marked volume %s as inactive (no longer in Docker)", storedVol.VolumeID)
		}
	}

	return nil
}

// filterVolumes filters volumes based on configuration
func (vds *VolumeDiscoveryService) filterVolumes(volumes []models.Volume) []models.Volume {
	if len(vds.config.IncludeDrivers) == 0 && len(vds.config.ExcludeDrivers) == 0 &&
		len(vds.config.IncludeLabels) == 0 && len(vds.config.ExcludeLabels) == 0 {
		return volumes // No filtering configured
	}

	var filtered []models.Volume

	for _, vol := range volumes {
		// Check driver filters
		if len(vds.config.IncludeDrivers) > 0 {
			included := false
			for _, driver := range vds.config.IncludeDrivers {
				if vol.Driver == driver {
					included = true
					break
				}
			}
			if !included {
				continue
			}
		}

		if len(vds.config.ExcludeDrivers) > 0 {
			excluded := false
			for _, driver := range vds.config.ExcludeDrivers {
				if vol.Driver == driver {
					excluded = true
					break
				}
			}
			if excluded {
				continue
			}
		}

		// Check label filters
		if len(vds.config.IncludeLabels) > 0 {
			included := false
			for _, label := range vds.config.IncludeLabels {
				if _, exists := vol.Labels[label]; exists {
					included = true
					break
				}
			}
			if !included {
				continue
			}
		}

		if len(vds.config.ExcludeLabels) > 0 {
			excluded := false
			for _, label := range vds.config.ExcludeLabels {
				if _, exists := vol.Labels[label]; exists {
					excluded = true
					break
				}
			}
			if excluded {
				continue
			}
		}

		filtered = append(filtered, vol)
	}

	return filtered
}

// GetStats returns current discovery statistics
func (vds *VolumeDiscoveryService) GetStats() VolumeDiscoveryStats {
	vds.lastScanMutex.RLock()
	lastScan := vds.lastScan
	vds.lastScanMutex.RUnlock()

	vds.statsMutex.RLock()
	discoveredCount := vds.discoveredCount
	updatedCount := vds.updatedCount
	errorCount := vds.errorCount
	vds.statsMutex.RUnlock()

	return VolumeDiscoveryStats{
		LastScan:        lastScan,
		DiscoveredCount: discoveredCount,
		UpdatedCount:    updatedCount,
		ErrorCount:      errorCount,
		IsRunning:       vds.config.Enabled,
	}
}

// Helper methods for thread-safe state management

func (vds *VolumeDiscoveryService) setLastScan(t time.Time) {
	vds.lastScanMutex.Lock()
	vds.lastScan = t
	vds.lastScanMutex.Unlock()
}

func (vds *VolumeDiscoveryService) updateStats(discovered, updated int64) {
	vds.statsMutex.Lock()
	vds.discoveredCount += discovered
	vds.updatedCount += updated
	vds.statsMutex.Unlock()
}

func (vds *VolumeDiscoveryService) incrementErrorCount() {
	vds.statsMutex.Lock()
	vds.errorCount++
	vds.statsMutex.Unlock()
}