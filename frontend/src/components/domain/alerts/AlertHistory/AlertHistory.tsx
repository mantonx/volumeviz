import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Filter,
  Search,
  Send,
  Loader2,
  Calendar,
  Target,
  Activity,
  Plus,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAlertDeliveries } from '@/hooks/useAlerts';

export interface AlertHistoryProps {
  className?: string;
}

type DeliveryStatus = 'all' | 'delivered' | 'failed' | 'pending' | 'retrying';

const PAGE_SIZE = 50;

export const AlertHistory: React.FC<AlertHistoryProps> = ({ className }) => {
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [offset, setOffset] = useState(0);

  const { deliveries, pagination, isLoading, error, refetch } =
    useAlertDeliveries({
      limit: PAGE_SIZE,
      offset,
      status: statusFilter === 'all' ? undefined : statusFilter,
    });

  const handleStatusFilterChange = (status: DeliveryStatus) => {
    setStatusFilter(status);
    setOffset(0);
  };

  const filteredDeliveries = useMemo(() => {
    if (!searchTerm) return deliveries;
    const term = searchTerm.toLowerCase();
    return deliveries.filter(
      (delivery) =>
        delivery.alert?.rule?.name?.toLowerCase().includes(term) ||
        delivery.destination?.name?.toLowerCase().includes(term),
    );
  }, [deliveries, searchTerm]);

  const handleRefresh = () => {
    refetch();
  };

  const getStatusIcon = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return (
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        );
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'pending':
        return (
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        );
      case 'retrying':
        return (
          <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        );
      default:
        return <AlertTriangle className="h-4 w-4 text-secondary" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'retrying':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-surface-secondary text-secondary';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading && deliveries.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="flex items-center gap-2 text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading delivery history...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load delivery history"
        error={error}
        onRetry={handleRefresh}
        className={className}
      />
    );
  }

  const limit = pagination.limit ?? PAGE_SIZE;
  const total = pagination.total ?? 0;
  const currentOffset = pagination.offset ?? offset;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-primary">
            Alert Delivery History
          </h3>
          <p className="text-sm text-tertiary">
            Track the delivery status of all alert notifications
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
          variant="outline"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-tertiary" />
            <select
              value={statusFilter}
              onChange={(e) =>
                handleStatusFilterChange(e.target.value as DeliveryStatus)
              }
              className="px-3 py-2 border border-line rounded-md bg-surface text-sm"
            >
              <option value="all">All Status</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="retrying">Retrying</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="h-4 w-4 text-tertiary" />
            <input
              type="text"
              placeholder="Search by rule name or destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-line rounded-md bg-surface text-sm"
            />
          </div>

          {deliveries.length > 0 && (
            <div className="text-sm text-tertiary">
              {filteredDeliveries.length} of {total} deliveries
            </div>
          )}
        </div>
      </Card>

      {filteredDeliveries.length === 0 ? (
        <EmptyState
          title="No delivery history"
          description={
            searchTerm
              ? 'No deliveries match your search criteria'
              : 'No alert deliveries have been recorded yet'
          }
          icon={Send}
        />
      ) : (
        <div className="space-y-3">
          {filteredDeliveries.map((delivery) => (
            <Card key={delivery.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-surface-secondary rounded-lg flex-shrink-0">
                    {getStatusIcon(delivery.status)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-primary truncate">
                        {delivery.alert?.rule?.name || 'Unknown Rule'}
                      </h4>
                      <span className="text-tertiary">→</span>
                      <span className="text-sm text-secondary truncate">
                        {delivery.destination?.name || 'Unknown Destination'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-tertiary">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(
                          delivery.last_attempt_at || delivery.created_at,
                        )}
                      </div>

                      {(delivery.attempt_count ?? 0) > 1 && (
                        <div className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          {delivery.attempt_count} attempt
                          {(delivery.attempt_count ?? 0) > 1 ? 's' : ''}
                        </div>
                      )}

                      {delivery.destination?.type && (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {delivery.destination.type}
                        </div>
                      )}

                      {delivery.alert?.id && (
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Alert #{delivery.alert.id}
                        </div>
                      )}
                    </div>

                    {delivery.error_message && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
                        <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          Error: {delivery.error_message}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant="secondary"
                    className={getStatusColor(delivery.status)}
                  >
                    {delivery.status
                      ? delivery.status.charAt(0).toUpperCase() +
                        delivery.status.slice(1)
                      : 'Unknown'}
                  </Badge>

                  {delivery.delivered_at && (
                    <div className="text-xs text-green-600 dark:text-green-400">
                      ✓ {formatDate(delivery.delivered_at)}
                    </div>
                  )}

                  {delivery.next_attempt_at &&
                    delivery.status === 'pending' && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400">
                        ⏱ Next: {formatDate(delivery.next_attempt_at)}
                      </div>
                    )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Load More */}
      {filteredDeliveries.length > 0 && currentOffset + limit < total && (
        <div className="text-center pt-4">
          <Button
            onClick={() => setOffset(currentOffset + limit)}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
};
