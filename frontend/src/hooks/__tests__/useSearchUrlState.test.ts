/**
 * Tests for useSearchUrlState hook
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useSearchUrlState } from '../useUrlState';

// Mock useSearchParams and useNavigate
const mockSetSearchParams = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
    useNavigate: () => mockNavigate,
  };
});

describe('useSearchUrlState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(BrowserRouter, null, children);
  };

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSearchUrlState(), { wrapper });
    const [state] = result.current;

    expect(state.q).toBe('');
    expect(state.sort).toBe('name');
    expect(state.order).toBe('asc');
    expect(state.page).toBe(1);
    expect(state.perPage).toBe(20);
    expect(state.mime).toEqual([]);
  });

  it('should update URL state correctly', () => {
    const { result } = renderHook(() => useSearchUrlState(), { wrapper });
    const [, setState] = result.current;

    act(() => {
      setState({
        q: 'test search',
        sort: 'size',
        order: 'desc',
        page: 2,
      });
    });

    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it('should handle MIME type arrays correctly', () => {
    const { result } = renderHook(() => useSearchUrlState(), { wrapper });
    const [, setState] = result.current;

    act(() => {
      setState({
        mime: ['video/mp4', 'video/x-matroska'],
      });
    });

    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it('should handle boolean filters correctly', () => {
    const { result } = renderHook(() => useSearchUrlState(), { wrapper });
    const [, setState] = result.current;

    act(() => {
      setState({
        hasGps: true,
        hasSubs: false,
        hashPresent: true,
      });
    });

    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it('should not include default values in URL', () => {
    const { result } = renderHook(() => useSearchUrlState(), { wrapper });
    const [, setState] = result.current;

    act(() => {
      setState({
        sort: 'name', // Default value
        order: 'asc', // Default value
        page: 1, // Default value
        perPage: 20, // Default value
      });
    });

    // Should be called but with empty params since all are defaults
    expect(mockSetSearchParams).toHaveBeenCalled();
    const [[params]] = mockSetSearchParams.mock.calls;
    expect(Array.from(params.keys())).toHaveLength(0);
  });
});
