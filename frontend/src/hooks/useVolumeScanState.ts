import { useEffect, useRef, useState } from 'react';
import { useScanProgress } from '@/hooks/useScanProgress';
import { SCAN_STATUS } from '@/components/domain/volumes/shared/constants';

/**
 * Unified, single-source-of-truth scan state for one volume row.
 *
 * BACKGROUND (the bad-design cleanup this replaces): the table previously had
 * TWO independent notions of "is this volume scanning?":
 *
 *   1. `volume.scan_status` from the REST list payload — only changes when a
 *      list refetch happens to land while a scan is mid-flight, so it lags the
 *      real scan by up to a debounce+refetch cycle and never carries a %.
 *   2. The live WebSocket atom (`useScanProgress`) — updates per message with a
 *      real `overall_progress`, but was only ever read inside the expanded row.
 *
 * A collapsed row therefore showed a stale binary "Scanning..." (source 1)
 * while the real-time percentage (source 2) sat unread in the atom store. This
 * hook makes the LIVE ATOM authoritative and demotes the REST field to a
 * fallback, so every cell that renders scan state reads the same truth and they
 * can no longer disagree.
 *
 * Resolution rules:
 *   - If a live atom entry exists for this volume, it wins outright (it is the
 *     freshest possible signal, message-by-message).
 *   - If there is NO live entry (e.g. a scan that started before this tab
 *     connected, or after the atom cleared its completed entry), fall back to
 *     the REST `scan_status` so we still show *something* truthful.
 *   - On the transition running -> not-running we emit a short-lived
 *     `justCompleted` beat (used to flash the progress bar green before it
 *     fades), driven by the state transition itself rather than a blind timer
 *     started at mount.
 */

export interface VolumeScanState {
  /** True while a scan is actively running (live atom preferred, REST fallback). */
  isScanning: boolean;
  /** 0–100 live percentage when a live atom entry exists; null otherwise. */
  progress: number | null;
  /** True for a brief window right after a running scan finishes. */
  justCompleted: boolean;
  /** True when the finishing scan ended in failure rather than success. */
  failed: boolean;
}

const COMPLETED_FLASH_MS = 1200;

export function useVolumeScanState(
  volumeId: string,
  restScanStatus?: string | null,
): VolumeScanState {
  const { progress: live } = useScanProgress(volumeId);

  // Live atom is authoritative; REST status is only consulted when the atom
  // has nothing for this volume.
  const liveIsRunning = live?.overall_status === 'running';
  const restIsRunning =
    restScanStatus === SCAN_STATUS.RUNNING ||
    restScanStatus === SCAN_STATUS.PENDING;
  const isScanning = live ? liveIsRunning : restIsRunning;

  const progress = live ? live.overall_progress : null;

  // Emit a completion beat on the running -> done edge, keyed off the live
  // atom so it reflects the real WebSocket completion, not a refetch.
  const wasScanningRef = useRef(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const wasScanning = wasScanningRef.current;
    wasScanningRef.current = liveIsRunning;

    if (wasScanning && !liveIsRunning && live) {
      setFailed(live.overall_status === 'failed');
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), COMPLETED_FLASH_MS);
      return () => clearTimeout(t);
    }
  }, [liveIsRunning, live]);

  return { isScanning, progress, justCompleted, failed };
}
