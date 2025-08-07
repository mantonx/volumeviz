import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';
import type { NotFoundPageProps } from './NotFoundPage.types';

/**
 * 404 Not Found page component with navigation options.
 *
 * Displayed when users navigate to non-existent routes.
 * Provides helpful navigation options to return to main areas
 * of the application with clear error messaging.
 */
export const NotFoundPage: React.FC<NotFoundPageProps> = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-96 flex items-center justify-center">
      <Card className="p-8 max-w-md text-center">
        <AlertTriangle className="h-16 w-16 mx-auto text-gray-400 mb-6" />
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          404
        </h1>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Button onClick={() => navigate('/')} className="flex-1">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};
