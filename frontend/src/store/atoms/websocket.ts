import { atom } from 'jotai';

export type WebSocketStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'error';

export interface WebSocketState {
  status: WebSocketStatus;
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastMessage: Date | null;
  latency: number | null;
}

// WebSocket connection state atom
export const websocketStateAtom = atom<WebSocketState>({
  status: 'disconnected',
  isConnected: false,
  error: null,
  reconnectAttempts: 0,
  lastMessage: null,
  latency: null,
});

// Computed WebSocket status for UI display
export const websocketStatusAtom = atom<WebSocketStatus>((get) => {
  return get(websocketStateAtom).status;
});

// WebSocket enabled feature flag atom
export const websocketEnabledAtom = atom<boolean>(false);

// Combined connection status for status indicator
export interface ConnectionStatus {
  api: 'online' | 'offline' | 'connecting' | 'error';
  websocket: WebSocketStatus;
  websocketEnabled: boolean;
}

// Combined status atom for the header component
export const connectionStatusAtom = atom<ConnectionStatus>((get) => {
  return {
    api: 'online', // API status handled by TanStack Query now
    websocket: get(websocketStatusAtom),
    websocketEnabled: get(websocketEnabledAtom),
  };
});
