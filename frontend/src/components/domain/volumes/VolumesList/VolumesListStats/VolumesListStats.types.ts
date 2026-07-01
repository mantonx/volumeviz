/**
 * VolumesListStats Component Types
 */

export interface Volume {
  id: string;
  name: string;
  size_bytes?: number;
  is_tracked?: boolean;
}

export interface VolumesListStatsProps {
  /**
   * Volumes currently displayed
   */
  volumes: Volume[];

  /**
   * Total number of volumes across all pages
   */
  totalVolumes: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}
