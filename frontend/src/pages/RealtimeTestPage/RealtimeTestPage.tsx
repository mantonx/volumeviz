import React, { useEffect, useState } from 'react';
import { useRealtime, type ScanProgressData } from '@/providers/realtime';

const RealtimeTest: React.FC = () => {
  const { isConnected, subscribe, unsubscribe, onScanProgress, onScanEvent } =
    useRealtime();
  const [messages, setMessages] = useState<any[]>([]);
  const [subscribed, setSubscribed] = useState(false);

  // Track statistics
  const [stats, setStats] = useState({
    totalReceived: 0,
    scanProgressUpdates: 0,
    scanEvents: 0,
    lastReceived: null as Date | null,
  });

  useEffect(() => {
    if (!isConnected) return;

    let cleanupProgress: (() => void) | null = null;
    let cleanupEvents: (() => void) | null = null;

    if (subscribed) {
      // Subscribe to scan progress updates
      cleanupProgress = onScanProgress((data: ScanProgressData) => {
        const timestampedMessage = {
          type: 'scan.progress',
          data,
          receivedAt: new Date().toISOString(),
          messageNumber: stats.totalReceived + 1,
        };

        console.log('Scan Progress Update:', data);
        setMessages((prev) => [timestampedMessage, ...prev].slice(0, 50)); // Keep last 50 messages

        setStats((prev) => ({
          ...prev,
          totalReceived: prev.totalReceived + 1,
          scanProgressUpdates: prev.scanProgressUpdates + 1,
          lastReceived: new Date(),
        }));
      });

      // Subscribe to scan events (started, completed, failed)
      cleanupEvents = onScanEvent((type: string, data: any) => {
        const timestampedMessage = {
          type: `scan.${type}`,
          data,
          receivedAt: new Date().toISOString(),
          messageNumber: stats.totalReceived + 1,
        };

        console.log('Scan Event:', type, data);
        setMessages((prev) => [timestampedMessage, ...prev].slice(0, 50));

        setStats((prev) => ({
          ...prev,
          totalReceived: prev.totalReceived + 1,
          scanEvents: prev.scanEvents + 1,
          lastReceived: new Date(),
        }));
      });
    }

    return () => {
      cleanupProgress?.();
      cleanupEvents?.();
    };
  }, [isConnected, subscribed, onScanProgress, onScanEvent]);

  const handleSubscribe = () => {
    // Subscribe to scan progress for all volumes
    subscribe('scan.progress', {});
    setSubscribed(true);
  };

  const handleUnsubscribe = () => {
    unsubscribe('scan.progress', {});
    setSubscribed(false);
  };

  const handleStartScan = async () => {
    try {
      const response = await fetch(
        '/api/v1/volumes/volumeviz_movies_dev/scan',
        {
          method: 'POST',
        },
      );
      const result = await response.json();
      console.log('Scan started:', result);
    } catch (error) {
      console.error('Failed to start scan:', error);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setStats({
      totalReceived: 0,
      scanProgressUpdates: 0,
      scanEvents: 0,
      lastReceived: null,
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Realtime WebSocket Test</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 bg-gray-100 rounded">
          <h2 className="text-lg font-semibold mb-2">Connection Status</h2>
          <p>
            WebSocket:{' '}
            <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </p>
          <p>
            Subscribed:{' '}
            <span className={subscribed ? 'text-green-600' : 'text-red-600'}>
              {subscribed ? 'Yes' : 'No'}
            </span>
          </p>
        </div>

        <div className="p-4 bg-blue-50 rounded">
          <h2 className="text-lg font-semibold mb-2">Message Statistics</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              Total Received:{' '}
              <span className="font-bold">{stats.totalReceived}</span>
            </div>
            <div>
              Scan Progress:{' '}
              <span className="font-bold">{stats.scanProgressUpdates}</span>
            </div>
            <div>
              Scan Events: <span className="font-bold">{stats.scanEvents}</span>
            </div>
          </div>
          {stats.lastReceived && (
            <div className="mt-2 text-xs text-gray-600">
              Last received: {stats.lastReceived.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={subscribed ? handleUnsubscribe : handleSubscribe}
          disabled={!isConnected}
          className={`px-4 py-2 ${subscribed ? 'bg-red-500' : 'bg-blue-500'} text-white rounded disabled:opacity-50`}
        >
          {subscribed ? 'Unsubscribe' : 'Subscribe'}
        </button>

        <button
          onClick={handleStartScan}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Start Test Scan
        </button>

        <button
          onClick={clearMessages}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Clear Messages
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">
          Recent Messages ({messages.length})
        </h2>
        <div className="max-h-96 overflow-y-auto bg-black text-green-400 p-4 rounded font-mono text-xs">
          {messages.length === 0 ? (
            <p className="text-gray-400">No messages received yet...</p>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="mb-2 pb-2 border-b border-green-900">
                <div className="text-yellow-400">
                  [#{msg.messageNumber}] {msg.receivedAt}
                </div>
                <div className="text-blue-400">Type: {msg.type}</div>
                {msg.data?.volume_id && (
                  <div className="text-purple-400">
                    Volume: {msg.data.volume_id}
                  </div>
                )}
                {msg.data?.scan_id && (
                  <div className="text-cyan-400">Scan: {msg.data.scan_id}</div>
                )}
                {msg.data?.overall_progress !== undefined && (
                  <div className="text-orange-400">
                    Progress: {msg.data.overall_progress}%
                  </div>
                )}
                <details className="mt-1">
                  <summary className="cursor-pointer text-gray-400">
                    Raw Data
                  </summary>
                  <pre className="mt-1 text-xs overflow-x-auto">
                    {JSON.stringify(msg.data, null, 2)}
                  </pre>
                </details>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RealtimeTest;
