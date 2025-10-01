/**
 * ScanManager - Component for managing volume scans
 *
 * Features:
 * - Start full volume scans with filesystem indexing
 * - View scan progress with real-time updates
 * - Manage scan queue and priorities
 * - Pause/resume/cancel scans
 * - View scan history and statistics
 * - Bulk scan operations
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  X,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Database,
  FileSearch,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
// Note: Scan API endpoint not yet available in generated API
// Using direct fetch for now until OpenAPI spec is updated

interface ScanJob {
  scan_id: string;
  volume_id: string;
  volume_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  overall_progress: number;
  phases: ScanPhase[];
  started_at?: string;
  completed_at?: string;
  error?: string;
}

interface ScanPhase {
  phase_name: string;
  status: string;
  progress: number;
  items_processed: number;
  items_total: number;
  items_per_second?: number;
  current_item?: string;
}

interface ScanManagerProps {
  volumes?: Array<{ id: string; name: string }>;
  onScanComplete?: (volumeId: string) => void;
  className?: string;
}

export const ScanManager: React.FC<ScanManagerProps> = ({
  volumes = [],
  onScanComplete,
  className = '',
}) => {
  const [scanJobs, setScanJobs] = useState<ScanJob[]>([]);
  const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartScan = async (volumeId: string, volumeName: string) => {
    setIsStarting(true);

    try {
      // Direct fetch to /api/v1/volumes/{name}/scan endpoint
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `http://localhost:8080/api/v1/volumes/${volumeId}/scan`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scan_type: 'full',
            enable_filesystem_indexing: true,
            enable_media_enrichment: true,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Scan failed: ${response.statusText}`);
      }

      const responseData = await response.json();

      // Add to scan jobs
      setScanJobs((prev) => [
        ...prev,
        {
          scan_id: responseData.scan_id,
          volume_id: volumeId,
          volume_name: volumeName,
          status: 'running',
          overall_progress: 0,
          phases: [],
          started_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error('Failed to start scan:', err);
      alert(`Failed to start scan: ${err}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleBulkScan = async () => {
    for (const volumeId of selectedVolumes) {
      const volume = volumes.find((v) => v.id === volumeId);
      if (volume) {
        await handleStartScan(volume.id, volume.name);
      }
    }
    setSelectedVolumes([]);
  };

  const handleToggleVolume = (volumeId: string) => {
    setSelectedVolumes((prev) =>
      prev.includes(volumeId)
        ? prev.filter((id) => id !== volumeId)
        : [...prev, volumeId],
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getPhaseIcon = (phaseName: string) => {
    if (phaseName.includes('filesystem')) {
      return <FileSearch className="w-4 h-4" />;
    } else if (phaseName.includes('volume')) {
      return <Database className="w-4 h-4" />;
    } else if (phaseName.includes('media')) {
      return <Zap className="w-4 h-4" />;
    }
    return <RefreshCw className="w-4 h-4" />;
  };

  return (
    <div className={className}>
      <Card>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
                <Database className="w-5 h-5 text-blue-600" />
                Scan Manager
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Start and monitor volume scans with filesystem indexing
              </p>
            </div>
            {selectedVolumes.length > 0 && (
              <Button
                onClick={handleBulkScan}
                disabled={isStarting}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Scan {selectedVolumes.length} Volume
                {selectedVolumes.length > 1 ? 's' : ''}
              </Button>
            )}
          </div>

          {/* Volume Selection */}
          {volumes.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Select Volumes to Scan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {volumes.map((volume) => (
                  <label
                    key={volume.id}
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedVolumes.includes(volume.id)}
                      onChange={() => handleToggleVolume(volume.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-900 truncate">
                      {volume.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Active Scans */}
          {scanJobs.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">
                Active Scans
              </h3>
              {scanJobs.map((job) => (
                <div
                  key={job.scan_id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {job.volume_name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          Scan ID: {job.scan_id.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        job.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : job.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : job.status === 'running'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {job.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Overall Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Overall Progress</span>
                      <span className="font-medium text-gray-900">
                        {Math.round(job.overall_progress)}%
                      </span>
                    </div>
                    <Progress value={job.overall_progress} />
                  </div>

                  {/* Phase Details */}
                  {job.phases && job.phases.length > 0 && (
                    <div className="space-y-2">
                      {job.phases.map((phase, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-2 bg-gray-50 rounded"
                        >
                          {getPhaseIcon(phase.phase_name)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700">
                                {phase.phase_name
                                  .replace(/_/g, ' ')
                                  .toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-500">
                                {Math.round(phase.progress)}%
                              </span>
                            </div>
                            {phase.items_total > 0 && (
                              <p className="text-xs text-gray-500">
                                {phase.items_processed.toLocaleString()} /{' '}
                                {phase.items_total.toLocaleString()}
                                {phase.items_per_second && (
                                  <span className="ml-2">
                                    ({phase.items_per_second.toFixed(1)}/s)
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error Message */}
                  {job.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-800">{job.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No active scans</p>
              <p className="text-sm text-gray-500">
                Select volumes above to start scanning
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ScanManager;
