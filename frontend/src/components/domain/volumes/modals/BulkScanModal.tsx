/**
 * Bulk Scan Modal Component
 *
 * Displays a confirmation dialog when bulk scanning multiple volumes.
 * Shows summary information including volume count, total size, and scan method.
 */

import React, { useMemo } from 'react';
import { formatBytes } from '@/utils/formatters';

export interface BulkScanModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when scan is confirmed */
  onConfirm: () => void;
  /** Array of volumes to be scanned */
  volumes: Array<{ name: string; size_bytes?: number }>;
  /** Whether the scan operation is in progress */
  isScanning?: boolean;
}

/**
 * BulkScanModal component for confirming bulk volume scans.
 *
 * Features:
 * - Displays count of volumes to be scanned
 * - Shows total size and partial size information
 * - Indicates scan method (progressive scan)
 * - Background scan notification
 * - Disabled state during scanning
 *
 * @example
 * ```tsx
 * <BulkScanModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={handleBulkScan}
 *   volumes={selectedVolumes}
 *   isScanning={mutation.isLoading}
 * />
 * ```
 */
export const BulkScanModal: React.FC<BulkScanModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  volumes,
  isScanning = false,
}) => {
  // Calculate size statistics
  const sizeStats = useMemo(() => {
    const volumesWithSize = volumes.filter(
      (v) => v.size_bytes && v.size_bytes > 0,
    );
    const totalKnownSize = volumes.reduce(
      (sum, v) => sum + (v.size_bytes || 0),
      0,
    );

    return {
      volumesWithSize: volumesWithSize.length,
      totalVolumes: volumes.length,
      totalKnownSize,
      allHaveSize: volumesWithSize.length === volumes.length,
    };
  }, [volumes]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-scan-title"
    >
      <div
        className="bg-surface rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="bulk-scan-title"
          className="text-lg font-medium text-primary mb-4"
        >
          Confirm Bulk Scan
        </h3>

        <div className="mb-6">
          <p className="text-sm text-secondary mb-4">
            You are about to scan{' '}
            <span className="font-semibold">
              {volumes.length} volume{volumes.length !== 1 ? 's' : ''}
            </span>{' '}
            on the current page.
          </p>

          <div className="bg-surface-secondary rounded-md p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Volumes to scan:</span>
              <span className="font-medium text-primary">
                {volumes.length}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-secondary">Known size:</span>
              <span className="font-medium text-primary">
                {sizeStats.allHaveSize
                  ? formatBytes(sizeStats.totalKnownSize)
                  : `${formatBytes(sizeStats.totalKnownSize)} (${sizeStats.volumesWithSize}/${sizeStats.totalVolumes} volumes)`}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-secondary">Method:</span>
              <span className="font-medium text-primary">Progressive scan</span>
            </div>
          </div>

          <p className="text-xs text-tertiary mt-4">
            Note: Scans run in the background. You can continue working while
            volumes are being scanned.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isScanning}
            className="px-4 py-2 text-sm font-medium text-secondary bg-surface border border-line rounded-md hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isScanning}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isScanning ? 'Starting...' : 'Start Scan'}
          </button>
        </div>
      </div>
    </div>
  );
};
