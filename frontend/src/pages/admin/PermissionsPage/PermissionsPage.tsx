/**
 * PermissionsPage - Admin page for managing role permissions
 *
 * Features:
 * - View the real permission matrix for the 4 roles the app enforces
 *   (admin, operator, user, viewer) from GET /api/v1/permissions
 * - Toggle org-specific permission grants via PUT /api/v1/permissions
 * - Global/built-in default grants are shown as locked - they apply to
 *   every organization and can't be revoked from this page
 */

import React, { useState } from 'react';
import { Shield, Lock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  useGetApiV1Permissions,
  usePutApiV1Permissions,
} from '@/api/orval-generated/api';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: 'Administrator',
  operator: 'Operator',
  user: 'User',
  viewer: 'Viewer',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full system access',
  operator: 'Can manage volumes and view data',
  user: 'Can view and search volumes',
  viewer: 'Read-only access',
};

export const PermissionsPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useGetApiV1Permissions();
  const updatePermission = usePutApiV1Permissions();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const response = data?.status === 200 ? data.data : undefined;
  const roles = response?.roles ?? [];
  const resources = response?.resources ?? [];
  const actions = response?.actions ?? [];

  const handleToggle = async (role: string, resource: string, action: string, currentlyGranted: boolean) => {
    const key = `${role}:${resource}:${action}`;
    setPendingKey(key);
    setError(null);
    try {
      await updatePermission.mutateAsync({
        data: { role: role as any, resource, action: action as any, granted: !currentlyGranted },
      });
      await refetch();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to update ${resource}:${action} for ${role}`,
      );
    }
    setPendingKey(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary">Roles & Permissions</h1>
        <p className="mt-2 text-secondary">
          Manage permissions for the roles VolumeViz actually enforces. Custom roles aren't
          supported yet - authorization checks are based on these 4 fixed roles.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {isError && (
        <div className="text-center py-12">
          <Shield className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-primary">Couldn't load permissions</h3>
          <p className="mt-1 text-sm text-tertiary">
            There was a problem reaching the server. Try again shortly.
          </p>
        </div>
      )}

      {!isError && !isLoading && (
        <div className="space-y-6">
          {roles.map((role) => {
            const roleName = role.role ?? '';
            const grants = role.grants ?? {};
            const orgGrants = role.org_grants ?? {};

            return (
              <Card key={roleName} className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900">
                    <Shield className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-primary">
                      {ROLE_DISPLAY_NAMES[roleName] ?? roleName}
                    </h3>
                    <p className="text-sm text-tertiary">{ROLE_DESCRIPTIONS[roleName] ?? ''}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {resources.map((resource) => (
                    <div key={resource}>
                      <h4 className="text-sm font-medium text-secondary mb-2 capitalize">
                        {resource}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {actions.map((action) => {
                          const key = `${resource}:${action}`;
                          const hasPermission = !!grants[key];
                          const isOrgOverride = !!orgGrants[key];
                          const isLocked = hasPermission && !isOrgOverride;
                          const isPending = pendingKey === `${roleName}:${resource}:${action}`;

                          return (
                            <button
                              key={key}
                              onClick={() =>
                                !isLocked && handleToggle(roleName, resource, action, hasPermission)
                              }
                              disabled={isLocked || isPending}
                              title={
                                isLocked
                                  ? 'Built-in default permission, shared by every organization - cannot be revoked here'
                                  : undefined
                              }
                              className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                                ${hasPermission
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                  : 'bg-surface-secondary text-tertiary'
                                }
                                ${isLocked ? 'cursor-default opacity-80' : isPending ? 'cursor-wait opacity-60' : 'cursor-pointer hover:opacity-80'}
                              `}
                            >
                              {isLocked && <Lock className="h-3.5 w-3.5" />}
                              <span className="capitalize">{action}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PermissionsPage;
