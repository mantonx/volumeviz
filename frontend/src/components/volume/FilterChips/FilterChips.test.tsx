import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChips, FilterChip } from './FilterChips';

describe('FilterChips', () => {
  const mockChips: FilterChip[] = [
    { id: '1', type: 'driver', label: 'Driver', value: 'local' },
    { id: '2', type: 'size', label: 'Min Size', value: 1073741824 },
    { id: '3', type: 'status', label: 'Status', value: 'mounted' },
  ];

  it('renders all chips', () => {
    render(<FilterChips chips={mockChips} onRemove={jest.fn()} />);

    expect(screen.getByText('Driver: local')).toBeInTheDocument();
    expect(screen.getByText('Min Size: 1.00 GB')).toBeInTheDocument();
    expect(screen.getByText('Status: mounted')).toBeInTheDocument();
  });

  it('renders nothing when chips array is empty', () => {
    const { container } = render(
      <FilterChips chips={[]} onRemove={jest.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onRemove when chip remove button is clicked', () => {
    const onRemove = jest.fn();
    render(<FilterChips chips={mockChips} onRemove={onRemove} />);

    const removeButtons = screen.getAllByLabelText(/Remove .* filter/);
    fireEvent.click(removeButtons[0]);

    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('shows clear all button when onClearAll is provided and multiple chips', () => {
    const onClearAll = jest.fn();
    render(
      <FilterChips
        chips={mockChips}
        onRemove={jest.fn()}
        onClearAll={onClearAll}
      />,
    );

    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('does not show clear all button with single chip', () => {
    const onClearAll = jest.fn();
    render(
      <FilterChips
        chips={[mockChips[0]]}
        onRemove={jest.fn()}
        onClearAll={onClearAll}
      />,
    );

    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('calls onClearAll when clear all button is clicked', () => {
    const onClearAll = jest.fn();
    render(
      <FilterChips
        chips={mockChips}
        onRemove={jest.fn()}
        onClearAll={onClearAll}
      />,
    );

    fireEvent.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('formats size values correctly', () => {
    const chips: FilterChip[] = [
      { id: '1', type: 'size', label: 'Size', value: 0 },
      { id: '2', type: 'size', label: 'Size', value: 1024 },
      { id: '3', type: 'size', label: 'Size', value: 1048576 },
    ];

    render(<FilterChips chips={chips} onRemove={jest.fn()} />);

    expect(screen.getByText('Size: 0 B')).toBeInTheDocument();
    expect(screen.getByText('Size: 1.00 KB')).toBeInTheDocument();
    expect(screen.getByText('Size: 1.00 MB')).toBeInTheDocument();
  });

  it('applies size classes', () => {
    const { container } = render(
      <FilterChips chips={mockChips} onRemove={jest.fn()} size="sm" />,
    );

    const chip = container.querySelector('.text-xs');
    expect(chip).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { container } = render(
      <FilterChips chips={mockChips} onRemove={jest.fn()} variant="solid" />,
    );

    const chip = container.querySelector('.bg-blue-100');
    expect(chip).toBeInTheDocument();
  });

  it('handles custom type chips', () => {
    const customChip: FilterChip = {
      id: 'custom',
      type: 'custom',
      label: 'Custom Filter',
      value: 'custom value',
    };

    render(<FilterChips chips={[customChip]} onRemove={jest.fn()} />);

    expect(screen.getByText('Custom Filter: custom value')).toBeInTheDocument();
  });
});
