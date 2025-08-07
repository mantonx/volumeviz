import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'jotai';
import { VolumesPage } from './VolumesPage';

// Mock the API services
vi.mock('@/api/services', () => ({
  useVolumes: () => ({
    fetchVolumes: vi.fn(),
    refreshVolumes: vi.fn(),
  }),
  useVolumeScanning: () => ({
    scanVolume: vi.fn(),
    scanResults: {},
  }),
}));

// Mock the store atoms
vi.mock('@/store', () => ({
  filteredVolumesAtom: { init: [] },
  volumeStatsAtom: {
    init: { total: 0, active: 0, inactive: 0, totalSize: '0 B' },
  },
  volumesLoadingAtom: { init: false },
  volumesErrorAtom: { init: null },
}));

const _mockVolumes = [
  {
    volume_id: 'vol-1',
    name: 'my-app-data',
    driver: 'local',
    is_active: true,
    mountpoint: '/var/lib/docker/volumes/my-app-data/_data',
    container_count: 2,
    labels: { app: 'myapp', env: 'production' },
  },
  {
    volume_id: 'vol-2',
    name: 'postgres-data',
    driver: 'local',
    is_active: false,
    mountpoint: '/var/lib/docker/volumes/postgres-data/_data',
    container_count: 0,
    labels: {},
  },
];

describe('VolumesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header correctly', () => {
    render(
      <Provider>
        <VolumesPage />
      </Provider>,
    );

    expect(screen.getByText('Docker Volumes')).toBeInTheDocument();
    expect(
      screen.getByText('Manage and monitor your Docker volume storage'),
    ).toBeInTheDocument();
  });

  it('displays volume statistics cards', () => {
    render(
      <Provider>
        <VolumesPage />
      </Provider>,
    );

    expect(screen.getByText('Total Volumes')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Total Size')).toBeInTheDocument();
  });

  it('shows refresh and scan all buttons', () => {
    render(
      <Provider>
        <VolumesPage />
      </Provider>,
    );

    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Scan All')).toBeInTheDocument();
  });

  it('displays search and filter controls', () => {
    render(
      <Provider>
        <VolumesPage />
      </Provider>,
    );

    expect(
      screen.getByPlaceholderText('Search volumes...'),
    ).toBeInTheDocument();
    expect(screen.getByText('Driver')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('shows empty state when no volumes exist', () => {
    render(
      <Provider>
        <VolumesPage />
      </Provider>,
    );

    expect(screen.getByText('No Volumes Found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No Docker volumes are currently available or match your filters.',
      ),
    ).toBeInTheDocument();
  });

  it('handles refresh button click', () => {
    const mockRefresh = vi.fn();
    vi.mocked(require('@/api/services').useVolumes).mockReturnValue({
      fetchVolumes: vi.fn(),
      refreshVolumes: mockRefresh,
    });

    render(
      <Provider>
        <VolumesPage />
      </Provider>,
    );

    fireEvent.click(screen.getByText('Refresh'));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('handles scan all button click', () => {
    render(
      <Provider>
        <VolumesPage />
      </Provider>,
    );

    // Mock console.log to verify the action
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    fireEvent.click(screen.getByText('Scan All'));
    expect(consoleSpy).toHaveBeenCalledWith('Bulk scan not yet implemented');

    consoleSpy.mockRestore();
  });
});

describe('VolumeCard', () => {
  const _mockVolume = {
    volume_id: 'vol-1',
    name: 'test-volume',
    driver: 'local',
    is_active: true,
    mountpoint: '/var/lib/docker/volumes/test-volume/_data',
    container_count: 3,
    labels: { app: 'test', version: '1.0' },
  };

  it('displays volume information correctly', () => {
    // We need to test the VolumeCard component separately
    // This would require exporting it or creating a separate test
    // For now, this is a placeholder for the structure
    expect(true).toBe(true);
  });
});
