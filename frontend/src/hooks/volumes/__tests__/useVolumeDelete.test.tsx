/**
 * Unit tests for useVolumeDelete — the staged confirm/delete flow backing
 * the new real-Docker volume delete feature (single + bulk).
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useVolumeDelete } from '../useVolumeDelete';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError }),
}));

const server = setupServer(
  http.delete('/api/v1/volumes/:name', ({ params }) => {
    if (params.name === 'attached-vol') {
      return HttpResponse.json(
        { error: "volume 'attached-vol' is still attached to 1 container(s)", code: 'conflict' },
        { status: 409 },
      );
    }
    return HttpResponse.json({
      message: `Volume '${params.name}' deleted`,
      volume_id: params.name,
    });
  }),

  http.post('/api/v1/volumes/bulk-delete', async ({ request }) => {
    const body = (await request.json()) as { volume_ids: string[] };
    const succeeded: string[] = [];
    const failed: { volume_id: string; error: string }[] = [];

    for (const id of body.volume_ids) {
      if (id === 'attached-vol') {
        failed.push({ volume_id: id, error: 'still attached to 1 container(s)' });
      } else {
        succeeded.push(id);
      }
    }

    return HttpResponse.json({ succeeded, failed });
  }),
);

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useVolumeDelete', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });
  afterAll(() => server.close());

  it('starts with no modal open and nothing pending', () => {
    const { result } = renderHook(() => useVolumeDelete(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.pendingVolumes).toEqual([]);
  });

  it('requestDelete stages volumes and opens the modal without calling the API', () => {
    const { result } = renderHook(() => useVolumeDelete(), {
      wrapper: createTestWrapper(),
    });

    act(() => {
      result.current.requestDelete([{ name: 'vol-a', size_bytes: 100 }]);
    });

    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.pendingVolumes).toEqual([
      { name: 'vol-a', size_bytes: 100 },
    ]);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('cancelDelete clears pending state without deleting anything', () => {
    const { result } = renderHook(() => useVolumeDelete(), {
      wrapper: createTestWrapper(),
    });

    act(() => {
      result.current.requestDelete([{ name: 'vol-a' }]);
    });
    act(() => {
      result.current.cancelDelete();
    });

    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.pendingVolumes).toEqual([]);
  });

  it('confirmDelete for a single volume calls the real delete endpoint and resolves true on success', async () => {
    const { result } = renderHook(() => useVolumeDelete(), {
      wrapper: createTestWrapper(),
    });

    act(() => {
      result.current.requestDelete([{ name: 'clean-vol' }]);
    });

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.confirmDelete();
    });

    expect(outcome).toBe(true);
    await waitFor(() => {
      expect(result.current.isModalOpen).toBe(false);
    });
    expect(toastSuccess).toHaveBeenCalledWith("Deleted volume 'clean-vol'");
  });

  it('confirmDelete for a single attached volume resolves false and surfaces the conflict', async () => {
    const { result } = renderHook(() => useVolumeDelete(), {
      wrapper: createTestWrapper(),
    });

    act(() => {
      result.current.requestDelete([{ name: 'attached-vol' }]);
    });

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.confirmDelete();
    });

    expect(outcome).toBe(false);
    expect(result.current.isModalOpen).toBe(true); // stays open on failure
    expect(result.current.failures).toEqual([
      expect.objectContaining({ volume_id: 'attached-vol' }),
    ]);
    expect(toastError).toHaveBeenCalled();
  });

  it('confirmDelete for a bulk request with all successes resolves true and closes the modal', async () => {
    const { result } = renderHook(() => useVolumeDelete(), {
      wrapper: createTestWrapper(),
    });

    act(() => {
      result.current.requestDelete([{ name: 'vol-a' }, { name: 'vol-b' }]);
    });

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.confirmDelete();
    });

    expect(outcome).toBe(true);
    expect(result.current.isModalOpen).toBe(false);
    expect(toastSuccess).toHaveBeenCalledWith('Deleted 2 volume(s)');
  });

  it('confirmDelete for a partial bulk failure resolves false and keeps only the failures pending', async () => {
    const { result } = renderHook(() => useVolumeDelete(), {
      wrapper: createTestWrapper(),
    });

    act(() => {
      result.current.requestDelete([
        { name: 'vol-a' },
        { name: 'attached-vol' },
      ]);
    });

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.confirmDelete();
    });

    expect(outcome).toBe(false);
    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.pendingVolumes).toEqual([{ name: 'attached-vol' }]);
    expect(result.current.failures).toEqual([
      expect.objectContaining({ volume_id: 'attached-vol' }),
    ]);
    expect(toastSuccess).toHaveBeenCalledWith('Deleted 1 volume(s)');
    expect(toastError).toHaveBeenCalledWith('1 volume(s) could not be deleted');
  });

  it('confirmDelete for a bulk request with all failures resolves false and reports nothing succeeded', async () => {
    const { result } = renderHook(() => useVolumeDelete(), {
      wrapper: createTestWrapper(),
    });

    act(() => {
      result.current.requestDelete([
        { name: 'attached-vol' },
        { name: 'attached-vol-2' },
      ]);
    });

    server.use(
      http.post('/api/v1/volumes/bulk-delete', () =>
        HttpResponse.json({
          succeeded: [],
          failed: [
            { volume_id: 'attached-vol', error: 'in use' },
            { volume_id: 'attached-vol-2', error: 'in use' },
          ],
        }),
      ),
    );

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.confirmDelete();
    });

    expect(outcome).toBe(false);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('Failed to delete all 2 volume(s)');
  });
});
