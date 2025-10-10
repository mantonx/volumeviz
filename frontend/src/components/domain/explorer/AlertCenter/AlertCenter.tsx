/**
 * AlertCenter Component
 *
 * Alert management interface for listing, filtering, and acknowledging alerts.
 * Provides real-time alert monitoring and management capabilities.
 */

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  FilterIcon,
  InfoIcon,
  SearchIcon,
  XCircleIcon,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: string;
  source: string;
  volumeId?: string;
  metadata?: Record<string, any>;
}

interface AlertCenterProps {
  className?: string;
}

// Mock alert data
const mockAlerts: Alert[] = [
  {
    id: '1',
    title: 'High Disk Usage',
    description: 'Volume /data has exceeded 85% capacity',
    severity: 'critical',
    status: 'active',
    timestamp: '2024-03-15T10:30:00Z',
    source: 'volume-monitor',
    volumeId: 'vol_123',
    metadata: { usage: 87.5, threshold: 85 },
  },
  {
    id: '2',
    title: 'Rapid File Growth',
    description: 'Folder /data/logs showing unusual growth rate',
    severity: 'warning',
    status: 'active',
    timestamp: '2024-03-15T09:15:00Z',
    source: 'growth-monitor',
    volumeId: 'vol_123',
    metadata: { growthRate: 15.2, threshold: 10 },
  },
  {
    id: '3',
    title: 'Scan Completed',
    description: 'Volume scan completed successfully',
    severity: 'info',
    status: 'acknowledged',
    timestamp: '2024-03-15T08:45:00Z',
    source: 'scan-service',
    volumeId: 'vol_456',
  },
  {
    id: '4',
    title: 'Low Disk Space',
    description: 'Volume /backup is running low on available space',
    severity: 'warning',
    status: 'acknowledged',
    timestamp: '2024-03-15T07:30:00Z',
    source: 'volume-monitor',
    volumeId: 'vol_789',
    metadata: { usage: 92.3, threshold: 90 },
  },
  {
    id: '5',
    title: 'Connection Lost',
    description: 'Lost connection to remote volume',
    severity: 'critical',
    status: 'resolved',
    timestamp: '2024-03-14T16:20:00Z',
    source: 'network-monitor',
    volumeId: 'vol_remote',
  },
];

const getSeverityIcon = (severity: Alert['severity']) => {
  switch (severity) {
    case 'critical':
      return <XCircleIcon className="w-4 h-4 text-red-500" />;
    case 'warning':
      return <AlertTriangleIcon className="w-4 h-4 text-yellow-500" />;
    case 'info':
      return <InfoIcon className="w-4 h-4 text-blue-500" />;
  }
};

const getSeverityBadge = (severity: Alert['severity']) => {
  const variants = {
    critical: 'error' as const,
    warning: 'warning' as const,
    info: 'secondary' as const,
  };
  return variants[severity];
};

const getStatusIcon = (status: Alert['status']) => {
  switch (status) {
    case 'active':
      return <BellIcon className="w-4 h-4 text-red-500" />;
    case 'acknowledged':
      return <ClockIcon className="w-4 h-4 text-yellow-500" />;
    case 'resolved':
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
  }
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
};

export const AlertCenter: React.FC<AlertCenterProps> = ({ className = '' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<
    Alert['severity'] | 'all'
  >('all');
  const [selectedStatus, setSelectedStatus] = useState<Alert['status'] | 'all'>(
    'all',
  );

  const filteredAlerts = useMemo(() => {
    return mockAlerts.filter((alert) => {
      const matchesSearch =
        searchQuery === '' ||
        alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.source.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSeverity =
        selectedSeverity === 'all' || alert.severity === selectedSeverity;
      const matchesStatus =
        selectedStatus === 'all' || alert.status === selectedStatus;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [searchQuery, selectedSeverity, selectedStatus]);

  const alertCounts = useMemo(() => {
    return {
      total: mockAlerts.length,
      active: mockAlerts.filter((a) => a.status === 'active').length,
      critical: mockAlerts.filter((a) => a.severity === 'critical').length,
      warning: mockAlerts.filter((a) => a.severity === 'warning').length,
    };
  }, []);

  const handleAcknowledge = useCallback((alertId: string) => {
    // TODO: Implement alert acknowledgment API call
    console.log('Acknowledging alert:', alertId);
  }, []);

  const handleResolve = useCallback((alertId: string) => {
    // TODO: Implement alert resolution API call
    console.log('Resolving alert:', alertId);
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">
                Total Alerts
              </p>
              <p className="text-2xl font-bold text-primary">
                {alertCounts.total}
              </p>
            </div>
            <BellIcon className="w-8 h-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">
                Active
              </p>
              <p className="text-2xl font-bold text-red-600">
                {alertCounts.active}
              </p>
            </div>
            <BellIcon className="w-8 h-8 text-red-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">
                Critical
              </p>
              <p className="text-2xl font-bold text-red-600">
                {alertCounts.critical}
              </p>
            </div>
            <XCircleIcon className="w-8 h-8 text-red-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">
                Warnings
              </p>
              <p className="text-2xl font-bold text-yellow-600">
                {alertCounts.warning}
              </p>
            </div>
            <AlertTriangleIcon className="w-8 h-8 text-yellow-400" />
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search alerts..."
                className="w-full pl-10 pr-4 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center space-x-2">
            <FilterIcon className="w-4 h-4 text-gray-400" />
            <select
              value={selectedSeverity}
              onChange={(e) =>
                setSelectedSeverity(e.target.value as Alert['severity'] | 'all')
              }
              className="px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as Alert['status'] | 'all')
              }
              className="px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Alert List */}
      <Card className="p-0">
        <div className="divide-y divide-line">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center">
              <BellIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No alerts found</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 hover:bg-surface-hover"
              >
                <div className="flex items-start space-x-3">
                  {/* Severity Icon */}
                  <div className="flex-shrink-0 pt-1">
                    {getSeverityIcon(alert.severity)}
                  </div>

                  {/* Alert Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-primary truncate">
                        {alert.title}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getSeverityBadge(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        {getStatusIcon(alert.status)}
                      </div>
                    </div>

                    <p className="text-sm text-secondary mb-2">
                      {alert.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatTimestamp(alert.timestamp)}</span>
                        <span>Source: {alert.source}</span>
                        {alert.volumeId && (
                          <span>Volume: {alert.volumeId}</span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {alert.status === 'active' && (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAcknowledge(alert.id)}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolve(alert.id)}
                          >
                            Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
