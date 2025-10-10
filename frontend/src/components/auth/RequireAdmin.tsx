/**
 * RequireAdmin - Route wrapper that requires admin role
 *
 * Features:
 * - Checks if user is authenticated
 * - Checks if user has admin role
 * - Redirects to dashboard if not admin
 * - Shows loading state while checking
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle } from 'lucide-react';

interface RequireAdminProps {
  children: React.ReactNode;
}

export const RequireAdmin: React.FC<RequireAdminProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-surface">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-secondary">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Not authenticated - ProtectedRoute should handle this, but just in case
    return <Navigate to="/login" replace />;
  }

  // Check if user has admin role
  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    // Not an admin - show access denied page
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-surface p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-300" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">
            Access Denied
          </h1>
          <p className="text-secondary mb-6">
            You don't have permission to access the admin panel.
            <br />
            Administrator role is required.
          </p>
          <div className="space-y-2 text-sm text-gray-500 text-tertiary">
            <p>Your role: <span className="font-mono font-semibold capitalize">{user?.role || 'unknown'}</span></p>
            <p>Required role: <span className="font-mono font-semibold">admin</span></p>
          </div>
          <div className="mt-6">
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAdmin;
