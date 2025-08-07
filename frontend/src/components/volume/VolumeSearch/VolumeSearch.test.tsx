import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VolumeSearch, VolumeSearchFilters } from './VolumeSearch';

describe('VolumeSearch', () => {
  const defaultFilters: VolumeSearchFilters = {
    query: '',
    drivers: [],
  };

  it('renders search input', () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
      />,
    );

    expect(
      screen.getByPlaceholderText('Search volumes...'),
    ).toBeInTheDocument();
  });

  it('handles query change with debouncing', async () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
      />,
    );

    const input = screen.getByPlaceholderText('Search volumes...');
    fireEvent.change(input, { target: { value: 'test' } });

    // Should not call immediately
    expect(onFiltersChange).not.toHaveBeenCalled();

    // Wait for debounce
    await waitFor(
      () => {
        expect(onFiltersChange).toHaveBeenCalledWith({
          ...defaultFilters,
          query: 'test',
        });
      },
      { timeout: 400 },
    );
  });

  it('shows clear button when query is entered', () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={{ ...defaultFilters, query: 'test' }}
        onFiltersChange={onFiltersChange}
      />,
    );

    const clearButton = screen.getByRole('button', { name: '' });
    expect(clearButton).toBeInTheDocument();
  });

  it('shows advanced filters when enabled', () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        showAdvanced
      />,
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('toggles filter panel', () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        showAdvanced
      />,
    );

    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    expect(screen.getByText('Driver Type')).toBeInTheDocument();
    expect(screen.getByText('Min Size (MB)')).toBeInTheDocument();
    expect(screen.getByText('Mount Status')).toBeInTheDocument();
  });

  it('handles driver filter selection', () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        showAdvanced
      />,
    );

    // Open filters
    fireEvent.click(screen.getByText('Filters'));

    // Click on local driver
    fireEvent.click(screen.getByText('local'));

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      drivers: ['local'],
    });
  });

  it('shows filter count badge', () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={{
          query: '',
          drivers: ['local', 'nfs'],
          minSize: 1048576,
        }}
        onFiltersChange={onFiltersChange}
        showAdvanced
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument(); // 2 drivers + 1 size filter
  });

  it('clears all filters', () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={{
          query: 'test',
          drivers: ['local'],
          minSize: 1048576,
        }}
        onFiltersChange={onFiltersChange}
        showAdvanced
      />,
    );

    fireEvent.click(screen.getByText('Clear all'));

    expect(onFiltersChange).toHaveBeenCalledWith({
      query: '',
      drivers: [],
      minSize: undefined,
      maxSize: undefined,
      mounted: undefined,
      unmounted: undefined,
    });
  });

  it('displays result count', () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        totalVolumes={100}
        filteredVolumes={25}
      />,
    );

    expect(screen.getByText('Showing 25 of 100 volumes')).toBeInTheDocument();
  });

  it('handles mount status filters', () => {
    const onFiltersChange = jest.fn();
    render(
      <VolumeSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        showAdvanced
      />,
    );

    // Open filters
    fireEvent.click(screen.getByText('Filters'));

    // Click mounted only
    fireEvent.click(screen.getByLabelText('Mounted only'));

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      mounted: true,
      unmounted: undefined,
    });
  });
});
