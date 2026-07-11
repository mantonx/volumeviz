/**
 * CreateRuleModal - Real tracking-rule creation form
 *
 * Builds a rule from the real field/operator schema (GET /api/v1/rules/schema),
 * validates it server-side (POST /api/v1/rules/validate) before allowing
 * submission, and creates it for real (POST /api/v1/rules).
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  useGetApiV1RulesSchema,
  usePostApiV1RulesValidate,
  usePostApiV1Rules,
  InternalApiV1RulesCreateRuleRequestAction,
  type InternalApiV1RulesConditionRequest,
} from '@/api/orval-generated/api';

interface CreateRuleModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface ConditionDraft {
  field_name: string;
  operator: string;
  value: string;
}

const MULTI_VALUE_OPERATORS = new Set(['in', 'not_in']);

const emptyCondition = (defaultField: string, defaultOperator: string): ConditionDraft => ({
  field_name: defaultField,
  operator: defaultOperator,
  value: '',
});

export const CreateRuleModal: React.FC<CreateRuleModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const { data: schemaData, isLoading: schemaLoading } = useGetApiV1RulesSchema();
  const schema = schemaData?.status === 200 ? schemaData.data : undefined;
  const fields = schema?.fields ?? [];
  const operators = schema?.operators ?? [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState<'include' | 'exclude'>('include');
  const [priority, setPriority] = useState(100);
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateRule = usePostApiV1RulesValidate();
  const createRule = usePostApiV1Rules();

  useEffect(() => {
    if (open && fields.length > 0 && conditions.length === 0) {
      const firstField = fields[0];
      setConditions([
        emptyCondition(firstField.name ?? '', firstField.operators?.[0] ?? 'equals'),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fields.length]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setAction('include');
    setPriority(100);
    setConditions([]);
    setValidationErrors([]);
    setSubmitError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const operatorsForField = (fieldName: string) =>
    fields.find((f) => f.name === fieldName)?.operators ?? [];

  const updateCondition = (index: number, patch: Partial<ConditionDraft>) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  };

  const addCondition = () => {
    const firstField = fields[0];
    setConditions((prev) => [
      ...prev,
      emptyCondition(firstField?.name ?? '', firstField?.operators?.[0] ?? 'equals'),
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const buildConditionRequests = (): InternalApiV1RulesConditionRequest[] =>
    conditions.map((c) => {
      const isMulti = MULTI_VALUE_OPERATORS.has(c.operator);
      return {
        field_name: c.field_name as InternalApiV1RulesConditionRequest['field_name'],
        operator: c.operator as InternalApiV1RulesConditionRequest['operator'],
        ...(isMulti
          ? { values: c.value.split(',').map((v) => v.trim()).filter(Boolean) }
          : { value: c.value }),
      };
    });

  const handleSubmit = async () => {
    setValidationErrors([]);
    setSubmitError(null);

    const conditionRequests = buildConditionRequests();

    try {
      const validation = await validateRule.mutateAsync({
        data: { name, action, priority, conditions: conditionRequests },
      });
      const result = validation.status === 200 ? validation.data : undefined;

      if (!result?.is_valid) {
        setValidationErrors(
          (result?.errors ?? []).map((e) => e.message ?? 'Invalid rule').filter(Boolean) as string[],
        );
        return;
      }

      await createRule.mutateAsync({
        data: {
          name,
          description: description || undefined,
          action: action as InternalApiV1RulesCreateRuleRequestAction,
          priority,
          is_enabled: true,
          conditions: conditionRequests,
        },
      });

      resetForm();
      onCreated();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create rule');
    }
  };

  const isSubmitting = validateRule.isPending || createRule.isPending;
  const canSubmit =
    name.trim().length > 0 &&
    conditions.length > 0 &&
    conditions.every((c) => c.field_name && c.operator && c.value.trim().length > 0);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      header={{ title: 'Create New Rule' }}
      size="lg"
      closable={!isSubmitting}
      closeOnEscape={!isSubmitting}
      closeOnOutsideClick={!isSubmitting}
      footer={{
        align: 'right',
        secondaryAction: (
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
        ),
        primaryAction: (
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Rule'}
          </Button>
        ),
      }}
    >
      <div className="space-y-4">
        {submitError && (
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{submitError}</p>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <ul className="text-sm text-red-700 dark:text-red-400 list-disc pl-4">
              {validationErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-secondary mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Include Docker Volumes"
            className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as 'include' | 'exclude')}
              className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-primary"
            >
              <option value={InternalApiV1RulesCreateRuleRequestAction.include}>Include</option>
              <option value={InternalApiV1RulesCreateRuleRequestAction.exclude}>Exclude</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Priority</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-primary"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-secondary">Conditions</label>
            <Button variant="ghost" size="sm" onClick={addCondition} disabled={schemaLoading}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Condition
            </Button>
          </div>

          {schemaLoading && (
            <p className="text-sm text-tertiary">Loading available fields...</p>
          )}

          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={condition.field_name}
                  onChange={(e) => {
                    const newField = e.target.value;
                    const newOps = operatorsForField(newField);
                    updateCondition(index, {
                      field_name: newField,
                      operator: newOps[0] ?? '',
                    });
                  }}
                  className="flex-1 px-2 py-1.5 border border-line rounded text-sm bg-surface text-primary"
                >
                  {fields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.display_name ?? f.name}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, { operator: e.target.value })}
                  className="flex-1 px-2 py-1.5 border border-line rounded text-sm bg-surface text-primary"
                >
                  {operatorsForField(condition.field_name).map((op) => {
                    const def = operators.find((o) => o.name === op);
                    return (
                      <option key={op} value={op}>
                        {def?.display_name ?? op}
                      </option>
                    );
                  })}
                </select>

                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  placeholder={
                    MULTI_VALUE_OPERATORS.has(condition.operator)
                      ? 'value1, value2'
                      : 'value'
                  }
                  className="flex-1 px-2 py-1.5 border border-line rounded text-sm bg-surface text-primary"
                />

                <button
                  onClick={() => removeCondition(index)}
                  disabled={conditions.length <= 1}
                  className="p-1.5 text-tertiary hover:text-red-600 disabled:opacity-30"
                  aria-label="Remove condition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CreateRuleModal;
