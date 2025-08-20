/**
 * SearchFilters Test Suite
 *
 * Tests for filter functionality and state management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAtomValue } from 'jotai';
import { SearchFilters } from '../SearchFilters';
import { advancedFiltersAtom } from '@/store/atoms/search';

// Mock Jotai provider
const TestProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <div>{children}</div>;
};

// Mock hook to capture filter state changes
let mockFilterState: any = {
  mimeTypes: [],
  sizeRange: {},
  timeRange: {},
  durationRange: {},
  dimensionsRange: { width: {}, height: {} },
  booleanFilters: {},
};

jest.mock('jotai', () => ({
  useAtom: (atom: any) => {
    if (atom === advancedFiltersAtom) {
      return [
        mockFilterState,
        (newState: any) => {
          if (typeof newState === 'function') {
            mockFilterState = newState(mockFilterState);
          } else {
            mockFilterState = newState;
          }
        },
      ];
    }
    return [null, jest.fn()];
  },
  useAtomValue: jest.fn(),
  useSetAtom: jest.fn(),
  atom: jest.fn(),
}));

describe('SearchFilters', () => {
  beforeEach(() => {
    // Reset filter state before each test
    mockFilterState = {
      mimeTypes: [],
      sizeRange: {},
      timeRange: {},
      durationRange: {},
      dimensionsRange: { width: {}, height: {} },
      booleanFilters: {},
    };
  });

  describe('Media Type Filter', () => {
    it('should render media type filter dropdown', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const mediaTypeSelect = screen.getByLabelText(/media type/i);
      expect(mediaTypeSelect).toBeInTheDocument();

      // Check all media type options are present
      expect(screen.getByText('All Media Types')).toBeInTheDocument();
      expect(screen.getByText('Video')).toBeInTheDocument();
      expect(screen.getByText('Audio')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
      expect(screen.getByText('Document')).toBeInTheDocument();
    });

    it('should update media kind when selection changes', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const mediaTypeSelect = screen.getByLabelText(/media type/i);
      fireEvent.change(mediaTypeSelect, { target: { value: 'video' } });

      expect(mockFilterState.mediaKind).toBe('video');
    });

    it('should clear media kind when "All Media Types" is selected', () => {
      mockFilterState.mediaKind = 'video';

      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const mediaTypeSelect = screen.getByLabelText(/media type/i);
      fireEvent.change(mediaTypeSelect, { target: { value: '' } });

      expect(mockFilterState.mediaKind).toBeUndefined();
    });
  });

  describe('File Size Filter', () => {
    it('should render size filter with presets and custom inputs', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      expect(screen.getByLabelText(/file size/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/min \(mb\)/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/max \(mb\)/i)).toBeInTheDocument();
    });

    it('should apply size preset correctly', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const sizeSelect = screen.getByLabelText(/file size/i);
      fireEvent.change(sizeSelect, { target: { value: 'Small (< 10 MB)' } });

      expect(mockFilterState.sizeRange.max).toBe(10 * 1024 * 1024); // 10MB in bytes
      expect(mockFilterState.sizeRange.min).toBeUndefined();
    });

    it('should handle custom size input correctly', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const minSizeInput = screen.getByPlaceholderText(/min \(mb\)/i);
      fireEvent.change(minSizeInput, { target: { value: '5' } });

      expect(mockFilterState.sizeRange.min).toBe(5 * 1024 * 1024); // 5MB in bytes
    });

    it('should clear custom size when input is empty', () => {
      mockFilterState.sizeRange = { min: 5 * 1024 * 1024 };

      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const minSizeInput = screen.getByPlaceholderText(/min \(mb\)/i);
      fireEvent.change(minSizeInput, { target: { value: '' } });

      expect(mockFilterState.sizeRange.min).toBeUndefined();
    });
  });

  describe('Time Range Filter', () => {
    it('should render date inputs for time range', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const dateInputs = screen.getAllByDisplayValue('');
      expect(dateInputs.length).toBeGreaterThan(0);
    });

    it('should format date correctly for API', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const dateInputs = document.querySelectorAll('input[type="date"]');
      const fromDateInput = dateInputs[0] as HTMLInputElement;

      fireEvent.change(fromDateInput, { target: { value: '2023-12-01' } });

      expect(mockFilterState.timeRange.from).toBe('2023-12-01T00:00:00Z');
    });
  });

  describe('Boolean Filters', () => {
    it('should render checkbox filters for features', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      expect(screen.getByText(/has gps coordinates/i)).toBeInTheDocument();
      expect(screen.getByText(/has subtitles/i)).toBeInTheDocument();
      expect(screen.getByText(/has file hash/i)).toBeInTheDocument();
    });

    it('should toggle boolean filters correctly', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const gpsCheckbox = screen.getByRole('checkbox', {
        name: /has gps coordinates/i,
      });
      fireEvent.click(gpsCheckbox);

      expect(mockFilterState.booleanFilters.hasGps).toBe(true);

      fireEvent.click(gpsCheckbox);
      expect(mockFilterState.booleanFilters.hasGps).toBeUndefined();
    });
  });

  describe('Filter State Integration', () => {
    it('should display active filters summary', () => {
      mockFilterState = {
        mediaKind: 'video',
        mimeTypes: ['video/mp4'],
        sizeRange: { min: 100 * 1024 * 1024 },
        timeRange: {},
        durationRange: {},
        dimensionsRange: { width: {}, height: {} },
        booleanFilters: { hasGps: true },
      };

      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      expect(screen.getByText(/Media: video/i)).toBeInTheDocument();
      expect(screen.getByText(/MIME Types: 1/i)).toBeInTheDocument();
      expect(screen.getByText(/GPS/i)).toBeInTheDocument();
    });

    it('should clear all filters when clear button is clicked', () => {
      mockFilterState = {
        mediaKind: 'video',
        mimeTypes: ['video/mp4'],
        sizeRange: { min: 100 * 1024 * 1024 },
        timeRange: { from: '2023-01-01T00:00:00Z' },
        durationRange: { min: 1000 },
        dimensionsRange: { width: { min: 1920 }, height: {} },
        booleanFilters: { hasGps: true },
      };

      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const clearButton = screen.getByText(/clear all/i);
      fireEvent.click(clearButton);

      expect(mockFilterState).toEqual({
        mimeTypes: [],
        sizeRange: {},
        timeRange: {},
        durationRange: {},
        dimensionsRange: { width: {}, height: {} },
        booleanFilters: {},
      });
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle invalid number inputs gracefully', () => {
      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      const minSizeInput = screen.getByPlaceholderText(/min \(mb\)/i);
      fireEvent.change(minSizeInput, { target: { value: 'abc' } });

      // Should not crash and should result in undefined/NaN handling
      expect(mockFilterState.sizeRange.min).toBeFalsy();
    });

    it('should handle empty MIME type array correctly', () => {
      mockFilterState.mimeTypes = [];

      render(
        <TestProvider>
          <SearchFilters />
        </TestProvider>,
      );

      // Should not crash with empty MIME types
      expect(
        screen.getByText(/MIME Types \(0 selected\)/i),
      ).toBeInTheDocument();
    });
  });
});
