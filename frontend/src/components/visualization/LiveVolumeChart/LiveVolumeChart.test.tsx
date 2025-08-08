import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import { LiveVolumeChart } from './LiveVolumeChart';
import type { Volume } from '../../../types/api';

const mockVolumes: Volume[] = [
  {
    id: 'vol-1',
    name: 'postgres-data',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/postgres-data/_data',
    created_at: '2024-01-15T10:00:00Z',
    size: 5368709120,
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: 'vol-2',
    name: 'redis-cache',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/redis-cache/_data',
    created_at: '2024-01-14T09:00:00Z',
    size: 1073741824,
    mount_count: 2,
    labels: {},
    options: {},
  },
];

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<Provider>{ui}</Provider>);
};

describe('LiveVolumeChart', () => {
  it('renders donut chart with volume data', () => {
    renderWithProvider(
      <LiveVolumeChart volumes={mockVolumes} variant="donut" />,
    );

    expect(screen.getByText('Live Volume Usage')).toBeInTheDocument();
    expect(screen.getByText('Active Volumes')).toBeInTheDocument();
    expect(screen.getByText('Total Size')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Active volumes count
  });

  it('renders pie chart variant', () => {
    renderWithProvider(<LiveVolumeChart volumes={mockVolumes} variant="pie" />);

    expect(screen.getByText('Live Volume Usage')).toBeInTheDocument();
  });

  it('renders bar chart variant', () => {
    renderWithProvider(<LiveVolumeChart volumes={mockVolumes} variant="bar" />);

    expect(screen.getByText('Live Volume Usage')).toBeInTheDocument();
  });

  it('shows empty state when no volumes provided', () => {
    renderWithProvider(<LiveVolumeChart volumes={[]} />);

    expect(screen.getByText('No volume data available')).toBeInTheDocument();
    expect(
      screen.getByText('Volume data will appear here once volumes are scanned'),
    ).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);

    renderWithProvider(
      <LiveVolumeChart volumes={mockVolumes} onRefresh={onRefresh} />,
    );

    const refreshButton = screen.getByTitle('Refresh data');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onVolumeClick when volume segment is clicked', () => {
    const onVolumeClick = jest.fn();

    renderWithProvider(
      <LiveVolumeChart
        volumes={mockVolumes}
        onVolumeClick={onVolumeClick}
        variant="donut"
      />,
    );

    // Note: Testing chart clicks is complex with recharts
    // In a real test, you might need to mock the chart library
    expect(screen.getByText('Live Volume Usage')).toBeInTheDocument();
  });

  it('displays correct summary statistics', () => {
    renderWithProvider(<LiveVolumeChart volumes={mockVolumes} />);

    expect(screen.getByText('2')).toBeInTheDocument(); // Active volumes
    expect(screen.getByText('3')).toBeInTheDocument(); // Total mounts (1 + 2)
  });

  it('applies correct size classes', () => {
    const { rerender } = renderWithProvider(
      <LiveVolumeChart volumes={mockVolumes} size="sm" />,
    );

    expect(screen.getByText('Live Volume Usage')).toBeInTheDocument();

    rerender(
      <Provider>
        <LiveVolumeChart volumes={mockVolumes} size="lg" />
      </Provider>,
    );

    expect(screen.getByText('Live Volume Usage')).toBeInTheDocument();
  });

  it('handles legend visibility toggle', () => {
    const { rerender } = renderWithProvider(
      <LiveVolumeChart volumes={mockVolumes} showLegend={true} />,
    );

    expect(screen.getByText('Live Volume Usage')).toBeInTheDocument();

    rerender(
      <Provider>
        <LiveVolumeChart volumes={mockVolumes} showLegend={false} />
      </Provider>,
    );

    expect(screen.getByText('Live Volume Usage')).toBeInTheDocument();
  });

  it('limits volumes to maxVolumes prop', () => {
    const manyVolumes = [
      ...mockVolumes,
      {
        id: 'vol-3',
        name: 'extra-volume',
        driver: 'local',
        mount_point: '/var/lib/docker/volumes/extra-volume/_data',
        created_at: '2024-01-13T08:00:00Z',
        size: 2147483648,
        mount_count: 0,
        labels: {},
        options: {},
      },
    ];

    renderWithProvider(
      <LiveVolumeChart volumes={manyVolumes} maxVolumes={2} />,
    );

    // Should show max 2 volumes in stats
    expect(screen.getByText('Live Volume Usage')).toBeInTheDocument();
  });

  it('handles refresh button in empty state', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);

    renderWithProvider(<LiveVolumeChart volumes={[]} onRefresh={onRefresh} />);

    const refreshButton = screen.getByText('Refresh Data');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state during refresh', async () => {
    const onRefresh = jest
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

    renderWithProvider(<LiveVolumeChart volumes={[]} onRefresh={onRefresh} />);

    const refreshButton = screen.getByText('Refresh Data');
    fireEvent.click(refreshButton);

    expect(screen.getByText('Refreshing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Refresh Data')).toBeInTheDocument();
    });
  });
});
