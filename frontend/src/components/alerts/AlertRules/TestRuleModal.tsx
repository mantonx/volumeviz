import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  X,
  TestTube,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Send,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAlertRules } from '@/hooks/useAlerts';
import type { AlertRule } from '@/api/alerts';

export interface TestRuleModalProps {
  rule: AlertRule;
  open: boolean;
  onClose: () => void;
}

interface TestResult {
  triggered: boolean;
  message: string;
  matched_volumes?: Array<{
    id: string;
    name: string;
    size: number;
    path: string;
  }>;
  evaluation_details?: {
    condition: string;
    result: boolean;
    field_value: any;
    comparison: string;
  };
  delivery_results?: Array<{
    destination_id: number;
    destination_name: string;
    success: boolean;
    message: string;
    delivered_at?: string;
  }>;
}

export const TestRuleModal: React.FC<TestRuleModalProps> = ({
  rule,
  open,
  onClose,
}) => {
  const { testRule, operationLoading, operationError } = useAlertRules();
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const isLoading = operationLoading[`testRule_${rule.id}`];
  const error = operationError[`testRule_${rule.id}`];

  const handleTest = async () => {
    try {
      setTestResult(null);
      const result = await testRule(rule.id);
      setTestResult(result);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleClose = () => {
    setTestResult(null);
    onClose();
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
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatCondition = (condition: any) => {
    if (!condition) return 'No condition';

    if (
      condition.field &&
      condition.operator &&
      condition.value !== undefined
    ) {
      return `${condition.field} ${condition.operator} ${condition.value}`;
    }

    return JSON.stringify(condition);
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Test Alert Rule
            </h2>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Rule Info */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-blue-500" />
              <h3 className="font-medium text-gray-900 dark:text-white">
                {rule.name}
              </h3>
              <Badge
                variant="secondary"
                className={getSeverityColor(rule.severity)}
              >
                {rule.severity}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {rule.description || 'No description'}
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>Condition: {formatCondition(rule.condition)}</div>
              <div>Cooldown: {rule.cooldown_seconds} seconds</div>
              <div>Routes: {rule.routes?.length || 0} destination(s)</div>
            </div>
          </div>

          {/* Test Action */}
          {!testResult && (
            <div className="mb-6 text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Click the button below to test this alert rule against your
                current volumes.
              </p>
              <Button
                onClick={handleTest}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Run Test
              </Button>
            </div>
          )}

          {/* Test Results */}
          {testResult && (
            <div className="space-y-4">
              {/* Overall Result */}
              <div
                className={cn(
                  'p-4 border rounded-lg',
                  testResult.triggered
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium mb-2',
                    testResult.triggered
                      ? 'text-orange-700 dark:text-orange-400'
                      : 'text-green-700 dark:text-green-400',
                  )}
                >
                  {testResult.triggered ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {testResult.triggered
                    ? 'Rule Would Trigger!'
                    : 'Rule Would Not Trigger'}
                </div>
                <p
                  className={cn(
                    'text-sm',
                    testResult.triggered
                      ? 'text-orange-600 dark:text-orange-300'
                      : 'text-green-600 dark:text-green-300',
                  )}
                >
                  {testResult.message}
                </p>
              </div>

              {/* Evaluation Details */}
              {testResult.evaluation_details && (
                <Card className="p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Evaluation Details
                  </h4>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Condition:
                      </span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {testResult.evaluation_details.condition}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Field Value:
                      </span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {typeof testResult.evaluation_details.field_value ===
                        'number'
                          ? formatBytes(
                              testResult.evaluation_details.field_value,
                            )
                          : testResult.evaluation_details.field_value}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Result:
                      </span>
                      <Badge
                        variant={
                          testResult.evaluation_details.result
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {testResult.evaluation_details.result
                          ? 'Match'
                          : 'No Match'}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {testResult.evaluation_details.comparison}
                    </div>
                  </div>
                </Card>
              )}

              {/* Matched Volumes */}
              {testResult.matched_volumes &&
                testResult.matched_volumes.length > 0 && (
                  <Card className="p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      Matching Volumes ({testResult.matched_volumes.length})
                    </h4>
                    <div className="space-y-2">
                      {testResult.matched_volumes.map((volume, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded"
                        >
                          <div>
                            <div className="font-mono text-sm text-gray-900 dark:text-white">
                              {volume.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {volume.path}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {formatBytes(volume.size)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

              {/* Delivery Results */}
              {testResult.delivery_results &&
                testResult.delivery_results.length > 0 && (
                  <Card className="p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      Delivery Test Results
                    </h4>
                    <div className="space-y-3">
                      {testResult.delivery_results.map((delivery, index) => (
                        <div
                          key={index}
                          className={cn(
                            'p-3 border rounded-lg',
                            delivery.success
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Send className="h-4 w-4" />
                              <span className="font-medium text-gray-900 dark:text-white">
                                {delivery.destination_name}
                              </span>
                              <Badge
                                variant={
                                  delivery.success ? 'default' : 'destructive'
                                }
                              >
                                {delivery.success ? 'Success' : 'Failed'}
                              </Badge>
                            </div>
                            {delivery.delivered_at && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="h-3 w-3" />
                                {new Date(
                                  delivery.delivered_at,
                                ).toLocaleString()}
                              </div>
                            )}
                          </div>
                          <p
                            className={cn(
                              'text-sm',
                              delivery.success
                                ? 'text-green-600 dark:text-green-300'
                                : 'text-red-600 dark:text-red-300',
                            )}
                          >
                            {delivery.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

              {/* Test Again Button */}
              <div className="text-center pt-4">
                <Button
                  onClick={handleTest}
                  disabled={isLoading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
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
          {error && !testResult && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              {testResult ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
