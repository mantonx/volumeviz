/**
 * Example: Using the usePolling hook
 *
 * This demonstrates how to use the usePolling hook with the shell atoms
 * for automatic data fetching with polling capabilities.
 */

import { useAtom } from 'jotai';
import { useCallback, useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { pollingIntervalAtom } from '../store/atoms/shell';

// Mock API function
const fetchVolumeData = async (): Promise<{
  volumes: number;
  updated: string;
}> => {
  const response = await fetch('/api/v1/volumes');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return {
    volumes: data.data?.length || 0,
    updated: new Date().toISOString(),
  };
};

export const PollingExample = () => {
  const [data, setData] = useState<{ volumes: number; updated: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useAtom(pollingIntervalAtom);

  // Define the polling function
  const pollData = useCallback(async () => {
    try {
      const newData = await fetchVolumeData();
      setData(newData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Handle polling errors
  const handlePollingError = useCallback((err: Error) => {
    console.error('Polling error:', err);
    setError(`Polling failed: ${err.message}`);
  }, []);

  // Setup polling
  const polling = usePolling({
    pollFn: pollData,
    onError: handlePollingError,
    pauseOnHidden: true,
    startOnMount: true,
  });

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Polling Example</h2>

      {/* Status display */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center space-x-2">
          <span
            className={`h-3 w-3 rounded-full ${
              polling.state.isPolling
                ? 'bg-green-500'
                : polling.state.isPaused
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
          />
          <span className="text-sm font-medium">
            Status:{' '}
            {polling.state.isPolling && !polling.state.isPaused
              ? 'Polling Active'
              : polling.state.isPaused
                ? 'Paused'
                : 'Stopped'}
          </span>
        </div>

        {polling.state.errorCount > 0 && (
          <div className="text-sm text-red-600">
            Errors: {polling.state.errorCount}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mb-4 flex space-x-2">
        <button
          onClick={polling.start}
          disabled={polling.state.isPolling}
          className="px-3 py-1 bg-green-500 text-white rounded text-sm disabled:bg-gray-300"
        >
          Start
        </button>
        <button
          onClick={polling.stop}
          disabled={!polling.state.isPolling}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm disabled:bg-gray-300"
        >
          Stop
        </button>
        <button
          onClick={polling.pause}
          disabled={!polling.state.isPolling || polling.state.isPaused}
          className="px-3 py-1 bg-yellow-500 text-white rounded text-sm disabled:bg-gray-300"
        >
          Pause
        </button>
        <button
          onClick={polling.resume}
          disabled={!polling.state.isPaused}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:bg-gray-300"
        >
          Resume
        </button>
      </div>

      {/* Interval control */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Polling Interval (ms)
        </label>
        <input
          type="number"
          value={pollingInterval}
          onChange={(e) => setPollingInterval(Number(e.target.value))}
          min="1000"
          step="1000"
          className="border rounded px-2 py-1 w-32 text-sm"
        />
      </div>

      {/* Data display */}
      <div className="space-y-2">
        <h3 className="font-medium">Data:</h3>
        {error ? (
          <div className="text-red-600 text-sm">{error}</div>
        ) : data ? (
          <div className="text-sm">
            <p>Volumes: {data.volumes}</p>
            <p>Last Updated: {new Date(data.updated).toLocaleTimeString()}</p>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">No data yet...</div>
        )}
      </div>
    </div>
  );
};
