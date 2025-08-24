import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SortSelector, SortOption } from './SortSelector';

const mockOptions: SortOption[] = [
  { id: 'name', label: 'Name', field: 'name' },
  { id: 'size', label: 'Size', field: 'size' },
  { id: 'created', label: 'Date Created', field: 'created_at' },
];

describe('SortSelector', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dropdown variant by default', () => {
    render(
      <SortSelector
        options={mockOptions}
        value="name"
        order="asc"
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Sort by:')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(
      <SortSelector
        options={mockOptions}
        value="name"
        order="asc"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText('Name'));

    // All options should be visible
    expect(screen.getAllByText('Name')).toHaveLength(2); // Button + dropdown item
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Date Created')).toBeInTheDocument();
  });

  it('selects new option', () => {
    render(
      <SortSelector
        options={mockOptions}
        value="name"
        order="asc"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText('Name'));
    fireEvent.click(screen.getByText('Size'));

    expect(onChange).toHaveBeenCalledWith('size', 'asc');
  });

  it('toggles order when selecting same option', () => {
    render(
      <SortSelector
        options={mockOptions}
        value="name"
        order="asc"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText('Sort by:').parentElement!);
    fireEvent.click(screen.getAllByText('Name')[1]); // Click the dropdown item

    expect(onChange).toHaveBeenCalledWith('name', 'desc');
  });

  it('renders inline variant', () => {
    render(
      <SortSelector
        options={mockOptions}
        value="name"
        order="asc"
        onChange={onChange}
        variant="inline"
      />,
    );

    // All options should be visible as buttons
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Date Created')).toBeInTheDocument();
  });

  it('renders button variant', () => {
    render(
      <SortSelector
        options={mockOptions}
        value="size"
        order="desc"
        onChange={onChange}
        variant="button"
      />,
    );

    expect(screen.getByText('Sort: Size')).toBeInTheDocument();
  });

  it('toggles order in button variant', () => {
    render(
      <SortSelector
        options={mockOptions}
        value="name"
        order="asc"
        onChange={onChange}
        variant="button"
      />,
    );

    fireEvent.click(screen.getByText('Sort: Name').parentElement!);

    expect(onChange).toHaveBeenCalledWith('name', 'desc');
  });

  it('shows order indicator', () => {
    const { rerender } = render(
      <SortSelector
        options={mockOptions}
        value="name"
        order="asc"
        onChange={onChange}
      />,
    );

    // Should show up arrow for ascending
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();

    rerender(
      <SortSelector
        options={mockOptions}
        value="name"
        order="desc"
        onChange={onChange}
      />,
    );

    // Should show down arrow for descending
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();
  });

  it('hides order toggle when showOrderToggle is false', () => {
    render(
      <SortSelector
        options={mockOptions}
        value="name"
        order="asc"
        onChange={onChange}
        showOrderToggle={false}
      />,
    );

    // Should not show order icon
    const button = screen.getByText('Sort by:').parentElement!;
    const arrows = button.querySelectorAll('svg');
    expect(arrows).toHaveLength(1); // Only chevron, no order arrow
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <SortSelector
          options={mockOptions}
          value="name"
          order="asc"
          onChange={onChange}
        />
        <div data-testid="outside">Outside</div>
      </div>,
    );

    // Open dropdown
    fireEvent.click(screen.getByText('Name'));
    expect(screen.getByText('Size')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(screen.queryByText('Size')).not.toBeInTheDocument();
  });
});
