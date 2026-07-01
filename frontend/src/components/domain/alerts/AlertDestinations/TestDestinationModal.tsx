import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { X, TestTube, Loader2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAlertDestinations } from '@/hooks/useAlerts';
import type { AlertDestination } from '@/hooks/useAlerts';

export interface TestDestinationModalProps {
  destination: AlertDestination;
  open: boolean;
  onClose: () => void;
}

export const TestDestinationModal: React.FC<TestDestinationModalProps> = ({
  destination,
  open,
  onClose,
}) => {
  const { testDestination, isTesting, testError } = useAlertDestinations();
  const [testResult, setTestResult] = useState<{
    message: string;
    tested_at?: string;
  } | null>(null);

  const handleTest = async () => {
    if (!destination.id) return;
    try {
      setTestResult(null);
      const result = await testDestination(destination.id);
      setTestResult(result);
    } catch {
      // Error is surfaced via testError below
    }
  };

  const handleClose = () => {
    setTestResult(null);
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
          </div>

          <div className="space-y-6">
            {!testResult && (
              <div className="text-center">
                <p className="text-secondary mb-4">
                  Send a test notification to this destination to verify it is
                  configured correctly.
                </p>
                <Button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="flex items-center gap-2 mx-auto"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  Send Test
                </Button>
              </div>
            )}

            {/* Test Result */}
            {testResult && !testError && (
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-sm font-medium mb-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  Test Successful!
                </div>
                <p className="text-sm text-green-600 dark:text-green-300">
                  {testResult.message}
                </p>
                {testResult.tested_at && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600 dark:text-green-400">
                    <Clock className="h-3 w-3" />
                    Tested at:{' '}
                    {new Date(testResult.tested_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Error display */}
            {testError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
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
                {testResult ? 'Close' : 'Cancel'}
              </Button>
              {testResult && (
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
                  Test Again
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
