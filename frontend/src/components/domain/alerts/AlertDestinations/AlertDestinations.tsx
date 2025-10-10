import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Plus,
  Send,
  Settings,
  Trash2,
  TestTube,
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAlertDestinations } from '@/hooks/useAlerts';
import type { AlertDestination } from '@/api/alerts';
import { CreateDestinationModal } from './CreateDestinationModal';
import { EditDestinationModal } from './EditDestinationModal';
import { TestDestinationModal } from './TestDestinationModal';

export interface AlertDestinationsProps {
  className?: string;
}

export const AlertDestinations: React.FC<AlertDestinationsProps> = ({
  className,
}) => {
  const {
    destinations,
    loading,
    error,
    operationLoading,
    operationError,
    fetchDestinations,
    deleteDestination,
  } = useAlertDestinations();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDestination, setEditingDestination] =
    useState<AlertDestination | null>(null);
  const [testingDestination, setTestingDestination] =
    useState<AlertDestination | null>(null);

  useEffect(() => {
    fetchDestinations();
  }, [fetchDestinations]);

  const handleDelete = async (destination: AlertDestination) => {
    if (
      window.confirm(`Are you sure you want to delete "${destination.name}"?`)
    ) {
      try {
        await deleteDestination(destination.id);
      } catch (error) {
        // Error is handled by the hook
      }
    }
  };

  const getDestinationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'slack':
        return '💬';
      case 'pushover':
        return '📱';
      case 'webhook':
      default:
        return '🔗';
    }
  };

  const getDestinationStatusColor = (isEnabled: boolean) => {
    return isEnabled
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-surface-secondary text-secondary';
  };

  if (loading && destinations.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="flex items-center gap-2 text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading destinations...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load destinations"
        message={error}
        onRetry={() => fetchDestinations()}
        className={className}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-primary">
            Alert Destinations
          </h3>
          <p className="text-sm text-tertiary">
            Configure where alerts should be sent
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Destination
        </Button>
      </div>

      {destinations.length === 0 ? (
        <EmptyState
          title="No destinations configured"
          message="Create your first alert destination to start receiving notifications"
          icon={Send}
          action={{
            label: 'Add Destination',
            onClick: () => setShowCreateModal(true),
          }}
        />
      ) : (
        <div className="grid gap-4">
          {destinations.map((destination) => (
            <Card key={destination.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {getDestinationIcon(destination.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-primary">
                        {destination.name}
                      </h4>
                      <Badge
                        variant="secondary"
                        className={getDestinationStatusColor(
                          destination.is_enabled,
                        )}
                      >
                        {destination.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-sm text-tertiary">
                      {destination.description ||
                        `${destination.type} notification`}
                    </p>
                    <div className="text-xs text-tertiary mt-1">
                      Type: {destination.type} • Created:{' '}
                      {new Date(destination.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTestingDestination(destination)}
                    disabled={
                      operationLoading[`testDestination_${destination.id}`]
                    }
                    className="flex items-center gap-1"
                  >
                    {operationLoading[`testDestination_${destination.id}`] ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <TestTube className="h-3 w-3" />
                    )}
                    Test
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingDestination(destination)}
                    className="flex items-center gap-1"
                  >
                    <Settings className="h-3 w-3" />
                    Edit
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(destination)}
                    disabled={
                      operationLoading[`deleteDestination_${destination.id}`]
                    }
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {operationLoading[`deleteDestination_${destination.id}`] ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>

              {operationError[`testDestination_${destination.id}`] && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Test failed:{' '}
                    {operationError[`testDestination_${destination.id}`]}
                  </div>
                </div>
              )}

              {operationError[`deleteDestination_${destination.id}`] && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Delete failed:{' '}
                    {operationError[`deleteDestination_${destination.id}`]}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateDestinationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchDestinations();
        }}
      />

      {editingDestination && (
        <EditDestinationModal
          destination={editingDestination}
          open={!!editingDestination}
          onClose={() => setEditingDestination(null)}
          onSuccess={() => {
            setEditingDestination(null);
            fetchDestinations();
          }}
        />
      )}

      {testingDestination && (
        <TestDestinationModal
          destination={testingDestination}
          open={!!testingDestination}
          onClose={() => setTestingDestination(null)}
        />
      )}
    </div>
  );
};
