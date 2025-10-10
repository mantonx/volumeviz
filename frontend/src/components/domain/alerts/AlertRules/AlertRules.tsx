import React, { useState, useEffect } from 'react';
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
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Activity,
  Target,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAlertRules } from '@/hooks/useAlerts';
import type { AlertRule } from '@/api/alerts';
import { CreateRuleModal } from './CreateRuleModal';
import { EditRuleModal } from './EditRuleModal';
import { TestRuleModal } from './TestRuleModal';

export interface AlertRulesProps {
  className?: string;
}

export const AlertRules: React.FC<AlertRulesProps> = ({ className }) => {
  const {
    rules,
    loading,
    error,
    operationLoading,
    operationError,
    fetchRules,
    deleteRule,
  } = useAlertRules();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [testingRule, setTestingRule] = useState<AlertRule | null>(null);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleDelete = async (rule: AlertRule) => {
    if (
      window.confirm(`Are you sure you want to delete the rule "${rule.name}"?`)
    ) {
      try {
        await deleteRule(rule.id);
      } catch (error) {
        // Error is handled by the hook
      }
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-surface-secondary text-secondary';
    }
  };

  const getStatusColor = (isEnabled: boolean) => {
    return isEnabled
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-surface-secondary text-secondary';
  };

  const formatCondition = (condition: any) => {
    if (!condition) return 'No condition';

    // Handle different condition formats
    if (
      condition.field &&
      condition.operator &&
      condition.value !== undefined
    ) {
      return `${condition.field} ${condition.operator} ${condition.value}`;
    }

    if (condition.query) {
      return condition.query;
    }

    return JSON.stringify(condition);
  };

  if (loading && rules.length === 0) {
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
        message={error}
        onRetry={() => fetchRules()}
        className={className}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-primary">
            Alert Rules & Routes
          </h3>
          <p className="text-sm text-tertiary">
            Configure rules for when alerts should be triggered and where they
            go
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
          message="Create your first alert rule to start monitoring your volumes"
          icon={Activity}
          action={{
            label: 'Add Rule',
            onClick: () => setShowCreateModal(true),
          }}
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
                        <Badge
                          variant="secondary"
                          className={getSeverityColor(rule.severity)}
                        >
                          {rule.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-tertiary truncate">
                        {rule.description || 'No description'}
                      </p>
                      <div className="text-xs text-tertiary mt-1">
                        <div className="flex items-center gap-4">
                          <span>
                            Condition: {formatCondition(rule.condition)}
                          </span>
                          <span>Cooldown: {rule.cooldown_seconds}s</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Target className="h-3 w-3" />
                          Routes to: {rule.routes?.length || 0} destination(s)
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
                    disabled={operationLoading[`testRule_${rule.id}`]}
                    className="flex items-center gap-1"
                  >
                    {operationLoading[`testRule_${rule.id}`] ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <TestTube className="h-3 w-3" />
                    )}
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
                    disabled={operationLoading[`deleteRule_${rule.id}`]}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {operationLoading[`deleteRule_${rule.id}`] ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>

              {operationError[`testRule_${rule.id}`] && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Test failed: {operationError[`testRule_${rule.id}`]}
                  </div>
                </div>
              )}

              {operationError[`deleteRule_${rule.id}`] && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Delete failed: {operationError[`deleteRule_${rule.id}`]}
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
          fetchRules();
        }}
      />

      {editingRule && (
        <EditRuleModal
          rule={editingRule}
          open={!!editingRule}
          onClose={() => setEditingRule(null)}
          onSuccess={() => {
            setEditingRule(null);
            fetchRules();
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
