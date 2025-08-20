import { Volume } from '../../../api/client';

export interface VolumeCardWithProgressProps {
  volume: Volume;
  scanProgress?: {
    scanId: string;
    volumeId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    phase?: 'volume_scan' | 'filesystem_indexing' | 'media_enrichment';
    progress: number;
    phaseProgress?: number;
    filesScanned?: number;
    foldersScanned?: number;
    currentPath?: string;
    filesPerSecond?: number;
    bytesPerSecond?: number;
    errorsCount?: number;
    startedAt?: string;
    estimatedRemaining?: number;
  };
  onScanStart?: () => void;
  onScanStop?: () => void;
  onScanPause?: () => void;
  onScanResume?: () => void;
  onClick?: () => void;
  onViewDetails?: () => void;
  className?: string;
  testId?: string;
}

export type ScanStatus = VolumeCardWithProgressProps['scanProgress']['status'];
export type ScanPhase = VolumeCardWithProgressProps['scanProgress']['phase'];