/**
 * WebSocket Connection Test Component
 *
 * Simple component for testing WebSocket reconnection behavior and error handling.
 * Used for manual testing and development verification.
 */

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/utils';

export const WebSocketConnectionTest: React.FC = () => {
  const ws = useWebSocket();
  const [connectionHistory, setConnectionHistory] = useState<
    Array<{
      timestamp: Date;
      event: string;
      status: string;
      details?: string;
    }>
  >([]);
  const [testResults, setTestResults] = useState<{
    reconnection: 'pass' | 'fail' | 'testing' | null;
    errorHandling: 'pass' | 'fail' | 'testing' | null;
    heartbeat: 'pass' | 'fail' | 'testing' | null;
  }>({
    reconnection: null,
    errorHandling: null,
    heartbeat: null,
  });

  // Log connection events
  useEffect(() => {
    const logEvent = (event: string, details?: string) => {
      setConnectionHistory((prev) => [
        ...prev.slice(-9),
        {
          timestamp: new Date(),
          event,
          status: ws.status,
          details,
        },
      ]);
    };

    const handleConnect = () => logEvent('Connected');
    const handleDisconnect = (data: any) =>
      logEvent('Disconnected', `Code: ${data?.code}`);
    const handleError = (data: any) =>
      logEvent('Error', data?.error || 'Unknown error');
    const handleReconnecting = (data: any) =>
      logEvent('Reconnecting', `Attempt ${data?.attempt}`);

    ws.on('connect', handleConnect);
    ws.on('disconnect', handleDisconnect);
    ws.on('error', handleError);
    ws.on('reconnecting', handleReconnecting);

    return () => {
      ws.off('connect', handleConnect);
      ws.off('disconnect', handleDisconnect);
      ws.off('error', handleError);
      ws.off('reconnecting', handleReconnecting);
    };
  }, [ws]);

  const testReconnection = async () => {
    setTestResults((prev) => ({ ...prev, reconnection: 'testing' }));

    try {
      // Force disconnect and wait for reconnection
      ws.disconnect();

      // Wait a moment then reconnect
      setTimeout(() => {
        ws.connect();
      }, 1000);

      // Check if reconnection succeeds within 10 seconds
      setTimeout(() => {
        if (ws.isConnected) {
          setTestResults((prev) => ({ ...prev, reconnection: 'pass' }));
        } else {
          setTestResults((prev) => ({ ...prev, reconnection: 'fail' }));
        }
      }, 10000);
    } catch (error) {
      setTestResults((prev) => ({ ...prev, reconnection: 'fail' }));
    }
  };

  const testErrorHandling = async () => {
    setTestResults((prev) => ({ ...prev, errorHandling: 'testing' }));

    try {
      // Send invalid message to test error handling
      const success = ws.send({
        type: 'invalid_test_message',
        data: { test: true },
      });

      if (success) {
        // Wait to see if connection remains stable
        setTimeout(() => {
          if (ws.isConnected && ws.status !== 'error') {
            setTestResults((prev) => ({ ...prev, errorHandling: 'pass' }));
          } else {
            setTestResults((prev) => ({ ...prev, errorHandling: 'fail' }));
          }
        }, 3000);
      } else {
        setTestResults((prev) => ({ ...prev, errorHandling: 'fail' }));
      }
    } catch (error) {
      setTestResults((prev) => ({ ...prev, errorHandling: 'fail' }));
    }
  };

  const testHeartbeat = async () => {
    setTestResults((prev) => ({ ...prev, heartbeat: 'testing' }));

    try {
      if (!ws.isConnected) {
        setTestResults((prev) => ({ ...prev, heartbeat: 'fail' }));
        return;
      }

      const initialLatency = ws.latency;

      // Send test ping and measure response
      ws.sendTest();

      // Check if latency is updated within 5 seconds (indicating heartbeat works)
      setTimeout(() => {
        if (ws.latency && ws.latency !== initialLatency) {
          setTestResults((prev) => ({ ...prev, heartbeat: 'pass' }));
        } else {
          setTestResults((prev) => ({ ...prev, heartbeat: 'fail' }));
        }
      }, 5000);
    } catch (error) {
      setTestResults((prev) => ({ ...prev, heartbeat: 'fail' }));
    }
  };

  const getResultColor = (result: 'pass' | 'fail' | 'testing' | null) => {
    switch (result) {
      case 'pass':
        return 'text-green-600 bg-green-50';
      case 'fail':
        return 'text-red-600 bg-red-50';
      case 'testing':
        return 'text-yellow-600 bg-yellow-50 animate-pulse';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getResultIcon = (result: 'pass' | 'fail' | 'testing' | null) => {
    switch (result) {
      case 'pass':
        return '✅';
      case 'fail':
        return '❌';
      case 'testing':
        return '🔄';
      default:
        return '⚪';
    }
  };

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          WebSocket Connection Test
        </h3>
        <p className="text-sm text-gray-600">
          Test WebSocket reconnection behavior and error handling.
        </p>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold">{ws.status}</div>
          <div className="text-sm text-gray-500">Status</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">
            {ws.latency ? `${ws.latency}ms` : '--'}
          </div>
          <div className="text-sm text-gray-500">Latency</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{ws.reconnectAttempts}</div>
          <div className="text-sm text-gray-500">Reconnect Attempts</div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={testReconnection}
          disabled={testResults.reconnection === 'testing'}
        >
          Test Reconnection
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={testErrorHandling}
          disabled={testResults.errorHandling === 'testing' || !ws.isConnected}
        >
          Test Error Handling
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={testHeartbeat}
          disabled={testResults.heartbeat === 'testing' || !ws.isConnected}
        >
          Test Heartbeat
        </Button>
      </div>

      {/* Test Results */}
      <div className="space-y-2">
        <h4 className="font-medium">Test Results</h4>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div
            className={cn(
              'p-2 rounded',
              getResultColor(testResults.reconnection),
            )}
          >
            <span className="mr-2">
              {getResultIcon(testResults.reconnection)}
            </span>
            Reconnection
          </div>
          <div
            className={cn(
              'p-2 rounded',
              getResultColor(testResults.errorHandling),
            )}
          >
            <span className="mr-2">
              {getResultIcon(testResults.errorHandling)}
            </span>
            Error Handling
          </div>
          <div
            className={cn('p-2 rounded', getResultColor(testResults.heartbeat))}
          >
            <span className="mr-2">{getResultIcon(testResults.heartbeat)}</span>
            Heartbeat
          </div>
        </div>
      </div>

      {/* Connection History */}
      <div className="space-y-2">
        <h4 className="font-medium">Connection History</h4>
        <div className="max-h-32 overflow-y-auto space-y-1 text-xs font-mono">
          {connectionHistory.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No events yet</div>
          ) : (
            connectionHistory.map((entry, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-1 bg-gray-50 rounded"
              >
                <div className="flex space-x-2">
                  <span className="text-gray-500">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="font-medium">{entry.event}</span>
                </div>
                <div className="flex space-x-2">
                  <span
                    className={cn(
                      'px-1 rounded text-xs',
                      entry.status === 'connected' &&
                        'bg-green-100 text-green-700',
                      entry.status === 'disconnected' &&
                        'bg-gray-100 text-gray-700',
                      entry.status === 'error' && 'bg-red-100 text-red-700',
                      entry.status === 'connecting' &&
                        'bg-yellow-100 text-yellow-700',
                      entry.status === 'reconnecting' &&
                        'bg-orange-100 text-orange-700',
                    )}
                  >
                    {entry.status}
                  </span>
                  {entry.details && (
                    <span className="text-gray-400">{entry.details}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Manual Controls */}
      <div className="flex space-x-2 pt-4 border-t">
        <Button
          size="sm"
          variant="outline"
          onClick={ws.connect}
          disabled={ws.isConnected}
        >
          Connect
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={ws.disconnect}
          disabled={!ws.isConnected}
        >
          Disconnect
        </Button>
        <Button size="sm" variant="outline" onClick={ws.reconnect}>
          Force Reconnect
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={ws.sendTest}
          disabled={!ws.isConnected}
        >
          Send Test
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setConnectionHistory([]);
            setTestResults({
              reconnection: null,
              errorHandling: null,
              heartbeat: null,
            });
          }}
        >
          Clear
        </Button>
      </div>
    </Card>
  );
};

export default WebSocketConnectionTest;
