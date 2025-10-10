/**
 * PermissionsPage - Admin page for managing roles and permissions
 *
 * Features:
 * - View all roles and their permissions
 * - Edit role permissions
 * - Create custom roles
 * - Permission matrix view
 */

import React, { useState } from 'react';
import { Shield, Plus, Edit, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Permission categories and actions
const permissionCategories = [
  {
    name: 'Volumes',
    actions: ['view', 'scan', 'edit', 'delete'],
  },
  {
    name: 'Files',
    actions: ['view', 'search', 'export'],
  },
  {
    name: 'Users',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    name: 'Organizations',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    name: 'System',
    actions: ['view_logs', 'manage_settings', 'manage_permissions'],
  },
];

// Mock roles data
const mockRoles = [
  {
    id: 1,
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full system access',
    permissions: {
      'Volumes.view': true,
      'Volumes.scan': true,
      'Volumes.edit': true,
      'Volumes.delete': true,
      'Files.view': true,
      'Files.search': true,
      'Files.export': true,
      'Users.view': true,
      'Users.create': true,
      'Users.edit': true,
      'Users.delete': true,
      'Organizations.view': true,
      'Organizations.create': true,
      'Organizations.edit': true,
      'Organizations.delete': true,
      'System.view_logs': true,
      'System.manage_settings': true,
      'System.manage_permissions': true,
    },
  },
  {
    id: 2,
    name: 'operator',
    displayName: 'Operator',
    description: 'Can manage volumes and view data',
    permissions: {
      'Volumes.view': true,
      'Volumes.scan': true,
      'Volumes.edit': true,
      'Volumes.delete': false,
      'Files.view': true,
      'Files.search': true,
      'Files.export': true,
      'Users.view': true,
      'Users.create': false,
      'Users.edit': false,
      'Users.delete': false,
      'Organizations.view': true,
      'Organizations.create': false,
      'Organizations.edit': false,
      'Organizations.delete': false,
      'System.view_logs': false,
      'System.manage_settings': false,
      'System.manage_permissions': false,
    },
  },
  {
    id: 3,
    name: 'user',
    displayName: 'User',
    description: 'Can view and search volumes',
    permissions: {
      'Volumes.view': true,
      'Volumes.scan': false,
      'Volumes.edit': false,
      'Volumes.delete': false,
      'Files.view': true,
      'Files.search': true,
      'Files.export': false,
      'Users.view': false,
      'Users.create': false,
      'Users.edit': false,
      'Users.delete': false,
      'Organizations.view': false,
      'Organizations.create': false,
      'Organizations.edit': false,
      'Organizations.delete': false,
      'System.view_logs': false,
      'System.manage_settings': false,
      'System.manage_permissions': false,
    },
  },
  {
    id: 4,
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access',
    permissions: {
      'Volumes.view': true,
      'Volumes.scan': false,
      'Volumes.edit': false,
      'Volumes.delete': false,
      'Files.view': true,
      'Files.search': false,
      'Files.export': false,
      'Users.view': false,
      'Users.create': false,
      'Users.edit': false,
      'Users.delete': false,
      'Organizations.view': false,
      'Organizations.create': false,
      'Organizations.edit': false,
      'Organizations.delete': false,
      'System.view_logs': false,
      'System.manage_settings': false,
      'System.manage_permissions': false,
    },
  },
];

export const PermissionsPage: React.FC = () => {
  const [roles, setRoles] = useState(mockRoles);
  const [editingRole, setEditingRole] = useState<number | null>(null);

  const togglePermission = (roleId: number, permission: string) => {
    if (editingRole !== roleId) return;

    setRoles(
      roles.map((role) =>
        role.id === roleId
          ? {
              ...role,
              permissions: {
                ...role.permissions,
                [permission]: !role.permissions[permission],
              },
            }
          : role
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Roles & Permissions
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage user roles and their permissions
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Roles List */}
      <div className="space-y-6">
        {roles.map((role) => (
          <Card key={role.id} className="p-6">
            {/* Role Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <Shield className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {role.displayName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {role.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingRole === role.id ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRole(null)}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRole(null)}
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingRole(role.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Permissions Matrix */}
            <div className="space-y-4">
              {permissionCategories.map((category) => (
                <div key={category.name}>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {category.name}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {category.actions.map((action) => {
                      const permissionKey = `${category.name}.${action}`;
                      const hasPermission = role.permissions[permissionKey];
                      const isEditing = editingRole === role.id;

                      return (
                        <button
                          key={permissionKey}
                          onClick={() => togglePermission(role.id, permissionKey)}
                          disabled={!isEditing}
                          className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                            ${hasPermission
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            }
                            ${isEditing ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                          `}
                        >
                          {hasPermission ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          <span className="capitalize">{action.replace('_', ' ')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PermissionsPage;
