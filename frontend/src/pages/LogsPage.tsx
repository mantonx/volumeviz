import React from 'react';
import { FileText, Terminal, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export const LogsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Logs
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          System and container log monitoring
        </p>
      </div>

      <Card className="p-12 text-center">
        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Log Viewer Coming Soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Real-time log streaming and search capabilities are in development.
        </p>
      </Card>
    </div>
  );
};
