import * as React from 'react';
import type { WebSocketContextValue } from './types';

// Export the context for internal use
export const WebSocketContext = React.createContext<WebSocketContextValue | null>(null);

// Export the hook
export function useWebSocketContext(): WebSocketContextValue {
  const context = React.useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      'useWebSocketContext must be used within a WebSocketProvider',
    );
  }
  return context;
}