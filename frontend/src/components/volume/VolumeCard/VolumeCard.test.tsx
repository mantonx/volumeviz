import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'jotai';
import { VolumeCard } from './VolumeCard';
import type { VolumeData } from './VolumeCard.types';

const mockVolume: VolumeData = {
  id: 'vol_12345',
  name: 'my-app-data',
  driver: 'local',
  isActive: true,
  containerCount: 3,
  mountpoint: '/var/lib/docker/volumes/my-app-data/_data',
  labels: {
    app: 'myapp',
    environment: 'production',
    version: '1.2.3',
  },
  createdAt: '2024-01-15T10:30:00Z',
};

const mockInactiveVolume: VolumeData = {
  id: 'vol_67890',
  name: 'old-cache',
  driver: 'local',
  isActive: false,
  containerCount: 0,
};

describe('VolumeCard', () => {
  it('renders volume information correctly', () => {
    render(
      <Provider>
        <VolumeCard volume={mockVolume} />
      </Provider>,
    );

    expect(screen.getByText('my-app-data')).toBeInTheDocument();
    expect(screen.getByText('local • vol_12345')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows inactive status for inactive volumes', () => {
    render(
      <Provider>
        <VolumeCard volume={mockInactiveVolume} />
      </Provider>,
    );

    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('displays not scanned message when no scan results', () => {
    render(
      <Provider>
        <VolumeCard volume={mockVolume} />
      </Provider>,
    );

    expect(screen.getByText('Not scanned')).toBeInTheDocument();
    expect(screen.getByText('Never scanned')).toBeInTheDocument();
  });

  it('handles quick action callbacks', () => {
    const onScan = vi.fn();
    const onManage = vi.fn();
    const onViewDetails = vi.fn();

    render(
      <Provider>
        <VolumeCard
          volume={mockVolume}
          onScan={onScan}
          onManage={onManage}
          onViewDetails={onViewDetails}
        />
      </Provider>,
    );

    fireEvent.click(screen.getByText('Scan'));
    expect(onScan).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Details'));
    expect(onViewDetails).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '' })); // More options button
    expect(onManage).toHaveBeenCalled();
  });

  it('hides quick actions when showQuickActions is false', () => {
    render(
      <Provider>
        <VolumeCard volume={mockVolume} showQuickActions={false} />
      </Provider>,
    );

    expect(screen.queryByText('Scan')).not.toBeInTheDocument();
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('renders compact variant with reduced information', () => {
    render(
      <Provider>
        <VolumeCard volume={mockVolume} variant="compact" />
      </Provider>,
    );

    // Should not show mount point in compact variant
    expect(
      screen.queryByText('/var/lib/docker/volumes/my-app-data/_data'),
    ).not.toBeInTheDocument();
  });

  it('renders detailed variant with labels', () => {
    render(
      <Provider>
        <VolumeCard volume={mockVolume} variant="detailed" />
      </Provider>,
    );

    // Should show labels in detailed variant
    expect(screen.getByText('app=myapp')).toBeInTheDocument();
    expect(screen.getByText('environment=production')).toBeInTheDocument();
  });

  it('disables scan button for inactive volumes', () => {
    render(
      <Provider>
        <VolumeCard volume={mockInactiveVolume} />
      </Provider>,
    );

    const scanButton = screen.getByText('Scan').closest('button');
    expect(scanButton).toBeDisabled();
  });

  it('applies custom className', () => {
    render(
      <Provider>
        <VolumeCard
          volume={mockVolume}
          className="custom-class"
          data-testid="volume-card"
        />
      </Provider>,
    );

    expect(screen.getByTestId('volume-card')).toHaveClass('custom-class');
  });

  it('truncates long volume names', () => {
    const longNameVolume: VolumeData = {
      ...mockVolume,
      name: 'very-long-volume-name-that-should-be-truncated-in-the-ui',
    };

    render(
      <Provider>
        <VolumeCard volume={longNameVolume} />
      </Provider>,
    );

    const nameElement = screen.getByText(
      'very-long-volume-name-that-should-be-truncated-in-the-ui',
    );
    expect(nameElement).toHaveClass('truncate');
  });

  it('shows label count when more than 4 labels exist', () => {
    const manyLabelsVolume: VolumeData = {
      ...mockVolume,
      labels: {
        label1: 'value1',
        label2: 'value2',
        label3: 'value3',
        label4: 'value4',
        label5: 'value5',
        label6: 'value6',
      },
    };

    render(
      <Provider>
        <VolumeCard volume={manyLabelsVolume} variant="detailed" />
      </Provider>,
    );

    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
