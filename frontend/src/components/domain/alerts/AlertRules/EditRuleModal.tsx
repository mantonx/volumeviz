import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  X,
  Save,
  Loader2,
  AlertTriangle,
  Target,
  Trash2,
  Plus,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAlertRules, useAlertDestinations } from '@/hooks/useAlerts';
import type {
  AlertRule,
  UpdateAlertRuleParams,
  AlertDestination,
} from '@/api/alerts';

export interface EditRuleModalProps {
  rule: AlertRule;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Severity = 'low' | 'medium' | 'high' | 'critical';
type ConditionOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne' | 'contains';

interface RouteConfig {
  destination_id: number;
  destination_name?: string;
  template?: {
    subject?: string;
    message?: string;
  };
}

interface FormState {
  name: string;
  description: string;
  is_enabled: boolean;
  severity: Severity;
  condition: {
    field: string;
    operator: ConditionOperator;
    value: string | number;
  };
  cooldown_seconds: number;
  routes: RouteConfig[];
}

const conditionFields = [
  { value: 'volume_size', label: 'Volume Size (bytes)' },
  { value: 'file_count', label: 'File Count' },
  { value: 'directory_count', label: 'Directory Count' },
  { value: 'growth_rate', label: 'Growth Rate (bytes/day)' },
  { value: 'free_space', label: 'Free Space (bytes)' },
  { value: 'used_percentage', label: 'Used Percentage' },
];

const conditionOperators = [
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'gte', label: 'Greater Than or Equal (>=)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'lte', label: 'Less Than or Equal (<=)' },
  { value: 'eq', label: 'Equal To (=)' },
  { value: 'ne', label: 'Not Equal To (!=)' },
  { value: 'contains', label: 'Contains' },
];

export const EditRuleModal: React.FC<EditRuleModalProps> = ({
  rule,
  open,
  onClose,
  onSuccess,
}) => {
  const { updateRule, operationLoading, operationError } = useAlertRules();
  const { destinations, fetchDestinations } = useAlertDestinations();
  const [formState, setFormState] = useState<FormState>({
    name: '',
    description: '',
    is_enabled: true,
    severity: 'medium',
    condition: {
      field: 'volume_size',
      operator: 'gt',
      value: 0,
    },
    cooldown_seconds: 300,
    routes: [],
  });
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const isLoading = operationLoading[`updateRule_${rule.id}`];
  const error = operationError[`updateRule_${rule.id}`];

  // Initialize form with rule data
  useEffect(() => {
    if (rule && open) {
      setFormState({
        name: rule.name,
        description: rule.description || '',
        is_enabled: rule.is_enabled,
        severity: rule.severity as Severity,
        condition: {
          field: rule.condition?.field || 'volume_size',
          operator: rule.condition?.operator || 'gt',
          value: rule.condition?.value || 0,
        },
        cooldown_seconds: rule.cooldown_seconds,
        routes:
          rule.routes?.map((route) => ({
            destination_id: route.destination_id,
            template: route.template,
          })) || [],
      });
      setValidationErrors({});
      fetchDestinations();
    }
  }, [rule, open, fetchDestinations]);

  // Update route destination names when destinations are loaded
  useEffect(() => {
    if (destinations.length > 0 && formState.routes.length > 0) {
      setFormState((prev) => ({
        ...prev,
        routes: prev.routes.map((route) => {
          const destination = destinations.find(
            (d) => d.id === route.destination_id,
          );
          return {
            ...route,
            destination_name: destination?.name,
          };
        }),
      }));
    }
  }, [destinations, formState.routes.length]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formState.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formState.condition.field) {
      errors.condition_field = 'Condition field is required';
    }

    if (!formState.condition.operator) {
      errors.condition_operator = 'Condition operator is required';
    }

    if (formState.condition.value === '' || formState.condition.value == null) {
      errors.condition_value = 'Condition value is required';
    }

    if (formState.cooldown_seconds < 0) {
      errors.cooldown_seconds = 'Cooldown must be non-negative';
    }

    if (formState.routes.length === 0) {
      errors.routes = 'At least one route is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const params: UpdateAlertRuleParams = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        condition: formState.condition,
        severity: formState.severity,
        cooldown_seconds: formState.cooldown_seconds,
        is_enabled: formState.is_enabled,
        routes: formState.routes.map((route) => ({
          destination_id: route.destination_id,
          template: route.template,
        })),
      };

      await updateRule(rule.id, params);
      onSuccess();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const addRoute = () => {
    if (destinations.length === 0) return;

    const availableDestinations = destinations.filter(
      (dest) =>
        !formState.routes.some((route) => route.destination_id === dest.id),
    );

    if (availableDestinations.length === 0) return;

    const firstAvailable = availableDestinations[0];
    setFormState((prev) => ({
      ...prev,
      routes: [
        ...prev.routes,
        {
          destination_id: firstAvailable.id,
          destination_name: firstAvailable.name,
          template: {
            subject: '',
            message: '',
          },
        },
      ],
    }));
  };

  const updateRoute = (index: number, updates: Partial<RouteConfig>) => {
    setFormState((prev) => ({
      ...prev,
      routes: prev.routes.map((route, i) => {
        if (i === index) {
          const updated = { ...route, ...updates };
          if (updates.destination_id) {
            const destination = destinations.find(
              (d) => d.id === updates.destination_id,
            );
            updated.destination_name = destination?.name;
          }
          return updated;
        }
        return route;
      }),
    }));
  };

  const removeRoute = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      routes: prev.routes.filter((_, i) => i !== index),
    }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          onClick={onClose}
        />

