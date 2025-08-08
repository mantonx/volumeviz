/**
 * Tests for useLocalStorage hook
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';
import type { UseLocalStorageOptions } from './useLocalStorage.types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const renderUseLocalStorage = <T extends any>(
  key: string,
  defaultValue: T,
  options?: UseLocalStorageOptions,
) => {
  return renderHook(() => useLocalStorage(key, defaultValue, options));
};

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('should return default value when localStorage is empty', () => {
    const { result } = renderUseLocalStorage('test-key', 'default-value');
    
    expect(result.current[0]).toBe('default-value');
  });

  it('should return stored value from localStorage', () => {
    localStorageMock.setItem('test-key', JSON.stringify('stored-value'));
    
    const { result } = renderUseLocalStorage('test-key', 'default-value');
    
    expect(result.current[0]).toBe('stored-value');
  });

  it('should set value in localStorage', () => {
    const { result } = renderUseLocalStorage('test-key', 'default');
    
    act(() => {
      result.current[1]('new-value');
    });
    
    expect(result.current[0]).toBe('new-value');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify('new-value')
    );
  });

  it('should remove value from localStorage', () => {
    localStorageMock.setItem('test-key', JSON.stringify('stored-value'));
    
    const { result } = renderUseLocalStorage('test-key', 'default');
    
    act(() => {
      result.current[2](); // Remove function
    });
    
    expect(result.current[0]).toBe('default');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
  });

  it('should handle function updates', () => {
    const { result } = renderUseLocalStorage('test-key', 0);
    
    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    
    expect(result.current[0]).toBe(1);
  });

  it('should work with complex objects', () => {
    const defaultValue = { name: 'John', age: 30 };
    const newValue = { name: 'Jane', age: 25 };
    
    const { result } = renderUseLocalStorage('user-key', defaultValue);
    
    act(() => {
      result.current[1](newValue);
    });
    
    expect(result.current[0]).toEqual(newValue);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'user-key',
      JSON.stringify(newValue)
    );
  });

  it('should handle arrays', () => {
    const defaultValue = [1, 2, 3];
    const newValue = [4, 5, 6];
    
    const { result } = renderUseLocalStorage('array-key', defaultValue);
    
    act(() => {
      result.current[1](newValue);
    });
    
    expect(result.current[0]).toEqual(newValue);
  });

  it('should use custom serializer', () => {
    const customSerialize = jest.fn((value: any) => `custom-${JSON.stringify(value)}`);
    const customDeserialize = jest.fn((value: string) => 
      JSON.parse(value.replace('custom-', ''))
    );
    
    const { result } = renderUseLocalStorage('custom-key', 'default', {
      serialize: customSerialize,
      deserialize: customDeserialize,
    });
    
    act(() => {
      result.current[1]('test-value');
    });
    
    expect(customSerialize).toHaveBeenCalledWith('test-value');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'custom-key',
      'custom-"test-value"'
    );
  });

  it('should handle localStorage errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock localStorage.setItem to throw an error
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('Storage quota exceeded');
    });
    
    const { result } = renderUseLocalStorage('error-key', 'default');
    
    act(() => {
      result.current[1]('new-value');
    });
    
    // Should still have the new value in state
    expect(result.current[0]).toBe('new-value');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error setting localStorage key "error-key":',
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });

  it('should handle invalid JSON in localStorage', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Set invalid JSON directly
    localStorageMock.getItem.mockReturnValueOnce('invalid-json{');
    
    const { result } = renderUseLocalStorage('invalid-key', 'default');
    
    // Should return default value when JSON parsing fails
    expect(result.current[0]).toBe('default');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error parsing localStorage key "invalid-key":',
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });

  it('should sync across tabs when enabled', () => {
    const { result } = renderUseLocalStorage('sync-key', 'default', {
      syncAcrossTabs: true,
    });
    
    // Simulate storage event from another tab
    const storageEvent = new StorageEvent('storage', {
      key: 'sync-key',
      newValue: JSON.stringify('updated-from-other-tab'),
      storageArea: localStorage,
    });
    
    act(() => {
      window.dispatchEvent(storageEvent);
    });
    
    expect(result.current[0]).toBe('updated-from-other-tab');
  });

  it('should ignore storage events for other keys', () => {
    const { result } = renderUseLocalStorage('my-key', 'default', {
      syncAcrossTabs: true,
    });
    
    const originalValue = result.current[0];
    
    // Simulate storage event for different key
    const storageEvent = new StorageEvent('storage', {
      key: 'other-key',
      newValue: JSON.stringify('other-value'),
      storageArea: localStorage,
    });
    
    act(() => {
      window.dispatchEvent(storageEvent);
    });
    
    // Value should remain unchanged
    expect(result.current[0]).toBe(originalValue);
  });

  it('should handle storage event with null newValue (key removed)', () => {
    localStorageMock.setItem('remove-key', JSON.stringify('initial-value'));
    
    const { result } = renderUseLocalStorage('remove-key', 'default', {
      syncAcrossTabs: true,
    });
    
    expect(result.current[0]).toBe('initial-value');
    
    // Simulate key removal from another tab
    const storageEvent = new StorageEvent('storage', {
      key: 'remove-key',
      newValue: null,
      storageArea: localStorage,
    });
    
    act(() => {
      window.dispatchEvent(storageEvent);
    });
    
    expect(result.current[0]).toBe('default');
  });

  it('should cleanup storage event listener on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    
    const { unmount } = renderUseLocalStorage('cleanup-key', 'default', {
      syncAcrossTabs: true,
    });
    
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'storage',
      expect.any(Function)
    );
    
    removeEventListenerSpy.mockRestore();
  });

  it('should handle boolean values', () => {
    const { result } = renderUseLocalStorage('bool-key', false);
    
    act(() => {
      result.current[1](true);
    });
    
    expect(result.current[0]).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'bool-key',
      'true'
    );
  });

  it('should handle null values', () => {
    const { result } = renderUseLocalStorage('null-key', null);
    
    act(() => {
      result.current[1]('not-null');
    });
    
    expect(result.current[0]).toBe('not-null');
    
    act(() => {
      result.current[1](null);
    });
    
    expect(result.current[0]).toBe(null);
  });

  it('should handle undefined values', () => {
    const { result } = renderUseLocalStorage('undefined-key', undefined);
    
    expect(result.current[0]).toBe(undefined);
    
    act(() => {
      result.current[1]('defined');
    });
    
    expect(result.current[0]).toBe('defined');
  });

  it('should handle number values', () => {
    const { result } = renderUseLocalStorage('number-key', 42);
    
    act(() => {
      result.current[1](100);
    });
    
    expect(result.current[0]).toBe(100);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'number-key',
      '100'
    );
  });
});