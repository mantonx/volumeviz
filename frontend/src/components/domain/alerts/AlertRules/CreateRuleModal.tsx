import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { X, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils';
import { useAlertRules } from '@/hooks/useAlerts';
import type { CreateAlertRuleParams } from '@/hooks/useAlerts';

export interface CreateRuleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Condition = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne';

interface FormState {
  name: string;
  description: string;
  is_enabled: boolean;
  query: string;
  condition: Condition;
  threshold: number;
  interval_seconds: number;
  for_seconds: string;
}

const initialFormState: FormState = {
  name: '',
  description: '',
  is_enabled: true,
  query: '',
  condition: 'gt',
  threshold: 0,
  interval_seconds: 60,
  for_seconds: '',
};

const conditionOptions: Array<{ value: Condition; label: string }> = [
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'gte', label: 'Greater Than or Equal (>=)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'lte', label: 'Less Than or Equal (<=)' },
  { value: 'eq', label: 'Equal To (=)' },
  { value: 'ne', label: 'Not Equal To (!=)' },
];

export const CreateRuleModal: React.FC<CreateRuleModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { createRule, isCreating, createError } = useAlertRules();
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formState.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formState.query.trim()) {
      errors.query = 'Query is required';
    }

    if (formState.interval_seconds <= 0) {
      errors.interval_seconds = 'Interval must be positive';
    }

    if (formState.for_seconds !== '' && Number(formState.for_seconds) < 0) {
      errors.for_seconds = 'Must be non-negative';
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
      const params: CreateAlertRuleParams = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        query: formState.query.trim(),
        condition: formState.condition,
        threshold: formState.threshold,
        interval: formState.interval_seconds * 1_000_000_000,
        for:
          formState.for_seconds !== ''
            ? Number(formState.for_seconds) * 1_000_000_000
            : undefined,
        is_enabled: formState.is_enabled,
      };

      await createRule(params);
      setFormState(initialFormState);
      setValidationErrors({});
      onSuccess();
    } catch {
      // Error is surfaced via createError below
    }
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
              Create Alert Rule
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Query *
                  </label>
                  <input
                    type="text"
                    value={formState.query}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        query: e.target.value,
                      }))
                    }
                    className={cn(
                      'w-full px-3 py-2 border rounded-md bg-surface font-mono text-sm',
                      validationErrors.query
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-line',
                    )}
                    placeholder="volume_size_bytes"
                  />
                  {validationErrors.query && (
                    <p className="text-red-600 text-sm mt-1">
                      {validationErrors.query}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Condition *
                    </label>
                    <select
                      value={formState.condition}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          condition: e.target.value as Condition,
                        }))
                      }
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                    >
                      {conditionOptions.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Threshold *
                    </label>
                    <input
                      type="number"
                      value={formState.threshold}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          threshold: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Evaluation Interval (seconds) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formState.interval_seconds}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          interval_seconds: parseInt(e.target.value) || 0,
                        }))
                      }
                      className={cn(
                        'w-full px-3 py-2 border rounded-md bg-surface',
                        validationErrors.interval_seconds
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-line',
                      )}
                      placeholder="60"
                    />
                    {validationErrors.interval_seconds && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors.interval_seconds}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      For (seconds, optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formState.for_seconds}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          for_seconds: e.target.value,
                        }))
                      }
                      className={cn(
                        'w-full px-3 py-2 border rounded-md bg-surface',
                        validationErrors.for_seconds
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-line',
                      )}
                      placeholder="How long the condition must persist"
                    />
                    {validationErrors.for_seconds && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors.for_seconds}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Error display */}
            {createError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div className="flex items-center gap-2 text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {createError}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-line">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="flex items-center gap-2"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create Rule
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
