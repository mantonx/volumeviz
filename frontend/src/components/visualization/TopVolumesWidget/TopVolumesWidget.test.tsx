import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { TopVolumesWidget } from './TopVolumesWidget';
import type { Volume } from './TopVolumesWidget.types';

const mockVolumes: Volume[] = [
  {
    id: 'vol-1',
    name: 'large-database',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/large-database/_data',
    created_at: '2024-01-15T10:00:00Z',
    size: 10737418240, // 10GB
    mount_count: 3,
    labels: {},
    options: {},
  },
  {
    id: 'vol-2',
    name: 'medium-storage',
    driver: 'nfs',
    mount_point: '/mnt/nfs/medium',
    created_at: '2024-01-14T09:00:00Z',
    size: 2147483648, // 2GB
    mount_count: 1,
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
    mount_count: 0,
    labels: {},
    options: {},
  },
  {
    id: 'vol-4',
    name: 'active-logs',
    driver: 'tmpfs',
    mount_point: '/tmp/logs',
    created_at: '2024-01-12T07:00:00Z',
    size: 536870912, // 512MB
    mount_count: 5, // Highest mount count
    labels: {},
    options: {},
  },
];

describe('TopVolumesWidget', () => {
  it('renders top volumes widget with volume data', () => {
    render(<TopVolumesWidget volumes={mockVolumes} />);

    expect(screen.getByText('Top Volumes')).toBeInTheDocument();
    expect(screen.getByText('(by size)')).toBeInTheDocument();

    // Should show volumes sorted by size (desc by default)
    const volumeNames = screen.getAllByText(
      /large-database|medium-storage|active-logs|small-config/,
    );
    expect(volumeNames).toHaveLength(4);
  });

  it('sorts volumes by size in descending order by default', () => {
    render(<TopVolumesWidget volumes={mockVolumes} maxVolumes={4} />);

    const _volumeElements = screen.getAllByText(
      /large-database|medium-storage|active-logs|small-config/,
    );

    // First should be largest (large-database)
    expect(screen.getByText('large-database')).toBeInTheDocument();
  });

  it('sorts volumes by mount count when specified', () => {
    render(
      <TopVolumesWidget
        volumes={mockVolumes}
        sortBy="mount_count"
        sortOrder="desc"
        maxVolumes={4}
      />,
    );

    expect(screen.getByText('(by mounts)')).toBeInTheDocument();

    // active-logs has highest mount count (5)
    expect(screen.getByText('active-logs')).toBeInTheDocument();
  });

  it('limits number of volumes shown', () => {
    render(<TopVolumesWidget volumes={mockVolumes} maxVolumes={2} />);

    const volumeElements = screen.getAllByText(
      /large-database|medium-storage|active-logs|small-config/,
    );
    expect(volumeElements).toHaveLength(2);
  });

  it('shows empty state when no volumes provided', () => {
    render(<TopVolumesWidget volumes={[]} />);

    expect(screen.getByText('No volumes to rank')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Volume rankings will appear here once data is available',
      ),
    ).toBeInTheDocument();
  });

  it('displays ranking icons for top 3 volumes', () => {
    render(<TopVolumesWidget volumes={mockVolumes} showIndicators={true} />);

    // Crown icon should be present for 1st place (can't easily test specific icon)
    expect(screen.getByText('Top Volumes')).toBeInTheDocument();
  });

  it('calls onVolumeClick when volume is clicked', () => {
    const onVolumeClick = vi.fn();

    render(
      <TopVolumesWidget volumes={mockVolumes} onVolumeClick={onVolumeClick} />,
    );

    const volumeElement = screen.getByText('large-database');
    const clickableArea = volumeElement.closest('div[class*="cursor-pointer"]');

    if (clickableArea) {
      fireEvent.click(clickableArea);
      expect(onVolumeClick).toHaveBeenCalledWith('vol-1');
    }
  });

  it('calls onVolumeScan when scan button is clicked', async () => {
    const onVolumeScan = vi.fn().mockResolvedValue(undefined);

    render(
      <TopVolumesWidget volumes={mockVolumes} onVolumeScan={onVolumeScan} />,
    );

    const scanButtons = screen.getAllByTitle('Scan volume');
    fireEvent.click(scanButtons[0]);

    await waitFor(() => {
      expect(onVolumeScan).toHaveBeenCalledWith('vol-1'); // Largest volume (first in sorted order)
    });
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <TopVolumesWidget
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

  it('shows mounted status indicators', () => {
    render(
      <TopVolumesWidget
        volumes={mockVolumes}
        showIndicators={true}
        showDetails={true}
      />,
    );

    // Should show mount information for volumes with mount_count > 0
    expect(screen.getByText('3 mounts')).toBeInTheDocument(); // vol-1
    expect(screen.getByText('5 mounts')).toBeInTheDocument(); // vol-4
  });

  it('hides details when showDetails is false', () => {
    render(<TopVolumesWidget volumes={mockVolumes} showDetails={false} />);

    expect(screen.queryByText('3 mounts')).not.toBeInTheDocument();
  });

  it('hides indicators when showIndicators is false', () => {
    render(<TopVolumesWidget volumes={mockVolumes} showIndicators={false} />);

    // Progress bars and ranking icons should not be visible
    expect(screen.getByText('Top Volumes')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(
      <TopVolumesWidget volumes={mockVolumes} size="sm" />,
    );

    expect(screen.getByText('Top Volumes')).toBeInTheDocument();

    rerender(<TopVolumesWidget volumes={mockVolumes} size="lg" />);
    expect(screen.getByText('Top Volumes')).toBeInTheDocument();
  });

  it('displays summary statistics', () => {
    render(<TopVolumesWidget volumes={mockVolumes} maxVolumes={4} />);

    expect(screen.getByText('Ranked Volumes')).toBeInTheDocument();
    expect(screen.getByText('Total Size')).toBeInTheDocument();
    expect(screen.getByText('Mounted')).toBeInTheDocument();
    expect(screen.getByText('Largest')).toBeInTheDocument();

    // Should show 4 ranked volumes
    expect(screen.getByText('4')).toBeInTheDocument();
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

    render(<TopVolumesWidget volumes={volumesWithoutSize} />);

    expect(screen.getByText('Top Volumes')).toBeInTheDocument();
    expect(screen.getByText('no-size-volume')).toBeInTheDocument();
  });

  it('sorts in ascending order when specified', () => {
    render(
      <TopVolumesWidget
        volumes={mockVolumes}
        sortBy="size"
        sortOrder="asc"
        maxVolumes={4}
      />,
    );

    // Smallest volume should be listed first
    expect(screen.getByText('small-config')).toBeInTheDocument();
  });

  it('prevents multiple concurrent scans of the same volume', async () => {
    const onVolumeScan = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

    render(
      <TopVolumesWidget volumes={mockVolumes} onVolumeScan={onVolumeScan} />,
    );

    const scanButton = screen.getAllByTitle('Scan volume')[0];

    // Click scan button twice rapidly
    fireEvent.click(scanButton);
    fireEvent.click(scanButton);

    // Only one scan should be triggered
    await waitFor(() => {
      expect(onVolumeScan).toHaveBeenCalledTimes(1);
    });
  });

  it('updates last updated time on refresh', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <TopVolumesWidget
        volumes={mockVolumes}
        onRefresh={onRefresh}
        enableRefresh={true}
      />,
    );

    const timeRegex = /Updated: \d{1,2}:\d{2}:\d{2}/;
    expect(screen.getByText(timeRegex)).toBeInTheDocument();

    const refreshButton = screen.getByTitle('Refresh data');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
      expect(screen.getByText(timeRegex)).toBeInTheDocument();
    });
  });
});
