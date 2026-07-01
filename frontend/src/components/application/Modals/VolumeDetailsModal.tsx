/**
 * Volume Details Modal Component
 * Displays comprehensive information about a specific volume
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  HardDrive,
  Database,
  Calendar,
  Tag,
  MapPin,
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SizeVisualization } from '@/components/ui/SizeVisualization';
import { formatBytes } from '@/utils';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { ContainerStatus } from '@/components/ui/ContainerStatus';
import { cn } from '@/utils';
import { useToast } from '@/components/ui';
import { customFetchClient } from '@/api/fetch-client';
interface VolumeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  volumeName: string;
}

// Volume details interface based on backend model
interface VolumeDetailV1 {
  id: string;
  name: string;
  driver: string;
  volume_type?: string; // "local", "bind", or "network"
  scope: string;
  mountpoint: string;
  created_at: string;
  size_bytes?: number;
  is_orphaned?: boolean;
  is_system?: boolean;
  labels?: Record<string, string>;
  last_scan_at?: string;
  attachments?: AttachmentV1[];
  filesystem_capacity?: {
    total_bytes: number;
    available_bytes: number;
    usage_percent: number;
  };
}

interface AttachmentV1 {
  container_id: string;
  container_name: string;
  mount_path: string;
  rw: boolean;
}

export const VolumeDetailsModal: React.FC<VolumeDetailsModalProps> = ({
  isOpen,
  onClose,
  volumeName,
}) => {
  const [volume, setVolume] = useState<VolumeDetailV1 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: showError } = useToast();

  // Fetch volume details
  const fetchVolumeDetails = async () => {
    if (!volumeName) return;

    setLoading(true);
    setError(null);

    try {
      const volumeData = await customFetchClient<VolumeDetailV1>(
        `/volumes/${encodeURIComponent(volumeName)}`,
        {
          method: 'GET',
        },
      );
      setVolume(volumeData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch volume details';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load volume details when modal opens
  useEffect(() => {
    if (isOpen && volumeName) {
      fetchVolumeDetails();
    }
  }, [isOpen, volumeName]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Copy to clipboard function
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      success(`${label} copied to clipboard`);
    } catch (err) {
      showError('Failed to copy to clipboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background overlay with transparency */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal panel - scrollable container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-surface shadow-2xl transition-all">
        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-line">
            <div className="flex items-center space-x-3">
              <HardDrive className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-primary">
                  Volume Details
                </h2>
                <p className="text-sm text-tertiary">
                  {volumeName}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-400 hover:text-primary"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-secondary">
                  Loading volume details...
                </span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-primary mb-2">
                    Failed to Load Details
                  </h3>
                  <p className="text-secondary mb-4">
                    {error}
                  </p>
                  <Button onClick={fetchVolumeDetails}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            ) : volume ? (
              <div className="space-y-6">
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Size Information */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-secondary">
                          Storage
                        </span>
                      </div>
                      {volume.size_bytes && (
                        <Badge variant="secondary" className="text-xs">
                          {formatBytes(volume.size_bytes)}
                        </Badge>
                      )}
                    </div>
                    {volume.size_bytes ? (
                      <div className="space-y-2">
                        <SizeVisualization
                          sizeBytes={volume.size_bytes}
                          className="text-lg font-semibold"
                        />
                        {volume.filesystem_capacity && (
                          <div className="text-xs text-tertiary">
                            {(
                              (volume.size_bytes /
                                volume.filesystem_capacity.total_bytes) *
                              100
                            ).toFixed(1)}
                            % of capacity
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-tertiary">
                        Size not available
                      </div>
                    )}
                  </Card>

                  {/* Status Information */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Activity className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-secondary">
                          Status
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        {volume.is_orphaned ? (
                          <>
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <span className="text-sm text-orange-600">
                              Orphaned
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">
                              Active
                            </span>
                          </>
                        )}
                      </div>
                      {volume.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          System Volume
                        </Badge>
                      )}
                      <div className="text-xs text-tertiary">
                        {volume.attachments?.length || 0} container(s) attached
                      </div>
                    </div>
                  </Card>

                  {/* Scan Information */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-secondary">
                          Last Scan
                        </span>
                      </div>
                    </div>
                    <FreshnessIndicator
                      lastSeen={volume.last_scan_at}
                      showIcon={true}
                      showLabel={true}
                      compact={false}
                    />
                  </Card>
                </div>

                {/* Basic Information */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-primary mb-4">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-secondary">
                        Name
                      </label>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="px-2 py-1 bg-surface-secondary rounded text-sm text-primary">
                          {volume.name}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(volume.name, 'Volume name')
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-secondary">
                        Driver
                      </label>
                      <div className="mt-1">
                        <Badge variant="outline">{volume.driver}</Badge>
                      </div>
                    </div>
                    {volume.volume_type && (
                      <div>
                        <label className="text-sm font-medium text-secondary">
                          Type
                        </label>
                        <div className="mt-1">
                          <Badge
                            variant={
                              volume.volume_type === 'network'
                                ? 'default'
                                : 'secondary'
                            }
                            className={cn(
                              volume.volume_type === 'network' &&
                                'bg-blue-600 text-white',
                            )}
                          >
                            {volume.volume_type === 'network'
                              ? 'Network Mount'
                              : volume.volume_type === 'bind'
                                ? 'Bind Mount'
                                : 'Local Volume'}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-secondary">
                        Scope
                      </label>
                      <div className="mt-1">
                        <Badge variant="secondary">{volume.scope}</Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-secondary">
                        Created
                      </label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-secondary">
                          {new Date(volume.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Mount Information */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-primary mb-4">
                    Mount Information
                  </h3>
                  <div>
                    <label className="text-sm font-medium text-secondary">
                      Mountpoint
                    </label>
                    <div className="flex items-center space-x-2 mt-1">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <code className="px-2 py-1 bg-surface-secondary rounded text-sm flex-1 text-primary">
                        {volume.mountpoint}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(volume.mountpoint, 'Mountpoint')
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Container Attachments */}
                {volume.attachments && volume.attachments.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-primary mb-4">
                      Container Attachments ({volume.attachments.length})
                    </h3>
                    <div className="space-y-3">
                      {volume.attachments.map(
                        (attachment: AttachmentV1, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <Database className="h-4 w-4 text-blue-600" />
                              <div>
                                <div className="font-medium text-primary">
                                  {attachment.container_name}
                                </div>
                                <div className="text-sm text-tertiary">
                                  {attachment.container_id}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {attachment.mount_path}
                              </Badge>
                              <ContainerStatus
                                containers={[attachment.container_name]}
                                compact
                              />
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </Card>
                )}

                {/* Labels */}
                {volume.labels && Object.keys(volume.labels).length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-primary mb-4">
                      Labels
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(volume.labels).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <Tag className="h-4 w-4 text-gray-400" />
                            <code className="text-sm text-primary">
                              {key}
                            </code>
                          </div>
                          <code className="px-2 py-1 bg-surface-secondary rounded text-sm text-primary">
                            {value}
                          </code>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Filesystem Capacity */}
                {volume.filesystem_capacity && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-primary mb-4">
                      Filesystem Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-secondary">
                          Total Capacity
                        </label>
                        <div className="mt-1 text-lg font-semibold text-primary">
                          {formatBytes(volume.filesystem_capacity.total_bytes)}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-secondary">
                          Available
                        </label>
                        <div className="mt-1 text-lg font-semibold text-green-600">
                          {formatBytes(
                            volume.filesystem_capacity.available_bytes,
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-secondary">
                          Usage
                        </label>
                        <div className="mt-1">
                          <div className="text-lg font-semibold text-primary">
                            {volume.filesystem_capacity.usage_percent.toFixed(
                              1,
                            )}
                            %
                          </div>
                          <div className="w-full bg-surface-secondary rounded-full h-2 mt-1">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${volume.filesystem_capacity.usage_percent}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-secondary">
                  No volume details available
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-line bg-surface-secondary">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {volume && (
              <Button
                onClick={() => window.open(`/volumes/${volume.name}`, '_blank')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VolumeDetailsModal;
