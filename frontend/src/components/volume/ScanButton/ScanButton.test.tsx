import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import { ScanButton } from './ScanButton';
import { volumeService } from '../../../api/services';

jest.mock('../../../api/services', () => ({
  volumeService: {
    scanVolume: jest.fn(),
  },
}));

describe('ScanButton', () => {
  const mockScanVolume = volumeService.scanVolume as jest.MockedFunction<
    typeof volumeService.scanVolume
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<Provider>{ui}</Provider>);
  };

  it('renders default variant', () => {
    renderWithProvider(<ScanButton volumeId="test-volume" />);

    expect(screen.getByText('Scan Volume')).toBeInTheDocument();
  });

  it('renders icon variant', () => {
    renderWithProvider(<ScanButton volumeId="test-volume" variant="icon" />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Scan volume');
  });

  it('renders compact variant', () => {
    renderWithProvider(<ScanButton volumeId="test-volume" variant="compact" />);

    expect(screen.getByText('Scan')).toBeInTheDocument();
  });

  it('shows loading state during scan', async () => {
    mockScanVolume.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    renderWithProvider(<ScanButton volumeId="test-volume" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('Scanning...')).toBeInTheDocument();
    expect(button).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Scan Volume')).toBeInTheDocument();
    });
  });

  it('handles scan error', async () => {
    const error = new Error('Scan failed');
    mockScanVolume.mockRejectedValueOnce(error);
    const onScanError = jest.fn();

    renderWithProvider(
      <ScanButton volumeId="test-volume" onScanError={onScanError} />,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Retry Scan')).toBeInTheDocument();
      expect(onScanError).toHaveBeenCalledWith(error);
    });
  });

  it('calls onScanComplete on successful scan', async () => {
    const scanResult = { size: 1024, fileCount: 10 };
    mockScanVolume.mockResolvedValueOnce(scanResult);
    const onScanComplete = jest.fn();

    renderWithProvider(
      <ScanButton volumeId="test-volume" onScanComplete={onScanComplete} />,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(onScanComplete).toHaveBeenCalledWith(scanResult);
    });
  });

  it('shows last scan result when showStatus is true', async () => {
    const scanResult = { size: 1024, fileCount: 10 };
    mockScanVolume.mockResolvedValueOnce(scanResult);

    renderWithProvider(<ScanButton volumeId="test-volume" showStatus />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/Last scan:/)).toBeInTheDocument();
    });
  });

  it('respects size prop', () => {
    renderWithProvider(<ScanButton volumeId="test-volume" size="lg" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-lg');
  });
});
