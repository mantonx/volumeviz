import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  X,
  TestTube,
  Loader2,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { useAlertRules } from '@/hooks/useAlerts';
import type { AlertRule, TestAlertRuleResult } from '@/hooks/useAlerts';

export interface TestRuleModalProps {
  rule: AlertRule;
  open: boolean;
  onClose: () => void;
}

const formatInterval = (nanos?: number): string => {
  if (!nanos) return 'Unknown';
  const seconds = nanos / 1_000_000_000;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
};

export const TestRuleModal: React.FC<TestRuleModalProps> = ({
  rule,
  open,
  onClose,
}) => {
  const { testRule, isTesting, testError } = useAlertRules();
  const [testResult, setTestResult] = useState<TestAlertRuleResult>(null);
  const [hasRun, setHasRun] = useState(false);

  const handleTest = async () => {
    if (!rule.id) return;
    try {
      setTestResult(null);
      const result = await testRule(rule.id);
      setTestResult(result);
      setHasRun(true);
    } catch {
      // Error is surfaced via testError below
      setHasRun(true);
    }
  };

  const handleClose = () => {
    setTestResult(null);
    setHasRun(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          onClick={handleClose}
        />

        <Card className="relative w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-primary">
              Test Alert Rule
            </h2>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Rule Info */}
          <div className="mb-6 p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-blue-500" />
              <h3 className="font-medium text-primary">{rule.name}</h3>
              <Badge
                variant="secondary"
                className={
                  rule.is_enabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-surface-secondary text-secondary'
                }
              >
                {rule.is_enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <p className="text-sm text-secondary mb-2">
              {rule.description || 'No description'}
            </p>
            <div className="text-xs text-tertiary space-y-1">
              <div className="font-mono">
                {rule.query} {rule.condition} {rule.threshold}
              </div>
              <div>Every {formatInterval(rule.interval)}</div>
              {rule.for != null && <div>For {formatInterval(rule.for)}</div>}
            </div>
          </div>

          {/* Test Action */}
          {!hasRun && (
            <div className="mb-6 text-center">
              <p className="text-secondary mb-4">
                Click the button below to test this alert rule against your
                current data.
              </p>
              <Button
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center gap-2"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Run Test
              </Button>
            </div>
          )}

          {/* Test Results */}
          {hasRun && !testError && (
            <div className="space-y-4">
              <Card className="p-4">
                <h4 className="font-medium text-primary mb-3">
                  Test Results
                </h4>
                {testResult == null ? (
                  <p className="text-sm text-tertiary">
                    No result data was returned.
                  </p>
                ) : (
                  <pre className="text-xs font-mono bg-surface-secondary rounded p-3 overflow-x-auto whitespace-pre-wrap">
                    {typeof testResult === 'string'
                      ? testResult
                      : JSON.stringify(testResult, null, 2)}
                  </pre>
                )}
              </Card>

              {/* Test Again Button */}
              <div className="text-center pt-4">
                <Button
                  onClick={handleTest}
                  disabled={isTesting}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  Test Again
                </Button>
              </div>
            </div>
          )}

          {/* Error display */}
          {testError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center gap-2 text-red-700 text-sm">
                <AlertTriangle className="h-4 w-4" />
                {testError}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isTesting}
            >
              {hasRun ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
