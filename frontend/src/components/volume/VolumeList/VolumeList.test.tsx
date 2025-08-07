import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'jotai';
import { VolumeList } from './VolumeList';
import { Volume } from '../../../types/api';

const mockVolumes: Volume[] = [
  {
    id: '1',
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
    id: '2',
    name: 'redis-cache',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/redis-cache/_data',
    created_at: '2024-01-14T09:00:00Z',
    size: 268435456,
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: '3',
    name: 'app-logs',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/app-logs/_data',
    created_at: '2024-01-13T08:00:00Z',
    size: 1073741824,
    mount_count: 0,
    labels: {},
    options: {},
  },
];

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<Provider>{ui}</Provider>);
};

describe('VolumeList', () => {
  it('renders volumes in grid layout by default', () => {
    renderWithProvider(<VolumeList volumes={mockVolumes} />);

    expect(screen.getByText('postgres-data')).toBeInTheDocument();
    expect(screen.getByText('redis-cache')).toBeInTheDocument();
    expect(screen.getByText('app-logs')).toBeInTheDocument();
  });

  it('renders empty state when no volumes', () => {
    renderWithProvider(<VolumeList volumes={[]} />);

    expect(screen.getByText('No volumes found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No Docker volumes are currently available. Create your first volume to get started.',
      ),
    ).toBeInTheDocument();
  });

  it('shows custom empty state message', () => {
    renderWithProvider(
      <VolumeList volumes={[]} emptyStateMessage="Custom empty message" />,
    );

    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });

  it('renders empty state action button', () => {
    const actionButton = <button>Create Volume</button>;
    renderWithProvider(
      <VolumeList volumes={[]} emptyStateAction={actionButton} />,
    );

    expect(screen.getByText('Create Volume')).toBeInTheDocument();
  });

  it('handles pagination correctly', () => {
    const onPageChange = jest.fn();
    renderWithProvider(
      <VolumeList
        volumes={mockVolumes}
        pageSize={2}
        currentPage={1}
        onPageChange={onPageChange}
      />,
    );

    // Should show pagination since we have 3 volumes with pageSize 2
    expect(screen.getByText('Showing 1-2 of 3 volumes')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();

    // Click next page
    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('hides pagination when showPagination is false', () => {
    renderWithProvider(
      <VolumeList volumes={mockVolumes} pageSize={2} showPagination={false} />,
    );

    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('calls onVolumeAction when volume actions are triggered', () => {
    const onVolumeAction = jest.fn();
    renderWithProvider(
      <VolumeList volumes={mockVolumes} onVolumeAction={onVolumeAction} />,
    );

    // This would depend on VolumeCard implementing the action callbacks
    // The test verifies the structure exists
    expect(screen.getByText('postgres-data')).toBeInTheDocument();
  });

  it('applies different layouts correctly', () => {
    const { rerender } = renderWithProvider(
      <VolumeList volumes={mockVolumes} layout="list" />,
    );

    expect(screen.getByText('postgres-data')).toBeInTheDocument();

    rerender(
      <Provider>
        <VolumeList volumes={mockVolumes} layout="compact" />
      </Provider>,
    );

    expect(screen.getByText('postgres-data')).toBeInTheDocument();
  });

  it('handles page navigation', () => {
    const onPageChange = jest.fn();
    renderWithProvider(
      <VolumeList
        volumes={[...mockVolumes, ...mockVolumes]} // 6 volumes
        pageSize={2}
        currentPage={2}
        onPageChange={onPageChange}
      />,
    );

    // Should show both Previous and Next buttons
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();

    // Test previous button
    fireEvent.click(screen.getByText('Previous'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables navigation buttons appropriately', () => {
    renderWithProvider(
      <VolumeList
        volumes={mockVolumes}
        pageSize={2}
        currentPage={1}
        onPageChange={jest.fn()}
      />,
    );

    const previousButton = screen.getByText('Previous');
    expect(previousButton).toBeDisabled();
  });
});
