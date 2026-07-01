/**
 * VolumeScanProgress Component Types
 */

export interface VolumeScanProgressProps {
  /**
   * Scan status
   */
  scanStatus: string | null | undefined;

  /**
   * File count (if scan completed)
   */
  fileCount?: number | null;

  /**
   * Last scan timestamp
   */
  lastScanAt?: string | null;

  /**
   * Show last scan time
   * @default true
   */
  showLastScan?: boolean;

  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Additional CSS classes
   */
  className?: string;
}
