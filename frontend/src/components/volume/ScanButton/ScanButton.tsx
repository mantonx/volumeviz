import React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Scan, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import {
  scanLoadingAtom,
  scanResultsAtom,
  scanErrorAtom,
} from '../../../store/atoms/volumes';
import { useVolumes } from '../../../api/services';

export interface ScanButtonProps {
  volumeId: string;
  variant?: 'default' | 'icon' | 'compact';
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  onScanComplete?: (result: any) => void;
  onScanError?: (scanError: Error) => void;
  className?: string;
}

/**
 * Button component for initiating volume scans in VolumeViz.
 *
 * Features:
 * - Integrated with Jotai state management
 * - Shows scanning progress
 * - Prevents concurrent scans
 * - Error state handling
 * - Multiple visual variants
 * - Customizable callbacks
 *
 * @example
 * ```tsx
 * <ScanButton
 *   volumeId={volume.id}
 *   variant="default"
 *   onScanComplete={(result) => {
 *     console.log('Scan completed:', result);
 *   }}
 * />
 * ```
 */
export const ScanButton: React.FC<ScanButtonProps> = ({
  volumeId,
  variant = 'default',
  size = 'md',
  showStatus = true,
  onScanComplete,
  onScanError,
  className,
}) => {
  const isScanning = useAtomValue(scanLoadingAtom);
  const scanResults = useAtomValue(scanResultsAtom);
  const scanError = useAtomValue(scanErrorAtom);
  const { scanVolume } = useVolumes();
  
  const lastScanResult = scanResults ? scanResults[volumeId] : null;

  const handleScan = async () => {
    if (isScanning) return;

    try {
      // Perform the scan using the hook
      const result = await scanVolume(volumeId);
      onScanComplete?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Scan failed');
      onScanError?.(error);
    }
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const buttonSizeClasses = {
    sm: 'px-2 py-1',
    md: 'px-3 py-1.5',
    lg: 'px-4 py-2',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleScan}
        disabled={isScanning || isScanning}
        className={clsx(
          'rounded-lg transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          buttonSizeClasses[size],
          scanError && 'text-red-600 dark:text-red-400',
          className,
        )}
        title={isScanning ? 'Scanning...' : 'Scan volume'}
      >
        {isScanning || isScanning ? (
          <Loader2 className={clsx(iconSizeClasses[size], 'animate-spin')} />
        ) : scanError ? (
          <AlertCircle className={iconSizeClasses[size]} />
        ) : (
          <Scan className={iconSizeClasses[size]} />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleScan}
        disabled={isScanning || isScanning}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-md',
          'bg-blue-50 dark:bg-blue-900/20',
          'text-blue-600 dark:text-blue-400',
          'hover:bg-blue-100 dark:hover:bg-blue-900/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          buttonSizeClasses[size],
          sizeClasses[size],
          scanError &&
            'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
          className,
        )}
      >
        {isScanning || isScanning ? (
          <Loader2 className={clsx(iconSizeClasses[size], 'animate-spin')} />
        ) : (
          <Scan className={iconSizeClasses[size]} />
        )}
        <span>Scan</span>
      </button>
    );
  }

  // Default variant
  return (
    <div className={clsx('inline-flex flex-col gap-1', className)}>
      <button
        onClick={handleScan}
        disabled={isScanning || isScanning}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg',
          'bg-blue-600 text-white',
          'hover:bg-blue-700',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          buttonSizeClasses[size],
          sizeClasses[size],
          scanError && 'bg-red-600 hover:bg-red-700',
        )}
      >
        {isScanning || isScanning ? (
          <>
            <Loader2 className={clsx(iconSizeClasses[size], 'animate-spin')} />
            <span>Scanning...</span>
          </>
        ) : scanError ? (
          <>
            <AlertCircle className={iconSizeClasses[size]} />
            <span>Retry Scan</span>
          </>
        ) : (
          <>
            <Scan className={iconSizeClasses[size]} />
            <span>Scan Volume</span>
          </>
        )}
      </button>

      {showStatus && (scanError || lastScanResult) && (
        <div className="text-xs">
          {scanError ? (
            <span className="text-red-600 dark:text-red-400">
              {scanError.message}
            </span>
          ) : lastScanResult ? (
            <span className="text-gray-600 dark:text-gray-400">
              Last scan:{' '}
              {new Date(lastScanResult.timestamp).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};
