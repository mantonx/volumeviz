import { useState, useEffect, useCallback } from 'react';
import {
  globalPhaseTransitionDetector,
  type PhaseTransition,
} from '../utils/phaseTransitionNotifications';
import type { ComprehensiveScanProgress } from '../components/ui/MultiPhaseProgressBar/MultiPhaseProgressBar.types';

export interface UsePhaseTransitionNotificationsOptions {
  /** Whether to enable phase transition detection */
  enabled?: boolean;
  /** Maximum number of recent transitions to keep */
  maxHistory?: number;
  /** Callback when a new transition occurs */
  onTransition?: (transition: PhaseTransition) => void;
  /** Filter transitions by volume ID */
  volumeId?: string;
  /** Filter transitions by scan ID */
  scanId?: string;
}

export interface UsePhaseTransitionNotificationsReturn {
  /** Recent phase transitions */
  transitions: PhaseTransition[];
  /** All transitions for current scan */
  currentScanTransitions: PhaseTransition[];
  /** Latest transition */
  latestTransition: PhaseTransition | null;
  /** Clear transition history */
  clearTransitions: (scanId?: string) => void;
  /** Manually trigger transition detection */
  detectTransition: (
    progress: ComprehensiveScanProgress,
  ) => PhaseTransition | null;
}

/**
 * Hook for managing phase transition notifications
 * Integrates with the global phase transition detector to track and notify about phase changes
 */
export const usePhaseTransitionNotifications = (
  options: UsePhaseTransitionNotificationsOptions = {},
): UsePhaseTransitionNotificationsReturn => {
  const {
    enabled = true,
    maxHistory = 50,
    onTransition,
    volumeId,
    scanId,
  } = options;

  const [transitions, setTransitions] = useState<PhaseTransition[]>([]);
  const [latestTransition, setLatestTransition] =
    useState<PhaseTransition | null>(null);

  // Get current scan transitions
  const currentScanTransitions = scanId
    ? globalPhaseTransitionDetector.getTransitionHistory(scanId)
    : [];

  // Handle new transitions
  const handleTransition = useCallback(
    (transition: PhaseTransition) => {
      // Filter by volume/scan if specified
      if (volumeId && transition.volumeId !== volumeId) return;
      if (scanId && transition.scanId !== scanId) return;

      setLatestTransition(transition);

      setTransitions((prev) => {
        const updated = [transition, ...prev];
        return updated.slice(0, maxHistory); // Keep only recent transitions
      });

      onTransition?.(transition);
    },
    [volumeId, scanId, maxHistory, onTransition],
  );

  // Subscribe to phase transitions
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe =
      globalPhaseTransitionDetector.onTransition(handleTransition);

    // Load initial recent transitions
    const recent =
      globalPhaseTransitionDetector.getRecentTransitions(maxHistory);
    const filtered = recent.filter((t) => {
      if (volumeId && t.volumeId !== volumeId) return false;
      if (scanId && t.scanId !== scanId) return false;
      return true;
    });

    setTransitions(filtered);
    if (filtered.length > 0) {
      setLatestTransition(filtered[0]);
    }

    return unsubscribe;
  }, [enabled, handleTransition, maxHistory, volumeId, scanId]);

  // Clear transitions
  const clearTransitions = useCallback((targetScanId?: string) => {
    if (targetScanId) {
      globalPhaseTransitionDetector.clearScanData(targetScanId);
      setTransitions((prev) => prev.filter((t) => t.scanId !== targetScanId));
    } else {
      setTransitions([]);
      setLatestTransition(null);
    }
  }, []);

  // Manually detect transitions from progress data
  const detectTransition = useCallback(
    (progress: ComprehensiveScanProgress) => {
      if (!enabled) return null;

      // Find the currently running phase
      const runningPhase = progress.phases?.find((p) => p.status === 'running');
      if (!runningPhase) return null;

      // Calculate metadata
      const metadata = {
        filesProcessed: runningPhase.items_processed,
        bytesProcessed: runningPhase.bytes_processed,
        errorsEncountered: runningPhase.error_count,
        performance:
          runningPhase.items_per_second > 0
            ? {
                averageSpeed: runningPhase.items_per_second,
                peakSpeed: runningPhase.items_per_second * 1.2, // Estimate peak
              }
            : undefined,
      };

      const transition = globalPhaseTransitionDetector.updateProgress(
        progress.scan_id,
        progress.volume_id,
        runningPhase.phase_name,
        runningPhase.status,
        {
          filesProcessed: metadata.filesProcessed,
          bytesProcessed: metadata.bytesProcessed,
          errorsEncountered: metadata.errorsEncountered,
          performance: metadata.performance,
        },
      );

      return transition;
    },
    [enabled],
  );

  return {
    transitions,
    currentScanTransitions,
    latestTransition,
    clearTransitions,
    detectTransition,
  };
};

export default usePhaseTransitionNotifications;
