import React, { useState } from 'react';
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
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAlertDestinations } from '@/hooks/useAlerts';
import type { AlertDestination } from '@/hooks/useAlerts';
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
    isLoading,
    error,
    refetch,
    deleteDestination,
    isDeleting,
    deleteError,
  } = useAlertDestinations();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDestination, setEditingDestination] =
    useState<AlertDestination | null>(null);
  const [testingDestination, setTestingDestination] =
    useState<AlertDestination | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (destination: AlertDestination) => {
    if (
      !destination.id ||
      !window.confirm(`Are you sure you want to delete "${destination.name}"?`)
    ) {
      return;
    }

    try {
      setDeletingId(destination.id);
      await deleteDestination(destination.id);
    } catch {
      // Error is surfaced via deleteError below
    } finally {
      setDeletingId(null);
    }
  };

  const getDestinationIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'slack':
        return '💬';
      case 'pushover':
        return '📱';
      case 'webhook':
      default:
        return '🔗';
    }
  };

  const getDestinationStatusColor = (isEnabled?: boolean) => {
    return isEnabled
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-surface-secondary text-secondary';
  };

  if (isLoading && destinations.length === 0) {
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
        error={error}
        onRetry={() => refetch()}
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
          description="Create your first alert destination to start receiving notifications"
          icon={Send}
          actionLabel="Add Destination"
          onAction={() => setShowCreateModal(true)}
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
                      {`${destination.type} notification`}
                    </p>
                    <div className="text-xs text-tertiary mt-1">
                      Type: {destination.type} • Created:{' '}
                      {destination.created_at
                        ? new Date(destination.created_at).toLocaleDateString()
                        : 'Unknown'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTestingDestination(destination)}
                    className="flex items-center gap-1"
                  >
                    <TestTube className="h-3 w-3" />
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
                    disabled={isDeleting && deletingId === destination.id}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {isDeleting && deletingId === destination.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>

              {deleteError && deletingId === destination.id && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Delete failed: {deleteError}
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
          refetch();
        }}
      />

      {editingDestination && (
        <EditDestinationModal
          destination={editingDestination}
          open={!!editingDestination}
          onClose={() => setEditingDestination(null)}
          onSuccess={() => {
            setEditingDestination(null);
            refetch();
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
