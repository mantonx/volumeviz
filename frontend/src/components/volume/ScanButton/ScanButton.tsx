import React from 'react';
import { Scan, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useVolumeScanning } from '../../../api/services';
import { useToast } from '../../ui/Toast/ToastProvider';
import { DetailedScanButton } from './DetailedScanButton';

export interface ScanButtonProps {
  volumeId: string;
  variant?: 'default' | 'icon' | 'compact' | 'detailed';
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  showProgress?: boolean;
  showPhases?: boolean;
  disabled?: boolean;
  onScanComplete?: (result: any) => void;
  onScanError?: (scanError: Error) => void;
  className?: string;
  /** @deprecated Use showProgress instead */
  legacy?: boolean;
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
  variant = 'icon',
  size = 'sm',
  showStatus = false,
  showProgress = true,
  showPhases = false,
  disabled = false,
  onScanComplete,
  onScanError,
  className,
  legacy = false,
}) => {
  const { scanVolume, scanLoading } = useVolumeScanning();
  const { success, error: showError } = useToast();
  const isScanning = scanLoading[volumeId] || false;
  const isDisabled = disabled || isScanning;

  // Use legacy implementation if requested
  if (legacy) {
    const handleScan = async () => {
      if (isDisabled) return;

      try {
        const result = await scanVolume(volumeId);
        success(`Volume scan completed successfully`);
        onScanComplete?.(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Scan failed');
        showError(`Volume scan failed: ${error.message}`);
        onScanError?.(error);
      }
    };

    return (
      <button
        onClick={handleScan}
        disabled={isDisabled}
        className={clsx(
          'rounded-lg transition-colors p-1',
          'hover:bg-blue-100 dark:hover:bg-blue-900/20',
          'hover:text-blue-600 dark:hover:text-blue-400',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'text-gray-500 dark:text-gray-400',
          className,
        )}
        title={
          disabled
            ? 'Volume is untracked - enable tracking to scan'
            : isScanning
              ? 'Scanning...'
              : 'Scan volume'
        }
      >
        {isScanning ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Scan className="w-4 h-4" />
        )}
      </button>
    );
  }

  // Use detailed multi-phase scan button by default
  return (
    <DetailedScanButton
      volumeId={volumeId}
      variant={variant as any}
      size={size}
      showProgress={showProgress}
      showPhases={showPhases}
      disabled={disabled}
      onScanComplete={onScanComplete}
      onScanError={onScanError}
      className={className}
    />
  );
};
