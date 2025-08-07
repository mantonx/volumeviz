import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VolumeActions } from './VolumeActions';
import { Volume } from '../../../types/api';

const mockVolume: Volume = {
  id: 'test-volume',
  name: 'test-volume',
  driver: 'local',
  mount_point: '/var/lib/docker/volumes/test-volume/_data',
  created_at: '2024-01-15T10:00:00Z',
  size: 1073741824,
  mount_count: 2,
  labels: {},
  options: {},
};

describe('VolumeActions', () => {
  const onAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dropdown variant by default', () => {
    render(<VolumeActions volume={mockVolume} onAction={onAction} />);

    const button = screen.getByLabelText('Volume actions');
    expect(button).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<VolumeActions volume={mockVolume} onAction={onAction} />);

    const button = screen.getByLabelText('Volume actions');
    fireEvent.click(button);

    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onAction when action is clicked', () => {
    render(<VolumeActions volume={mockVolume} onAction={onAction} />);

    fireEvent.click(screen.getByLabelText('Volume actions'));
    fireEvent.click(screen.getByText('View Details'));

    expect(onAction).toHaveBeenCalledWith('view', mockVolume);
  });

  it('renders inline variant', () => {
    render(
      <VolumeActions
        volume={mockVolume}
        onAction={onAction}
        variant="inline"
      />,
    );

    // All action buttons should be visible
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('renders menu variant', () => {
    render(
      <VolumeActions volume={mockVolume} onAction={onAction} variant="menu" />,
    );

    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('handles custom actions', () => {
    const customActions = [
      { id: 'custom1', label: 'Custom Action 1', icon: <span>Icon1</span> },
      { id: 'custom2', label: 'Custom Action 2', icon: <span>Icon2</span> },
    ];

    render(
      <VolumeActions
        volume={mockVolume}
        onAction={onAction}
        actions={customActions}
      />,
    );

    fireEvent.click(screen.getByLabelText('Volume actions'));

    expect(screen.getByText('Custom Action 1')).toBeInTheDocument();
    expect(screen.getByText('Custom Action 2')).toBeInTheDocument();
  });

  it('respects disabled actions', () => {
    const actions = [
      { id: 'action1', label: 'Enabled', icon: <span>Icon</span> },
      {
        id: 'action2',
        label: 'Disabled',
        icon: <span>Icon</span>,
        disabled: true,
      },
    ];

    render(
      <VolumeActions
        volume={mockVolume}
        onAction={onAction}
        actions={actions}
      />,
    );

    fireEvent.click(screen.getByLabelText('Volume actions'));

    const disabledButton = screen.getByText('Disabled').closest('button');
    expect(disabledButton).toBeDisabled();
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <VolumeActions volume={mockVolume} onAction={onAction} />
        <div data-testid="outside">Outside</div>
      </div>,
    );

    // Open dropdown
    fireEvent.click(screen.getByLabelText('Volume actions'));
    expect(screen.getByText('View Details')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(screen.queryByText('View Details')).not.toBeInTheDocument();
  });

  it('applies danger styling to danger actions', () => {
    render(<VolumeActions volume={mockVolume} onAction={onAction} />);

    fireEvent.click(screen.getByLabelText('Volume actions'));

    const deleteButton = screen.getByText('Delete').closest('button');
    expect(deleteButton).toHaveClass('text-red-600');
  });
});