        <Card className="relative w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-primary">
              Edit Alert Rule
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className={cn(
                    'w-full px-3 py-2 border rounded-md bg-surface',
                    validationErrors.name
                      ? 'border-red-300 dark:border-red-600'
                      : 'border-line',
                  )}
                  placeholder="High Volume Usage Alert"
                />
                {validationErrors.name && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formState.description}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                  placeholder="Optional description of this rule"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Severity *
                  </label>
                  <select
                    value={formState.severity}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        severity: e.target.value as Severity,
                      }))
                    }
                    className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Cooldown (seconds) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formState.cooldown_seconds}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        cooldown_seconds: parseInt(e.target.value) || 0,
                      }))
                    }
                    className={cn(
                      'w-full px-3 py-2 border rounded-md bg-surface',
                      validationErrors.cooldown_seconds
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-line',
                    )}
                    placeholder="300"
                  />
                  {validationErrors.cooldown_seconds && (
                    <p className="text-red-600 text-sm mt-1">
                      {validationErrors.cooldown_seconds}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_enabled"
                  checked={formState.is_enabled}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      is_enabled: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label
                  htmlFor="is_enabled"
                  className="ml-2 text-sm text-secondary"
                >
                  Enable this rule
                </label>
              </div>
            </div>

            {/* Condition */}
            <div>
              <h3 className="text-lg font-medium text-primary mb-4">
                Alert Condition
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Field *
                  </label>
                  <select
                    value={formState.condition.field}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        condition: { ...prev.condition, field: e.target.value },
                      }))
                    }
                    className={cn(
                      'w-full px-3 py-2 border rounded-md bg-surface',
                      validationErrors.condition_field
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-line',
                    )}
                  >
                    {conditionFields.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  {validationErrors.condition_field && (
                    <p className="text-red-600 text-sm mt-1">
                      {validationErrors.condition_field}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Operator *
                  </label>
                  <select
                    value={formState.condition.operator}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        condition: {
                          ...prev.condition,
                          operator: e.target.value as ConditionOperator,
                        },
                      }))
                    }
                    className={cn(
                      'w-full px-3 py-2 border rounded-md bg-surface',
                      validationErrors.condition_operator
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-line',
                    )}
                  >
                    {conditionOperators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  {validationErrors.condition_operator && (
                    <p className="text-red-600 text-sm mt-1">
                      {validationErrors.condition_operator}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Value *
                  </label>
                  <input
                    type={
                      formState.condition.operator === 'contains'
                        ? 'text'
                        : 'number'
                    }
                    value={formState.condition.value}
                    onChange={(e) => {
                      const value =
                        formState.condition.operator === 'contains'
                          ? e.target.value
                          : parseFloat(e.target.value) || 0;
                      setFormState((prev) => ({
                        ...prev,
                        condition: { ...prev.condition, value },
                      }));
                    }}
                    className={cn(
                      'w-full px-3 py-2 border rounded-md bg-surface',
                      validationErrors.condition_value
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-line',
                    )}
                    placeholder={
                      formState.condition.operator === 'contains' ? 'text' : '0'
                    }
                  />
                  {validationErrors.condition_value && (
                    <p className="text-red-600 text-sm mt-1">
                      {validationErrors.condition_value}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Routes */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-primary">
                  Alert Routes
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRoute}
                  disabled={
                    destinations.length === 0 ||
                    formState.routes.length >= destinations.length
                  }
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Route
                </Button>
              </div>

              {validationErrors.routes && (
                <p className="text-red-600 text-sm mb-4">
                  {validationErrors.routes}
                </p>
              )}

              {destinations.length === 0 ? (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                    No destinations available. Create at least one alert
                    destination before editing rules.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formState.routes.map((route, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-primary">
                            Route {index + 1}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeRoute(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-secondary mb-1">
                            Destination *
                          </label>
                          <select
                            value={route.destination_id}
                            onChange={(e) =>
                              updateRoute(index, {
                                destination_id: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                          >
                            {destinations.map((dest) => (
                              <option key={dest.id} value={dest.id}>
                                {dest.name} ({dest.type})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-secondary mb-1">
                              Custom Subject
                            </label>
                            <input
                              type="text"
                              value={route.template?.subject || ''}
                              onChange={(e) =>
                                updateRoute(index, {
                                  template: {
                                    ...route.template,
                                    subject: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 border border-line rounded-md bg-surface text-sm"
                              placeholder="Optional custom subject"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-secondary mb-1">
                              Custom Message
                            </label>
                            <input
                              type="text"
                              value={route.template?.message || ''}
                              onChange={(e) =>
                                updateRoute(index, {
                                  template: {
                                    ...route.template,
                                    message: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 border border-line rounded-md bg-surface text-sm"
                              placeholder="Optional custom message"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div className="flex items-center gap-2 text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-line">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
