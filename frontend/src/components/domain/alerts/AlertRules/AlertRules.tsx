import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Plus,
  Settings,
  Trash2,
  TestTube,
  AlertTriangle,
  Loader2,
  Activity,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAlertRules } from '@/hooks/useAlerts';
import type { AlertRule } from '@/hooks/useAlerts';
import { CreateRuleModal } from './CreateRuleModal';
import { EditRuleModal } from './EditRuleModal';
import { TestRuleModal } from './TestRuleModal';

export interface AlertRulesProps {
  className?: string;
}

export const AlertRules: React.FC<AlertRulesProps> = ({ className }) => {
  const {
    rules,
    isLoading,
    error,
    refetch,
    deleteRule,
    isDeleting,
    deleteError,
  } = useAlertRules();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [testingRule, setTestingRule] = useState<AlertRule | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (rule: AlertRule) => {
    if (
      !rule.id ||
      !window.confirm(`Are you sure you want to delete the rule "${rule.name}"?`)
    ) {
      return;
    }

    try {
      setDeletingId(rule.id);
      await deleteRule(rule.id);
    } catch {
      // Error is surfaced via deleteError below
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusColor = (isEnabled?: boolean) => {
    return isEnabled
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-surface-secondary text-secondary';
  };

  const formatInterval = (nanos?: number): string => {
    if (!nanos) return 'Unknown';
    const seconds = nanos / 1_000_000_000;
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  if (isLoading && rules.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="flex items-center gap-2 text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading alert rules...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load alert rules"
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
          <h3 className="text-lg font-medium text-primary">Alert Rules</h3>
          <p className="text-sm text-tertiary">
            Configure rules for when alerts should be triggered
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title="No alert rules configured"
          description="Create your first alert rule to start monitoring your volumes"
          icon={Activity}
          actionLabel="Add Rule"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Activity className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-primary truncate">
                          {rule.name}
                        </h4>
                        <Badge
                          variant="secondary"
                          className={getStatusColor(rule.is_enabled)}
                        >
                          {rule.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-tertiary truncate">
                        {rule.description || 'No description'}
                      </p>
                      <div className="text-xs text-tertiary mt-1 space-y-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="font-mono">
                            {rule.query} {rule.condition} {rule.threshold}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <span>Every {formatInterval(rule.interval)}</span>
                          {rule.for != null && (
                            <span>For {formatInterval(rule.for)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTestingRule(rule)}
                    className="flex items-center gap-1"
                  >
                    <TestTube className="h-3 w-3" />
                    Test
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRule(rule)}
                    className="flex items-center gap-1"
                  >
                    <Settings className="h-3 w-3" />
                    Edit
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(rule)}
                    disabled={isDeleting && deletingId === rule.id}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {isDeleting && deletingId === rule.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>

              {deleteError && deletingId === rule.id && (
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
      <CreateRuleModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          refetch();
        }}
      />

      {editingRule && (
        <EditRuleModal
          rule={editingRule}
          open={!!editingRule}
          onClose={() => setEditingRule(null)}
          onSuccess={() => {
            setEditingRule(null);
            refetch();
          }}
        />
      )}

      {testingRule && (
        <TestRuleModal
          rule={testingRule}
          open={!!testingRule}
          onClose={() => setTestingRule(null)}
        />
      )}
    </div>
  );
};
