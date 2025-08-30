/**
 * WebSocket Dev Panel
 *
 * Hidden dev panel for testing WebSocket functionality:
 * - Connection status display
 * - Send test events
 * - View recent messages
 * - Force reconnection
 *
 * Access via:
 * - Keyboard shortcut: Ctrl+Shift+W
 * - Environment: DEV mode only
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  Trash2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRealtime } from '@/providers/realtime';
import { ReadyState } from 'react-use-websocket';
import { cn } from '@/utils';

interface DevMessage {
  id: string;
  timestamp: Date;
  type: 'sent' | 'received' | 'system';
  data: any;
}

interface WebSocketDevPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WebSocketDevPanel: React.FC<WebSocketDevPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<DevMessage[]>([]);
  const [testMessage, setTestMessage] = useState(
    '{"type": "ping", "data": {"test": true}}',
  );
  const [autoScroll, setAutoScroll] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    connectionStatus,
    isConnected,
    latency,
    reconnectAttempts,
    lastMessage,
    sendMessage,
  } = useRealtime();

  // Scroll to bottom when new messages arrive (if auto-scroll enabled)
  const scrollToBottom = useCallback(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Add system message helper
  const addSystemMessage = useCallback(
    (text: string, type: 'info' | 'error' | 'success' = 'info') => {
      const message: DevMessage = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        type: 'system',
        data: { text, level: type },
      };
      setMessages((prev) => [...prev.slice(-99), message]); // Keep last 100 messages
    },
    [],
  );

  // Listen for connection status changes
  useEffect(() => {
    if (!isOpen) return;

    switch (connectionStatus) {
      case ReadyState.OPEN:
        addSystemMessage('WebSocket connected', 'success');
        break;
      case ReadyState.CLOSED:
        addSystemMessage('WebSocket disconnected', 'error');
        break;
      case ReadyState.CONNECTING:
        addSystemMessage('WebSocket connecting...', 'info');
        break;
    }
  }, [connectionStatus, isOpen, addSystemMessage]);

  // Listen for new messages
  useEffect(() => {
    if (!isOpen || !lastMessage) return;

    try {
      const data = JSON.parse(lastMessage.data);
      const message: DevMessage = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        type: 'received',
        data,
      };
      setMessages((prev) => [...prev.slice(-99), message]);
    } catch (error) {
      console.warn('Failed to parse WebSocket message:', error);
    }
  }, [lastMessage, isOpen]);

  const handleSendTest = () => {
    if (!isConnected) {
      addSystemMessage('Cannot send - not connected', 'error');
      return;
    }

    try {
      const testData = { type: 'ping', data: { test: true } };
      sendMessage(testData);

      const message: DevMessage = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        type: 'sent',
        data: testData,
      };
      setMessages((prev) => [...prev.slice(-99), message]);
      addSystemMessage('Test message sent', 'success');
    } catch (error) {
      addSystemMessage('Failed to send test message', 'error');
    }
  };

  const handleSendCustom = () => {
    if (!isConnected) {
      addSystemMessage('Cannot send - not connected', 'error');
      return;
    }

    try {
      const data = JSON.parse(testMessage);
      sendMessage(data);

      const message: DevMessage = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        type: 'sent',
        data,
      };
      setMessages((prev) => [...prev.slice(-99), message]);
      addSystemMessage('Custom message sent', 'success');
    } catch (error) {
      addSystemMessage(`Invalid JSON: ${error}`, 'error');
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
    addSystemMessage('Messages cleared', 'info');
  };

  const getStatusText = (status: ReadyState) => {
    switch (status) {
      case ReadyState.CONNECTING:
        return 'connecting';
      case ReadyState.OPEN:
        return 'connected';
      case ReadyState.CLOSING:
        return 'disconnecting';
      case ReadyState.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  };

  const getStatusColor = (status: ReadyState) => {
    switch (status) {
      case ReadyState.OPEN:
        return 'text-green-500';
      case ReadyState.CONNECTING:
        return 'text-yellow-500';
      case ReadyState.CLOSING:
      case ReadyState.CLOSED:
        return 'text-gray-400';
      default:
        return 'text-red-500';
    }
  };

  const getStatusIcon = (status: ReadyState) => {
    switch (status) {
      case ReadyState.OPEN:
        return <Wifi className="h-4 w-4" />;
      case ReadyState.CONNECTING:
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderMessage = (message: DevMessage) => {
    const isSystem = message.type === 'system';
    const isSent = message.type === 'sent';

    return (
      <div
        key={message.id}
        className={cn(
          'flex items-start space-x-2 p-2 rounded text-xs font-mono border-l-2',
          isSystem && 'bg-gray-50 border-l-gray-400 dark:bg-gray-800',
          isSent && 'bg-blue-50 border-l-blue-400 dark:bg-blue-900/20',
          !isSystem &&
            !isSent &&
            'bg-green-50 border-l-green-400 dark:bg-green-900/20',
        )}
      >
        <div className="flex-shrink-0 text-gray-500 w-16">
          {formatTimestamp(message.timestamp)}
        </div>
        <div className="flex-shrink-0">
          {isSystem && <AlertCircle className="h-3 w-3 text-gray-400" />}
          {isSent && <Send className="h-3 w-3 text-blue-500" />}
          {!isSystem && !isSent && (
            <CheckCircle className="h-3 w-3 text-green-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {isSystem ? (
            <span
              className={cn(
                message.data.level === 'error' && 'text-red-600',
                message.data.level === 'success' && 'text-green-600',
                message.data.level === 'info' && 'text-gray-600',
              )}
            >
              {message.data.text}
            </span>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(message.data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card
        data-testid="websocket-dev-panel"
        className="w-full max-w-4xl h-3/4 flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold">WebSocket Dev Panel</h3>
            <div
              className={cn(
                'flex items-center space-x-2',
                getStatusColor(connectionStatus),
              )}
            >
              {getStatusIcon(connectionStatus)}
              <span className="text-sm font-medium capitalize">
                {getStatusText(connectionStatus)}
              </span>
              {latency && (
                <span className="text-xs text-gray-500">({latency}ms)</span>
              )}
            </div>
            {reconnectAttempts > 0 && (
              <span className="text-xs text-yellow-600">
                Attempt {reconnectAttempts}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-4 space-y-4">
          {/* Control Panel */}
          <div className="flex items-center space-x-4">
            <Button
              data-testid="send-test-btn"
              size="sm"
              onClick={handleSendTest}
              disabled={!isConnected}
            >
              Send Test Ping
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearMessages}>
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              <span>Auto-scroll</span>
            </label>
            <span className="text-xs text-gray-500">
              {messages.length} messages
            </span>
          </div>

          {/* Custom Message */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Custom JSON message"
              className="flex-1 px-3 py-2 text-xs font-mono border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!isConnected}
            />
            <Button
              size="sm"
              onClick={handleSendCustom}
              disabled={!isConnected}
            >
              Send
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 border rounded bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <div
              data-testid="dev-message-log"
              className="h-full overflow-y-auto p-2 space-y-1"
            >
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  No messages yet. Send a test message or wait for events.
                </div>
              ) : (
                messages.map(renderMessage)
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Connection Info */}
          <div className="text-xs text-gray-500 space-y-1">
            <div>
              Last Message:{' '}
              {lastMessage?.timeStamp
                ? new Date(lastMessage.timeStamp).toLocaleTimeString()
                : 'None'}
            </div>
            <div>
              Environment: {import.meta.env.DEV ? 'Development' : 'Production'}
            </div>
            <div>WebSocket URL: {import.meta.env.VITE_WS_URL || 'Default'}</div>
            <div>
              WebSocket Enabled:{' '}
              {import.meta.env.VITE_ENABLE_WEBSOCKET || 'false'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Global keyboard shortcut hook
export const useWebSocketDevPanel = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+W to toggle dev panel
      if (event.ctrlKey && event.shiftKey && event.key === 'W') {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // Escape to close
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (import.meta.env.DEV) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  return {
    isOpen,
    openPanel: () => setIsOpen(true),
    closePanel: () => setIsOpen(false),
  };
};

export default WebSocketDevPanel;
