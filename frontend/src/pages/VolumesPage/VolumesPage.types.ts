/**
 * Props for the main VolumesPage component.
 *
 * Currently the VolumesPage doesn't require any props as it manages
 * its own state through Jotai atoms and API services.
 */
export interface VolumesPageProps {
  // No props required currently - future extensibility placeholder
}

/**
 * Props for the VolumeCard component.
 *
 * Represents an individual Docker volume with all its metadata
 * and status information for display in the volumes grid.
 */
export interface VolumeCardProps {
  /**
   * Docker volume data object containing:
   * - volume_id: Unique identifier for the volume
   * - name: Human-readable volume name
   * - driver: Storage driver (local, nfs, etc.)
   * - is_active: Whether volume is currently in use
   * - mountpoint: Filesystem path where volume is mounted
   * - container_count: Number of containers using this volume
   * - labels: Key-value metadata labels
   * - created_at: Volume creation timestamp
   */
  volume: {
    volume_id?: string;
    name?: string;
    driver?: string;
    is_active?: boolean;
    mountpoint?: string;
    container_count?: number;
    labels?: Record<string, string>;
    created_at?: string;
  };
}
