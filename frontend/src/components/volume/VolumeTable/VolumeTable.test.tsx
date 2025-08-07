import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VolumeTable } from './VolumeTable';
import { Volume } from '../../../types/api';

const mockVolumes: Volume[] = [
  {
    id: '1',
    name: 'test-volume-1',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/test-volume-1/_data',
    created_at: '2024-01-15T10:00:00Z',
    size: 1073741824, // 1GB
    mount_count: 2,
    labels: {},
    options: {},
  },
  {
    id: '2',
    name: 'test-volume-2',
    driver: 'nfs',
    mount_point: '/var/lib/docker/volumes/test-volume-2/_data',
    created_at: '2024-01-14T10:00:00Z',
    size: 2147483648, // 2GB
    mount_count: 0,
    labels: {},
    options: {},
  },
];

describe('VolumeTable', () => {
  it('renders volume data correctly', () => {
    render(<VolumeTable volumes={mockVolumes} />);

    expect(screen.getByText('test-volume-1')).toBeInTheDocument();
    expect(screen.getByText('test-volume-2')).toBeInTheDocument();
    expect(screen.getByText('1.00 GB')).toBeInTheDocument();
    expect(screen.getByText('2.00 GB')).toBeInTheDocument();
    expect(screen.getByText('local')).toBeInTheDocument();
    expect(screen.getByText('nfs')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<VolumeTable volumes={[]} loading />);

    const loadingRows = screen.getAllByRole('row');
    expect(loadingRows.length).toBeGreaterThan(1);
  });

  it('shows empty state when no volumes', () => {
    render(<VolumeTable volumes={[]} />);

    expect(screen.getByText('No volumes found')).toBeInTheDocument();
  });

  it('handles sorting', () => {
    const onSort = jest.fn();
    render(<VolumeTable volumes={mockVolumes} onSort={onSort} />);

    fireEvent.click(screen.getByText('Size'));
    expect(onSort).toHaveBeenCalledWith('size');

    fireEvent.click(screen.getByText('Driver'));
    expect(onSort).toHaveBeenCalledWith('driver');
  });

  it('handles row click', () => {
    const onRowClick = jest.fn();
    render(<VolumeTable volumes={mockVolumes} onRowClick={onRowClick} />);

    fireEvent.click(screen.getByText('test-volume-1').closest('tr')!);
    expect(onRowClick).toHaveBeenCalledWith(mockVolumes[0]);
  });

  it('handles selection when enabled', () => {
    const onSelectionChange = jest.fn();
    render(
      <VolumeTable
        volumes={mockVolumes}
        showSelection
        onSelectionChange={onSelectionChange}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3); // Select all + 2 rows

    // Select first volume
    fireEvent.click(checkboxes[1]);
    expect(onSelectionChange).toHaveBeenCalledWith(['1']);

    // Select all
    fireEvent.click(checkboxes[0]);
    expect(onSelectionChange).toHaveBeenCalledWith(['1', '2']);
  });

  it('sorts volumes correctly', () => {
    render(
      <VolumeTable volumes={mockVolumes} sortBy="size" sortOrder="desc" />,
    );

    const rows = screen.getAllByRole('row');
    // First data row should be test-volume-2 (larger size)
    expect(rows[1]).toHaveTextContent('test-volume-2');
  });
});
