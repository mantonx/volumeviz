/**
 * Integration Test Setup
 * Configures testing environment for integration tests
 */

import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock IntersectionObserver for virtual scrolling and image loading
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ResizeObserver for responsive components
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {}
  observe(target: Element) {}
  unobserve(target: Element) {}
  disconnect() {}
};

// Mock matchMedia for responsive breakpoint testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.scrollTo for scroll behavior tests
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
});

// Mock window.location for navigation tests
delete (window as any).location;
window.location = {
  ...window.location,
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
};

// Mock localStorage for state persistence tests
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    length: 0,
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: mockLocalStorage,
});

// Mock URL.createObjectURL for file upload tests
global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();

// Mock fetch for API calls (MSW will override this in tests)
global.fetch = jest.fn();

// Mock console methods to reduce noise in test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress specific console errors that are expected in tests
  console.error = (...args: any[]) => {
    // Suppress React warning about missing act() wrapper
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: An invalid form control')
    ) {
      return;
    }
    // Suppress MSW warnings in test environment
    if (typeof args[0] === 'string' && args[0].includes('[MSW]')) {
      return;
    }
    originalConsoleError(...args);
  };

  console.warn = (...args: any[]) => {
    // Suppress specific warnings
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('React Hook useEffect') ||
        args[0].includes('componentWillReceiveProps'))
    ) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Clean up after each test
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockLocalStorage.clear();
});

// Mock environment variables
process.env.VITE_API_BASE_URL = 'http://localhost:8080';
process.env.VITE_WS_URL = 'ws://localhost:8080/ws';
process.env.NODE_ENV = 'test';

// Mock imported modules that cause issues in test environment
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    children,
  BarChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => React.createElement('div', { 'data-testid': 'bar' }),
  XAxis: () => React.createElement('div', { 'data-testid': 'x-axis' }),
  YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
  CartesianGrid: () =>
    React.createElement('div', { 'data-testid': 'cartesian-grid' }),
  Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
  Legend: () => React.createElement('div', { 'data-testid': 'legend' }),
  PieChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'pie-chart' }, children),
  Pie: () => React.createElement('div', { 'data-testid': 'pie' }),
  Cell: () => React.createElement('div', { 'data-testid': 'cell' }),
  LineChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => React.createElement('div', { 'data-testid': 'line' }),
}));

// Mock react-router-dom navigation
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
  }),
  useParams: () => ({}),
}));

// Mock react-query devtools
jest.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => null,
}));

// Mock file reader for file upload tests
global.FileReader = class FileReader {
  readAsDataURL = jest.fn();
  readAsText = jest.fn();
  readAsArrayBuffer = jest.fn();
  readAsBinaryString = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn();
  abort = jest.fn();

  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  readyState: number = 0;

  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;
  onloadstart:
    | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
    | null = null;
  onprogress:
    | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
    | null = null;

  static readonly EMPTY = 0;
  static readonly LOADING = 1;
  static readonly DONE = 2;
};

// Mock crypto for ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () =>
      'mock-uuid-' + Math.random().toString(36).substring(2, 15),
    getRandomValues: (array: any) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  },
});

// Export test utilities
export const testUtils = {
  mockLocalStorage,

  // Helper to mock successful API responses
  mockApiSuccess: (data: any) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
      headers: new Headers({
        'content-type': 'application/json',
      }),
      status: 200,
      statusText: 'OK',
    });
  },

  // Helper to mock API errors
  mockApiError: (status: number, error: any) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve(error),
      headers: new Headers({
        'content-type': 'application/json',
      }),
      status,
      statusText: status === 404 ? 'Not Found' : 'Error',
    });
  },

  // Helper to mock network failures
  mockNetworkError: () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network request failed'),
    );
  },

  // Helper to wait for async operations
  waitForAsync: (ms: number = 0) =>
    new Promise((resolve) => setTimeout(resolve, ms)),

  // Helper to trigger resize events
  triggerResize: (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
    window.dispatchEvent(new Event('resize'));
  },

  // Helper to mock user media permissions
  mockUserMedia: (granted: boolean) => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: granted
          ? jest.fn().mockResolvedValue({})
          : jest.fn().mockRejectedValue(new Error('Permission denied')),
      },
    });
  },
};
