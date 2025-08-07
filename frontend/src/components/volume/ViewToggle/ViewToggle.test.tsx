import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewToggle, ViewOption, ViewType } from './ViewToggle';

const mockOptions: ViewOption[] = [
  {
    id: 'cards',
    label: 'Cards',
    icon: <div data-testid="cards-icon">Cards</div>,
  },
  { id: 'list', label: 'List', icon: <div data-testid="list-icon">List</div> },
  {
    id: 'table',
    label: 'Table',
    icon: <div data-testid="table-icon">Table</div>,
  },
];

describe('ViewToggle', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders segmented variant by default', () => {
    render(
      <ViewToggle value="cards" onChange={onChange} options={mockOptions} />,
    );

    expect(screen.getByTestId('cards-icon')).toBeInTheDocument();
    expect(screen.getByTestId('list-icon')).toBeInTheDocument();
    expect(screen.getByTestId('table-icon')).toBeInTheDocument();
  });

  it('calls onChange when option is clicked', () => {
    render(
      <ViewToggle value="cards" onChange={onChange} options={mockOptions} />,
    );

    fireEvent.click(screen.getByTestId('list-icon').closest('button')!);
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('renders buttons variant', () => {
    render(
      <ViewToggle
        value="cards"
        onChange={onChange}
        options={mockOptions}
        variant="buttons"
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('renders dropdown variant', () => {
    render(
      <ViewToggle
        value="list"
        onChange={onChange}
        options={mockOptions}
        variant="dropdown"
      />,
    );

    expect(screen.getByText('List')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(
      <ViewToggle
        value="cards"
        onChange={onChange}
        options={mockOptions}
        variant="dropdown"
      />,
    );

    fireEvent.click(screen.getByText('Cards'));

    // All options should be visible in dropdown
    expect(screen.getAllByText('Cards')).toHaveLength(2); // Button + dropdown item
    expect(screen.getByText('List')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
  });

  it('selects option from dropdown', () => {
    render(
      <ViewToggle
        value="cards"
        onChange={onChange}
        options={mockOptions}
        variant="dropdown"
      />,
    );

    fireEvent.click(screen.getByText('Cards'));
    fireEvent.click(screen.getByText('List'));

    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('shows labels when showLabels is true', () => {
    render(
      <ViewToggle
        value="cards"
        onChange={onChange}
        options={mockOptions}
        showLabels
      />,
    );

    expect(screen.getByText('Cards')).toBeInTheDocument();
    expect(screen.getByText('List')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
  });

  it('applies correct active state', () => {
    render(
      <ViewToggle value="list" onChange={onChange} options={mockOptions} />,
    );

    const listButton = screen.getByTestId('list-icon').closest('button')!;
    const cardsButton = screen.getByTestId('cards-icon').closest('button')!;

    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(cardsButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('handles custom options', () => {
    const customOptions: ViewOption[] = [
      { id: 'custom1', label: 'Custom 1', icon: <div>Icon1</div> },
      { id: 'custom2', label: 'Custom 2', icon: <div>Icon2</div> },
    ];

    render(
      <ViewToggle
        value="custom1"
        onChange={onChange}
        options={customOptions}
        showLabels
      />,
    );

    expect(screen.getByText('Custom 1')).toBeInTheDocument();
    expect(screen.getByText('Custom 2')).toBeInTheDocument();
  });

  it('applies size classes', () => {
    const { container } = render(
      <ViewToggle
        value="cards"
        onChange={onChange}
        options={mockOptions}
        size="lg"
      />,
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('text-lg');
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <ViewToggle
          value="cards"
          onChange={onChange}
          options={mockOptions}
          variant="dropdown"
        />
        <div data-testid="outside">Outside</div>
      </div>,
    );

    // Open dropdown
    fireEvent.click(screen.getByText('Cards'));
    expect(screen.getAllByText('Cards')).toHaveLength(2);

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));

    // Should close dropdown
    expect(screen.getAllByText('Cards')).toHaveLength(1);
  });
});
