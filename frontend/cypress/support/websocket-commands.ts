/**
 * WebSocket Test Shim for Cypress E2E Tests
 * 
 * This file provides a test-only WebSocket shim that replaces the real WebSocket
 * connection with a controllable interface for deterministic testing.
 */

/// <reference types="cypress" />

/**
 * WebSocket test shim interface
 */
interface TestWebSocketShim {
  // Connection state
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  url: string;
  
  // Event management
  emit: (eventType: string, data: any) => void;
  on: (eventType: string, handler: (data: any) => void) => void;
  off: (eventType: string, handler: (data: any) => void) => void;
  
  // Connection control
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  
  // Test utilities
  getState: () => any;
  cleanup: () => void;
  simulateError: (error: string) => void;
  simulateLatency: (ms: number) => void;
}

/**
 * Create a WebSocket test shim instance
 */
function createWebSocketShim(url: string): TestWebSocketShim {
  const eventHandlers = new Map<string, Set<Function>>();
  let connectionState: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';
  let simulatedLatency = 0;
  let connectionTimeout: NodeJS.Timeout | null = null;
  
  const shim: TestWebSocketShim = {
    state: connectionState,
    url,
    
    emit(eventType: string, data: any) {
      const handlers = eventHandlers.get(eventType);
      if (handlers) {
        const eventData = {
          type: eventType,
          ts: new Date().toISOString(),
          data
        };
        
        // Simulate latency if configured
        if (simulatedLatency > 0) {
          setTimeout(() => {
            handlers.forEach(handler => {
              try {
                handler(eventData);
              } catch (error) {
                console.warn(`WebSocket shim handler error for ${eventType}:`, error);
              }
            });
          }, simulatedLatency);
        } else {
          handlers.forEach(handler => {
            try {
              handler(eventData);
            } catch (error) {
              console.warn(`WebSocket shim handler error for ${eventType}:`, error);
            }
          });
        }
      }
    },
    
    on(eventType: string, handler: (data: any) => void) {
      if (!eventHandlers.has(eventType)) {
        eventHandlers.set(eventType, new Set());
      }
      eventHandlers.get(eventType)!.add(handler);
    },
    
    off(eventType: string, handler: (data: any) => void) {
      const handlers = eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          eventHandlers.delete(eventType);
        }
      }
    },
    
    connect() {
      if (connectionState !== 'disconnected') {
        return;
      }
      
      connectionState = 'connecting';
      shim.state = connectionState;
      
      // Emit connecting state change
      shim.emit('state_change', { state: 'connecting' });
      
      // Simulate connection delay
      connectionTimeout = setTimeout(() => {
        if (connectionState === 'connecting') {
          connectionState = 'connected';
          shim.state = connectionState;
          shim.emit('state_change', { state: 'connected' });
          shim.emit('open', {});
        }
      }, 100);
    },
    
    disconnect() {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      
      if (connectionState !== 'disconnected') {
        connectionState = 'disconnected';
        shim.state = connectionState;
        shim.emit('state_change', { state: 'disconnected' });
        shim.emit('close', { code: 1000, reason: 'Manual disconnect' });
      }
    },
    
    reconnect() {
      shim.disconnect();
      setTimeout(() => shim.connect(), 50);
    },
    
    getState() {
      return {
        state: connectionState,
        url,
        eventHandlers: Array.from(eventHandlers.keys()),
        simulatedLatency,
      };
    },
    
    cleanup() {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      eventHandlers.clear();
      connectionState = 'disconnected';
      shim.state = connectionState;
    },
    
    simulateError(error: string) {
      connectionState = 'error';
      shim.state = connectionState;
      shim.emit('state_change', { state: 'error', error });
      shim.emit('error', { message: error, timestamp: new Date().toISOString() });
    },
    
    simulateLatency(ms: number) {
      simulatedLatency = Math.max(0, ms);
    }
  };
  
  return shim;
}

/**
 * Set up WebSocket test shim on window object
 */
Cypress.Commands.add('setupWebSocketShim', (options?: {
  url?: string;
  autoConnect?: boolean;
  latency?: number;
}) => {
  const config = {
    url: options?.url || Cypress.env('WS_URL') || 'ws://localhost:8080/api/v1/ws',
    autoConnect: options?.autoConnect ?? true,
    latency: options?.latency || 0,
    ...options
  };
  
  cy.window().then((win) => {
    // Create the shim
    const shim = createWebSocketShim(config.url);
    
    // Set up latency if specified
    if (config.latency > 0) {
      shim.simulateLatency(config.latency);
    }
    
    // Attach to window
    win.__TEST_WS__ = shim;
    
    // Auto-connect if requested
    if (config.autoConnect) {
      shim.connect();
    }
    
    // Log setup for debugging
    if (Cypress.env('DEBUG_WS')) {
      console.log('WebSocket shim setup:', {
        url: config.url,
        autoConnect: config.autoConnect,
        latency: config.latency
      });
    }
  });
});

/**
 * Wait for WebSocket connection to be established
 */
