import React, { useEffect, useState, useRef } from 'react';

const WebSocketTest: React.FC = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${msg}`;
    setMessages(prev => [...prev, logMessage]);
    console.log(`[WebSocketTest] ${msg}`);
  };

  const connect = () => {
    if (ws) {
      ws.close();
    }

    log('Connecting to ws://localhost:8080/api/v1/ws...');
    const socket = new WebSocket('ws://localhost:8080/api/v1/ws');

    socket.onopen = () => {
      log('✅ WebSocket connected! ReadyState: ' + socket.readyState);
      setIsConnected(true);
      setWs(socket);
      
      // Send multiple subscriptions with tiny delay to ensure connection is fully established
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          // Subscribe to scan progress
          const scanProgressMsg = {
            action: 'subscribe',
            event: 'scan.progress', 
            filters: {}
          };
          socket.send(JSON.stringify(scanProgressMsg));
          log('📤 Sent scan.progress subscription: ' + JSON.stringify(scanProgressMsg));

          // Subscribe to volume updates
          const volumeUpdatesMsg = {
            action: 'subscribe',
            event: 'volume.updates',
            filters: {}
          };
          socket.send(JSON.stringify(volumeUpdatesMsg));
          log('📤 Sent volume.updates subscription: ' + JSON.stringify(volumeUpdatesMsg));

          // Subscribe to system events
          const systemEventsMsg = {
            action: 'subscribe',
            event: 'system.events',
            filters: {}
          };
          socket.send(JSON.stringify(systemEventsMsg));
          log('📤 Sent system.events subscription: ' + JSON.stringify(systemEventsMsg));
        } else {
          log('⚠️ Cannot send subscription - connection not open (readyState: ' + socket.readyState + ')');
        }
      }, 10); // 10ms delay
    };

    socket.onmessage = (event) => {
      log('📥 Received: ' + event.data);
      try {
        const parsed = JSON.parse(event.data);
        
        // Highlight different message types
        if (parsed.type === 'scan.progress') {
          log('🔄 SCAN PROGRESS: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'scan.progress.initial') {
          log('📊 INITIAL SCAN STATE: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'scan.status') {
          log('📈 VOLUME STATUS: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'scan.started') {
          log('🚀 SCAN STARTED: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'scan.completed') {
          log('✅ SCAN COMPLETED: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'scan.failed') {
          log('❌ SCAN FAILED: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'volume.updated') {
          log('💾 VOLUME UPDATE: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'volume.state') {
          log('🔄 LIVE VOLUME STATE: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'volume.updates.initial') {
          log('📁 INITIAL VOLUME STATE: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type === 'system.events.initial') {
          log('🔧 INITIAL SYSTEM STATE: ' + JSON.stringify(parsed.data, null, 2));
        } else if (parsed.type.startsWith('system.')) {
          log('⚙️ SYSTEM: ' + parsed.type + ' - ' + JSON.stringify(parsed.data, null, 2));
        }
      } catch (e) {
        // Just log raw message
      }
    };

    socket.onerror = (error) => {
      log('❌ WebSocket error: ' + JSON.stringify(error));
    };

    socket.onclose = (event) => {
      log('🔌 WebSocket closed: ' + event.code + ' ' + event.reason);
      setIsConnected(false);
      setWs(null);
    };
  };

  const startScan = async () => {
    log('🚀 Starting scan...');
    try {
      const response = await fetch('/api/v1/volumes/volumeviz_movies_dev/scan', {
        method: 'POST',
      });
      const result = await response.json();
      log('✅ Scan started: ' + JSON.stringify(result));
    } catch (error) {
      log('❌ Failed to start scan: ' + (error as Error).message);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  // Auto-connect when component mounts
  useEffect(() => {
    let mounted = true;
    
    if (mounted) {
      connect();
    }
    
    // Cleanup function to close WebSocket on unmount
    return () => {
      mounted = false;
      if (ws) {
        ws.close();
      }
    };
  }, []); // Empty dependency array

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Direct WebSocket Test (Auto-Connect)</h1>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p>Status: <span className={isConnected ? 'text-green-600 font-bold' : 'text-red-600'}>
          {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </span></p>
        <p className="text-sm text-gray-600 mt-1">Auto-connects on page load. Check console for real-time messages.</p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={connect}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          🔌 Connect WebSocket
        </button>

        <button
          onClick={startScan}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          🚀 Start Scan
        </button>

        <button
          onClick={clearMessages}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          🧹 Clear
        </button>
      </div>

      <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-gray-400">Connecting automatically... Check console for real-time progress messages.</p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="mb-1">
              {msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WebSocketTest;
