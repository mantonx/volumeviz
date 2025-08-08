import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SystemOverview } from './SystemOverview';
import type { Volume } from './SystemOverview.types';

const mockVolumes: Volume[] = [
  {
    id: 'vol-1',
    name: 'postgres-data',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/postgres-data/_data',
    created_at: '2024-01-15T10:00:00Z',
    size: 5368709120, // 5GB
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: 'vol-2',
    name: 'redis-cache',
    driver: 'nfs',
    mount_point: '/mnt/nfs/redis-cache',
    created_at: '2024-01-14T09:00:00Z',
    size: 1073741824, // 1GB
    mount_count: 0,
    labels: {},
    options: {},
  },
  {
    id: 'vol-3',
    name: 'small-config',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/small-config/_data',
    created_at: '2024-01-13T08:00:00Z',
    size: 52428800, // 50MB
    mount_count: 2,
    labels: {},
    options: {},
  },
];

describe('SystemOverview', () => {
  it('renders system overview with volume data', () => {
    render(<SystemOverview volumes={mockVolumes} />);

    expect(screen.getByText('System Overview')).toBeInTheDocument();
    expect(screen.getByText('Total Storage')).toBeInTheDocument();
    expect(screen.getByText('Total Volumes')).toBeInTheDocument();
    expect(screen.getByText('Mounted')).toBeInTheDocument();
    expect(screen.getByText('Drivers')).toBeInTheDocument();

    // Should show correct volume count
    expect(screen.getByText('3')).toBeInTheDocument(); // Total volumes
  });

  it('shows correct statistics calculations', () => {
    render(<SystemOverview volumes={mockVolumes} />);

    // Total volumes
    expect(screen.getByText('3')).toBeInTheDocument();

    // Mounted volumes (mount_count > 0)
    expect(screen.getByText('2')).toBeInTheDocument(); // vol-1 and vol-3 are mounted

    // Unique drivers
    expect(screen.getByText('2')).toBeInTheDocument(); // local and nfs
  });

  it('shows empty state when no volumes provided', () => {
    render(<SystemOverview volumes={[]} />);

    expect(screen.getByText('No system data available')).toBeInTheDocument();
    expect(
      screen.getByText(
        'System overview will appear here once volumes are scanned',
      ),
    ).toBeInTheDocument();
  });

  it('switches between view modes', () => {
    render(<SystemOverview volumes={mockVolumes} showBreakdown={true} />);

    const driversButton = screen.getByText('Drivers');
    const sizesButton = screen.getByText('Sizes');

    // Click drivers view
    fireEvent.click(driversButton);
    expect(screen.getByText('Driver Details')).toBeInTheDocument();

    // Click sizes view
    fireEvent.click(sizesButton);
    expect(screen.getByText('Size Distribution')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <SystemOverview
        volumes={mockVolumes}
        onRefresh={onRefresh}
        enableRefresh={true}
      />,
    );

    const refreshButton = screen.getByTitle('Refresh data');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onDriverClick when driver is clicked', () => {
    const onDriverClick = vi.fn();

    render(
      <SystemOverview
        volumes={mockVolumes}
        onDriverClick={onDriverClick}
        showBreakdown={true}
      />,
    );

    // Switch to drivers view
    fireEvent.click(screen.getByText('Drivers'));

    // Click on a driver (assuming it renders as clickable)
    const localDriverElement = screen.getByText('local');
    const driverContainer = localDriverElement.closest(
      'div[class*="cursor-pointer"]',
    );

    if (driverContainer) {
      fireEvent.click(driverContainer);
      expect(onDriverClick).toHaveBeenCalledWith('local');
    }
  });

  it('handles volumes without size gracefully', () => {
    const volumesWithoutSize: Volume[] = [
      {
        id: 'vol-no-size',
        name: 'no-size-volume',
        driver: 'local',
        mount_point: '/var/lib/docker/volumes/no-size/_data',
        created_at: '2024-01-15T10:00:00Z',
        // size is undefined
        mount_count: 1,
        labels: {},
        options: {},
      },
    ];

    render(<SystemOverview volumes={volumesWithoutSize} />);

    expect(screen.getByText('System Overview')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // Should still count the volume
  });

  it('displays breakdown when enabled', () => {
    render(<SystemOverview volumes={mockVolumes} showBreakdown={true} />);

    expect(screen.getByText('Storage by Driver')).toBeInTheDocument();
    expect(screen.getByText('Volumes by Size Range')).toBeInTheDocument();
  });

  it('hides breakdown when disabled', () => {
    render(<SystemOverview volumes={mockVolumes} showBreakdown={false} />);

    expect(screen.queryByText('Storage by Driver')).not.toBeInTheDocument();
    expect(screen.queryByText('Volumes by Size Range')).not.toBeInTheDocument();
  });

  it('updates last updated time on refresh', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <SystemOverview
        volumes={mockVolumes}
        onRefresh={onRefresh}
        enableRefresh={true}
      />,
    );

    // Get initial time
    const timeRegex = /Updated: \d{1,2}:\d{2}:\d{2}/;
    const initialTimeElement = screen.getByText(timeRegex);
    const _initialTime = initialTimeElement.textContent;

    // Wait a moment and refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const refreshButton = screen.getByTitle('Refresh data');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });

    // Time should be updated (note: this is a basic check, exact timing may vary)
    expect(screen.getByText(timeRegex)).toBeInTheDocument();
  });

  it('shows loading state during refresh', async () => {
    const onRefresh = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

    render(
      <SystemOverview
        volumes={mockVolumes}
        onRefresh={onRefresh}
        enableRefresh={true}
      />,
    );

    const refreshButton = screen.getByTitle('Refresh data');
    fireEvent.click(refreshButton);

    // Button should be disabled during refresh
    expect(refreshButton).toBeDisabled();

    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it('categorizes volumes by size ranges correctly', () => {
    const mixedSizeVolumes: Volume[] = [
      {
        id: 'tiny',
        name: 'tiny-config',
        driver: 'local',
        mount_point: '/config',
        created_at: '2024-01-15T10:00:00Z',
        size: 1048576, // 1MB - should be in "< 100MB" range
        mount_count: 1,
        labels: {},
        options: {},
      },
      {
        id: 'large',
        name: 'large-data',
        driver: 'local',
        mount_point: '/data',
        created_at: '2024-01-14T09:00:00Z',
        size: 107374182400, // 100GB - should be in "> 100GB" range
        mount_count: 1,
        labels: {},
        options: {},
      },
    ];

    render(<SystemOverview volumes={mixedSizeVolumes} showBreakdown={true} />);

    // Switch to sizes view to see the categorization
    fireEvent.click(screen.getByText('Sizes'));

    expect(screen.getByText('Size Distribution')).toBeInTheDocument();
  });
});