Cypress.Commands.add('waitForWebSocketConnection', (timeout: number = 5000) => {
  cy.window().then((win) => {
    if (!win.__TEST_WS__) {
      throw new Error('WebSocket shim not initialized. Call cy.setupWebSocketShim() first.');
    }
    
    // If already connected, return immediately
    if (win.__TEST_WS__.state === 'connected') {
      return;
    }
    
    // Wait for connection
    return new Cypress.Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`WebSocket connection timeout after ${timeout}ms`));
      }, timeout);
      
      const onStateChange = (data: any) => {
        if (data.data.state === 'connected') {
          clearTimeout(timeoutId);
          win.__TEST_WS__.off('state_change', onStateChange);
          resolve();
        } else if (data.data.state === 'error') {
          clearTimeout(timeoutId);
          win.__TEST_WS__.off('state_change', onStateChange);
          reject(new Error(`WebSocket connection failed: ${data.data.error || 'Unknown error'}`));
        }
      };
      
      win.__TEST_WS__.on('state_change', onStateChange);
      
      // Start connection if not already connecting
      if (win.__TEST_WS__.state === 'disconnected') {
        win.__TEST_WS__.connect();
      }
    });
  });
});

/**
 * Disconnect WebSocket and wait for disconnection
 */
Cypress.Commands.add('disconnectWebSocket', () => {
  cy.window().then((win) => {
    if (win.__TEST_WS__ && win.__TEST_WS__.state !== 'disconnected') {
      win.__TEST_WS__.disconnect();
      
      // Wait a bit for the state to update
      cy.wait(100);
    }
  });
});

/**
 * Simulate WebSocket reconnection scenarios
 */
Cypress.Commands.add('simulateWebSocketReconnection', (options?: {
  disconnectDuration?: number;
  maxAttempts?: number;
}) => {
  const config = {
    disconnectDuration: 1000,
    maxAttempts: 3,
    ...options
  };
  
  cy.window().then((win) => {
    if (!win.__TEST_WS__) {
      throw new Error('WebSocket shim not initialized');
    }
    
    // Simulate connection loss
    win.__TEST_WS__.simulateError('Connection lost');
    
    // Wait for disconnect duration
    cy.wait(config.disconnectDuration);
    
    // Reconnect
    win.__TEST_WS__.reconnect();
    
    // Wait for reconnection
    cy.waitForWebSocketConnection();
  });
});

/**
 * Emit a custom WebSocket event for testing
 */
Cypress.Commands.add('emitWebSocketEvent', (eventType: string, data: any) => {
  cy.window().then((win) => {
    if (!win.__TEST_WS__) {
      throw new Error('WebSocket shim not initialized');
    }
    
    win.__TEST_WS__.emit(eventType, data);
  });
});

/**
 * Wait for a specific WebSocket event
 */
Cypress.Commands.add('waitForWebSocketEvent', (eventType: string, timeout: number = 5000) => {
  cy.window().then((win) => {
    if (!win.__TEST_WS__) {
      throw new Error('WebSocket shim not initialized');
    }
    
    return new Cypress.Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        win.__TEST_WS__.off(eventType, eventHandler);
        reject(new Error(`Timeout waiting for WebSocket event '${eventType}' after ${timeout}ms`));
      }, timeout);
      
      const eventHandler = (data: any) => {
        clearTimeout(timeoutId);
        win.__TEST_WS__.off(eventType, eventHandler);
        resolve(data);
      };
      
      win.__TEST_WS__.on(eventType, eventHandler);
    });
  });
});

/**
 * Check WebSocket connection state
 */
Cypress.Commands.add('checkWebSocketState', (expectedState: 'connecting' | 'connected' | 'disconnected' | 'error') => {
  cy.window().then((win) => {
    if (!win.__TEST_WS__) {
      throw new Error('WebSocket shim not initialized');
    }
    
    expect(win.__TEST_WS__.state).to.equal(expectedState);
  });
});

/**
 * Get WebSocket debug information
 */
Cypress.Commands.add('getWebSocketDebugInfo', () => {
  cy.window().then((win) => {
    if (!win.__TEST_WS__) {
      return null;
    }
    
    return win.__TEST_WS__.getState();
  });
});

// Extend Cypress command interface
declare global {
  namespace Cypress {
    interface Chainable {
      setupWebSocketShim(options?: {
        url?: string;
        autoConnect?: boolean;
        latency?: number;
      }): Chainable<void>;
      waitForWebSocketConnection(timeout?: number): Chainable<void>;
      disconnectWebSocket(): Chainable<void>;
      simulateWebSocketReconnection(options?: {
        disconnectDuration?: number;
        maxAttempts?: number;
      }): Chainable<void>;
      emitWebSocketEvent(eventType: string, data: any): Chainable<void>;
      waitForWebSocketEvent(eventType: string, timeout?: number): Chainable<any>;
      checkWebSocketState(expectedState: 'connecting' | 'connected' | 'disconnected' | 'error'): Chainable<void>;
      getWebSocketDebugInfo(): Chainable<any>;
    }
  }
}

// Global window interface extension
declare global {
  interface Window {
    __TEST_WS__?: TestWebSocketShim;
    __TEST_DATA__?: any;
    __TEST_MODE__?: boolean;
  }
}