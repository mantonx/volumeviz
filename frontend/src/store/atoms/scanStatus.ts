import type { ScanResponse } from '@/api/client';
import { atom } from 'jotai';
import { atomFamily, atomWithReset } from 'jotai/utils';

// Scan status types
export interface ScanStatus {
  scan_id: string;
  volume_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  result?: ScanResponse['result'];
}

// Scan status atom family - one atom per scan ID
export const scanStatusAtomFamily = atomFamily(
  (_scanId: string) => atomWithReset<ScanStatus | null>(null),
  (a: string, b: string) => a === b,
);

// Scan status loading states
export const scanStatusLoadingAtomFamily = atomFamily(
  (_scanId: string) => atom<boolean>(false),
  (a: string, b: string) => a === b,
);

// Scan status error states
export const scanStatusErrorAtomFamily = atomFamily(
  (_scanId: string) => atom<string | null>(null),
  (a: string, b: string) => a === b,
);

// Active scans tracking - which scan IDs are currently being polled
export const activeScansAtom = atom<Set<string>>(new Set<string>());

// Polling configuration for scans
export const scanPollingConfigAtom = atom({
  enabled: true,
  interval: 2000, // 2 seconds for active scans
  fastInterval: 1000, // 1 second for running scans
  backoffInterval: 5000, // 5 seconds for errored scans
  maxRetries: 3,
});

// Get all active scan statuses
export const allActiveScanStatusesAtom = atom((get) => {
  const activeScans = get(activeScansAtom);
  const statuses: Record<string, ScanStatus | null> = {};

  activeScans.forEach((scanId) => {
    statuses[scanId] = get(scanStatusAtomFamily(scanId));
  });

  return statuses;
});

// Count of running scans
export const runningScanCountAtom = atom((get) => {
  const statuses = get(allActiveScanStatusesAtom);
  return Object.values(statuses).filter(
    (status) => status?.status === 'running' || status?.status === 'pending',
  ).length;
});

// Latest scan progress for a volume
export const volumeLatestScanAtomFamily = atomFamily(
  (volumeId: string) =>
    atom<ScanStatus | null>((get) => {
      const statuses = get(allActiveScanStatusesAtom);

      // Find the most recent scan for this volume
      const volumeScans = Object.values(statuses).filter(
        (status) => status?.volume_id === volumeId,
      );

      if (volumeScans.length === 0) return null;

      // Sort by started_at timestamp, most recent first
      volumeScans.sort((a, b) => {
        const aTime = a?.started_at ? new Date(a.started_at).getTime() : 0;
        const bTime = b?.started_at ? new Date(b.started_at).getTime() : 0;
        return bTime - aTime;
      });

      return volumeScans[0];
    }),
  (a: string, b: string) => a === b,
);

// Helper to start tracking a scan
export const startScanTrackingAtom = atom(
  null,
  (get, set, { scanId, volumeId }: { scanId: string; volumeId: string }) => {
    // Add to active scans
    const activeScans = get(activeScansAtom);
    set(activeScansAtom, new Set([...activeScans, scanId]));

    // Initialize scan status
    set(scanStatusAtomFamily(scanId), {
      scan_id: scanId,
      volume_id: volumeId,
      status: 'pending',
      started_at: new Date().toISOString(),
    });

    // Clear any previous error
    set(scanStatusErrorAtomFamily(scanId), null);
  },
);

// Helper to stop tracking a scan
export const stopScanTrackingAtom = atom(null, (get, set, scanId: string) => {
  // Remove from active scans
  const activeScans = get(activeScansAtom);
  const newActiveScans = new Set(activeScans);
  newActiveScans.delete(scanId);
  set(activeScansAtom, newActiveScans);

  // Stop loading state
  set(scanStatusLoadingAtomFamily(scanId), false);
});

// Helper to update scan status
export const updateScanStatusAtom = atom(
  null,
  (
    get,
    set,
    { scanId, status }: { scanId: string; status: Partial<ScanStatus> },
  ) => {
    const currentStatus = get(scanStatusAtomFamily(scanId));
    if (!currentStatus) return;

    set(scanStatusAtomFamily(scanId), {
      ...currentStatus,
      ...status,
    });

    // If scan is completed or failed, stop tracking after a delay
    if (
      status.status === 'completed' ||
      status.status === 'failed' ||
      status.status === 'cancelled'
    ) {
      setTimeout(() => {
        set(stopScanTrackingAtom, scanId);
      }, 3000); // Keep visible for 3 seconds after completion
    }
  },
);

// Helper to handle scan errors
export const setScanErrorAtom = atom(
  null,
  (_get, set, { scanId, error }: { scanId: string; error: string }) => {
    set(scanStatusErrorAtomFamily(scanId), error);
    set(updateScanStatusAtom, {
      scanId,
      status: { status: 'failed', error_message: error },
    });
  },
);

// Clear all scan tracking
export const clearAllScanTrackingAtom = atom(null, (get, set) => {
  const activeScans = get(activeScansAtom);

  activeScans.forEach((scanId) => {
    set(scanStatusAtomFamily(scanId), null);
    set(scanStatusLoadingAtomFamily(scanId), false);
    set(scanStatusErrorAtomFamily(scanId), null);
  });

  set(activeScansAtom, new Set());
});
