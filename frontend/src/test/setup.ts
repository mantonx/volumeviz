/**
 * Global test environment setup.
 */

import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom ships its own fetch/Request/Response/Headers/AbortController that
// live in a different realm than Node's native (undici-backed) globals MSW's
// node interceptor expects. Passing a jsdom AbortSignal into an intercepted
// fetch fails an `instanceof AbortSignal` check inside undici, so requests
// hang forever instead of resolving or rejecting. Overriding jsdom's fetch
// globals with Node's native ones keeps everything in the same realm.
const undici = await import('undici');
globalThis.fetch = undici.fetch as unknown as typeof fetch;
globalThis.Request = undici.Request as unknown as typeof Request;
globalThis.Response = undici.Response as unknown as typeof Response;
globalThis.Headers = undici.Headers as unknown as typeof Headers;

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock matchMedia for components that use theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for components that use it
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver for components that use it
(globalThis as any).IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

// Mock localStorage/sessionStorage with a real in-memory store behind
// vi.fn() wrappers, so both real persist-and-restore behavior AND
// toHaveBeenCalledWith-style call assertions work. A prior version of this
// mock was pure no-op stubs (getItem always returned undefined regardless of
// what setItem was called with) - individual test files had been working
// around this by redefining window.localStorage themselves; fixed here so
// every test file gets working storage by default.
function createStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) =>
      Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
    ),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };
}

Object.defineProperty(window, 'localStorage', {
  value: createStorageMock(),
});

Object.defineProperty(window, 'sessionStorage', {
  value: createStorageMock(),
});

// The jest-dom matchers are automatically extended by importing '@testing-library/jest-dom'
// No need to manually extend expect - this happens automatically with the import above
