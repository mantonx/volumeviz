import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VolumeCardWithProgress } from './VolumeCardWithProgress';
import type { Volume } from '../../../api/generated/Api';

describe('VolumeCardWithProgress', () => {
  const mockVolume: Volume = {
    id: '1',
    name: 'Test Volume',
    path: '/mnt/test',
    mount_point: '/mnt/test',
    total_size: 1024 * 1024 * 1024,
    file_count: 1000,
    folder_count: 50,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockScanProgress = {
    scanId: 'scan-1',
    volumeId: '1',
    status: 'running' as const,
    phase: 'filesystem_indexing' as const,
    progress: 45,
    phaseProgress: 60,
    filesScanned: 450,
    foldersScanned: 25,
    currentPath: '/mnt/test/documents/reports',
    filesPerSecond: 150,
    bytesPerSecond: 1024 * 1024 * 10,
    errorsCount: 2,
    startedAt: '2024-01-01T00:00:00Z',
    estimatedRemaining: 180,
  };

  it('renders volume information', () => {
    render(<VolumeCardWithProgress volume={mockVolume} />);
    
    expect(screen.getByText('Test Volume')).toBeInTheDocument();
    expect(screen.getByText('/mnt/test')).toBeInTheDocument();
    expect(screen.getByText('1 GB')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('displays scan progress when scanning', () => {
    render(
      <VolumeCardWithProgress 
        volume={mockVolume} 
        scanProgress={mockScanProgress}
      />
    );
    
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('Indexing Files')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('450 files • 25 folders • 150 files/s • 10 MB/s')).toBeInTheDocument();
    expect(screen.getByText('3m 0s remaining')).toBeInTheDocument();
    expect(screen.getByText('/mnt/test/documents/reports')).toBeInTheDocument();
    expect(screen.getByText('2 errors occurred')).toBeInTheDocument();
  });

  it('shows appropriate controls based on scan status', () => {
    const onScanStart = jest.fn();
    const onScanPause = jest.fn();
    const onScanStop = jest.fn();
    
    const { rerender } = render(
      <VolumeCardWithProgress 
        volume={mockVolume}
        onScanStart={onScanStart}
        onScanPause={onScanPause}
        onScanStop={onScanStop}
      />
    );
    
    expect(screen.getByText('Start Scan')).toBeInTheDocument();
    
    rerender(
      <VolumeCardWithProgress 
        volume={mockVolume}
        scanProgress={mockScanProgress}
        onScanStart={onScanStart}
        onScanPause={onScanPause}
        onScanStop={onScanStop}
      />
    );
    
    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.queryByText('Start Scan')).not.toBeInTheDocument();
  });

  it('handles control button clicks', () => {
    const onScanStart = jest.fn();
    const onScanPause = jest.fn();
    const onScanStop = jest.fn();
    const onScanResume = jest.fn();
    const onViewDetails = jest.fn();
    
    const { rerender } = render(
      <VolumeCardWithProgress 
        volume={mockVolume}
        onScanStart={onScanStart}
        onScanPause={onScanPause}
        onScanStop={onScanStop}
        onScanResume={onScanResume}
        onViewDetails={onViewDetails}
      />
    );
    
    fireEvent.click(screen.getByText('Start Scan'));
    expect(onScanStart).toHaveBeenCalled();
    
    rerender(
      <VolumeCardWithProgress 
        volume={mockVolume}
        scanProgress={mockScanProgress}
        onScanStart={onScanStart}
        onScanPause={onScanPause}
        onScanStop={onScanStop}
        onScanResume={onScanResume}
        onViewDetails={onViewDetails}
      />
    );
    
    fireEvent.click(screen.getByText('Pause'));
    expect(onScanPause).toHaveBeenCalled();
    
    fireEvent.click(screen.getByText('Stop'));
    expect(onScanStop).toHaveBeenCalled();
    
    fireEvent.click(screen.getByText('View Details'));
    expect(onViewDetails).toHaveBeenCalled();
  });

  it('shows resume button when paused', () => {
    const onScanResume = jest.fn();
    
    render(
      <VolumeCardWithProgress 
        volume={mockVolume}
        scanProgress={{
          ...mockScanProgress,
          status: 'paused',
        }}
        onScanResume={onScanResume}
      />
    );
    
    expect(screen.getByText('Resume')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Resume'));
    expect(onScanResume).toHaveBeenCalled();
  });

  it('handles different scan phases', () => {
    const { rerender } = render(
      <VolumeCardWithProgress 
        volume={mockVolume}
        scanProgress={{
          ...mockScanProgress,
          phase: 'volume_scan',
        }}
      />
    );
    
    expect(screen.getByText('Scanning Volume')).toBeInTheDocument();
    
    rerender(
      <VolumeCardWithProgress 
        volume={mockVolume}
        scanProgress={{
          ...mockScanProgress,
          phase: 'media_enrichment',
        }}
      />
    );
    
    expect(screen.getByText('Enriching Media')).toBeInTheDocument();
  });

  it('handles card click', () => {
    const onClick = jest.fn();
    
    render(
      <VolumeCardWithProgress 
        volume={mockVolume}
        onClick={onClick}
      />
    );
    
    fireEvent.click(screen.getByTestId('volume-card-with-progress'));
    expect(onClick).toHaveBeenCalled();
  });

  it('prevents event bubbling on button clicks', () => {
    const onClick = jest.fn();
    const onScanStart = jest.fn();
    
    render(
      <VolumeCardWithProgress 
        volume={mockVolume}
        onClick={onClick}
        onScanStart={onScanStart}
      />
    );
    
    fireEvent.click(screen.getByText('Start Scan'));
    expect(onScanStart).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('handles missing scan stats gracefully', () => {
    render(
      <VolumeCardWithProgress 
        volume={mockVolume}
        scanProgress={{
          scanId: 'scan-1',
          volumeId: '1',
          status: 'running',
          progress: 50,
        }}
      />
    );
    
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('formats time remaining correctly', () => {
    const { rerender } = render(
      <VolumeCardWithProgress 
        volume={mockVolume}
        scanProgress={{
          ...mockScanProgress,
          estimatedRemaining: 7265,
        }}
      />
    );
    
    expect(screen.getByText('2h 1m remaining')).toBeInTheDocument();
    
    rerender(
      <VolumeCardWithProgress 
        volume={mockVolume}
        scanProgress={{
          ...mockScanProgress,
          estimatedRemaining: 45,
        }}
      />
    );
    
    expect(screen.getByText('45s remaining')).toBeInTheDocument();
  });
});