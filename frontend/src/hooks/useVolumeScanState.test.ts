import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVolumeScanState } from './useVolumeScanState';
import { SCAN_STATUS } from '@/components/domain/volumes/shared/constants';

// useVolumeScanState reads live scan state from useScanProgress (the shared
// WebSocket atom) and resolves it against the REST scan_status fallback. We
// mock useScanProgress to control the "live" side directly — the point of
// these tests is the RESOLUTION logic (which source wins) and the completion
// beat, not the atom plumbing (covered elsewhere).
const mockUseScanProgress = vi.fn();
vi.mock('./useScanProgress', () => ({
  useScanProgress: (volumeId: string) => mockUseScanProgress(volumeId),
}));

function liveRunning(pct: number) {
  return {
    progress: { overall_status: 'running', overall_progress: pct, scan_id: 's1' },
    isScanning: true,
    isConnected: true,
  };
}
function liveDone(status: 'completed' | 'failed') {
  return {
    progress: { overall_status: status, overall_progress: 100, scan_id: 's1' },
    isScanning: false,
    isConnected: true,
  };
}
function noLive() {
  return { progress: null, isScanning: false, isConnected: true };
}

describe('useVolumeScanState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseScanProgress.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefers the live atom over the REST scan_status when a live entry exists', () => {
    // Live says running at 42%, REST disagrees (says idle) — live must win.
    mockUseScanProgress.mockReturnValue(liveRunning(42));
    const { result } = renderHook(() =>
      useVolumeScanState('vol-1', SCAN_STATUS.IDLE),
    );
    expect(result.current.isScanning).toBe(true);
    expect(result.current.progress).toBe(42);
  });

  it('falls back to REST scan_status when there is no live atom entry', () => {
    // No live entry (e.g. scan started before this tab connected). REST says
    // running, so we still report scanning — but with no live percentage.
    mockUseScanProgress.mockReturnValue(noLive());
    const { result } = renderHook(() =>
      useVolumeScanState('vol-1', SCAN_STATUS.RUNNING),
    );
    expect(result.current.isScanning).toBe(true);
    expect(result.current.progress).toBeNull();
  });

  it('reports not-scanning when neither live nor REST indicate a scan', () => {
    mockUseScanProgress.mockReturnValue(noLive());
    const { result } = renderHook(() =>
      useVolumeScanState('vol-1', SCAN_STATUS.COMPLETED),
    );
    expect(result.current.isScanning).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.justCompleted).toBe(false);
  });

  it('emits a justCompleted beat on the running -> completed edge, then clears it', () => {
    mockUseScanProgress.mockReturnValue(liveRunning(90));
    const { result, rerender } = renderHook(() =>
      useVolumeScanState('vol-1', SCAN_STATUS.RUNNING),
    );
    expect(result.current.justCompleted).toBe(false);

    // Scan completes on the live atom.
    mockUseScanProgress.mockReturnValue(liveDone('completed'));
    act(() => {
      rerender();
    });
    expect(result.current.justCompleted).toBe(true);
    expect(result.current.failed).toBe(false);

    // Beat clears after the flash window.
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(result.current.justCompleted).toBe(false);
  });

  it('marks the completion beat as failed when the scan ends in failure', () => {
    mockUseScanProgress.mockReturnValue(liveRunning(30));
    const { result, rerender } = renderHook(() =>
      useVolumeScanState('vol-1', SCAN_STATUS.RUNNING),
    );

    mockUseScanProgress.mockReturnValue(liveDone('failed'));
    act(() => {
      rerender();
    });
    expect(result.current.justCompleted).toBe(true);
    expect(result.current.failed).toBe(true);
  });

  it('does NOT emit a beat for a row that mounts already-completed (no running->done edge)', () => {
    // A row that mounts with an already-finished live entry must not flash —
    // the beat is a transition, not a mount state.
    mockUseScanProgress.mockReturnValue(liveDone('completed'));
    const { result } = renderHook(() =>
      useVolumeScanState('vol-1', SCAN_STATUS.COMPLETED),
    );
    expect(result.current.justCompleted).toBe(false);
  });
});
