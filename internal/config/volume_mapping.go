package config

import (
	"fmt"
	"os"
	"strings"
)

// VolumeMountMapping represents a mapping between a Docker volume and its container mount path
type VolumeMountMapping struct {
	VolumeID      string `json:"volume_id"`
	ContainerPath string `json:"container_path"`
	Description   string `json:"description,omitempty"`
}

// VolumeMappingConfig handles volume-to-path mappings for scanning
type VolumeMappingConfig struct {
	mappings map[string]string // volumeID -> containerPath
}

// NewVolumeMappingConfig creates a new volume mapping configuration
func NewVolumeMappingConfig() *VolumeMappingConfig {
	config := &VolumeMappingConfig{
		mappings: make(map[string]string),
	}

	// Load mappings from environment variables
	config.loadFromEnvironment()

	return config
}

// loadFromEnvironment loads volume mappings from environment variables
// Format: VV_VOLUME_MAPPING_<VOLUME_NAME>=<CONTAINER_PATH>
// Example: VV_VOLUME_MAPPING_MOVIES_DEV=/cifs/movies
func (c *VolumeMappingConfig) loadFromEnvironment() {
	const prefix = "VV_VOLUME_MAPPING_"

	for _, env := range os.Environ() {
		if strings.HasPrefix(env, prefix) {
			parts := strings.SplitN(env, "=", 2)
			if len(parts) != 2 {
				continue
			}

			// Extract volume name from env var name
			envKey := parts[0]
			containerPath := parts[1]
			volumeName := strings.ToLower(strings.TrimPrefix(envKey, prefix))

			// Convert underscores back to volume naming convention
			volumeID := strings.ReplaceAll(volumeName, "_", "_")

			if containerPath != "" {
				c.mappings[volumeID] = containerPath
			}
		}
	}
}

// AddMapping adds a volume mapping
func (c *VolumeMappingConfig) AddMapping(volumeID, containerPath string) {
	c.mappings[volumeID] = containerPath
}

// GetContainerPath returns the container path for a volume, or empty string if not mapped
func (c *VolumeMappingConfig) GetContainerPath(volumeID string) (string, bool) {
	path, exists := c.mappings[volumeID]
	return path, exists
}

// GetAllMappings returns all configured mappings
func (c *VolumeMappingConfig) GetAllMappings() map[string]string {
	result := make(map[string]string)
	for k, v := range c.mappings {
		result[k] = v
	}
	return result
}

// HasMappings returns true if any mappings are configured
func (c *VolumeMappingConfig) HasMappings() bool {
	return len(c.mappings) > 0
}

// String returns a human-readable representation of the mappings
func (c *VolumeMappingConfig) String() string {
	if len(c.mappings) == 0 {
		return "No volume mappings configured"
	}

	var parts []string
	for volumeID, path := range c.mappings {
		parts = append(parts, fmt.Sprintf("%s -> %s", volumeID, path))
	}
	return fmt.Sprintf("Volume mappings: %s", strings.Join(parts, ", "))
}
