import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  X,
  TestTube,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAlertDestinations } from '@/hooks/useAlerts';
import type { AlertDestination, TestDestinationRequest } from '@/api/alerts';

export interface TestDestinationModalProps {
  destination: AlertDestination;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  subject: string;
  message: string;
}

const initialFormState: FormState = {
  subject: 'Test Alert - VolumeViz',
  message:
    'This is a test message to verify your alert destination is working correctly.',
};

export const TestDestinationModal: React.FC<TestDestinationModalProps> = ({
  destination,
  open,
  onClose,
}) => {
  const { testDestination, operationLoading, operationError } =
    useAlertDestinations();
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    delivered_at?: string;
  } | null>(null);

  const isLoading = operationLoading[`testDestination_${destination.id}`];
  const error = operationError[`testDestination_${destination.id}`];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setTestResult(null);

      const params: TestDestinationRequest = {
        subject: formState.subject.trim(),
        message: formState.message.trim(),
      };

      const result = await testDestination(destination.id, params);
      setTestResult(result);
    } catch (error) {
      // Error is handled by the hook
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      });
    }
  };

  const handleClose = () => {
    setTestResult(null);
    setFormState(initialFormState);
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

        <Card className="relative w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-primary">
              Test Destination
            </h2>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Destination Info */}
          <div className="mb-6 p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-lg">
                {destination.type === 'slack' && '💬'}
                {destination.type === 'pushover' && '📱'}
                {destination.type === 'webhook' && '🔗'}
              </div>
              <div>
                <h3 className="font-medium text-primary">
                  {destination.name}
                </h3>
                <p className="text-sm text-tertiary capitalize">
                  {destination.type} destination
                </p>
              </div>
            </div>
            {destination.description && (
              <p className="text-sm text-secondary">
                {destination.description}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Test Message Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={formState.subject}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                  placeholder="Test alert subject"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Message
                </label>
                <textarea
                  value={formState.message}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                  rows={4}
                  placeholder="Test alert message"
                  required
                />
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={cn(
                  'p-4 border rounded-lg',
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium mb-2',
                    testResult.success
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700',
                  )}
                >
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {testResult.success ? 'Test Successful!' : 'Test Failed'}
                </div>
                <p
                  className={cn(
                    'text-sm',
                    testResult.success
                      ? 'text-green-600 dark:text-green-300'
                      : 'text-red-600 dark:text-red-300',
                  )}
                >
                  {testResult.message}
                </p>
                {testResult.delivered_at && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600 dark:text-green-400">
                    <Clock className="h-3 w-3" />
                    Delivered at:{' '}
                    {new Date(testResult.delivered_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Error display */}
            {error && !testResult && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div className="flex items-center gap-2 text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-line">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                {testResult ? 'Close' : 'Cancel'}
              </Button>
              {!testResult && (
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  Send Test
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
