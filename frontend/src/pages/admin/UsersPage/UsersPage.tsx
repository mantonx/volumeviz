/**
 * UsersPage - Admin page for user management
 *
 * Features:
 * - List all users across organizations
 * - Search and filter users
 * - View user details
 * - Edit user roles
 * - Disable/enable users
 * - Delete users (with confirmation)
 */

import React, { useState, useEffect } from 'react';
import { User, Search, Plus, Edit, Trash2, CheckCircle, XCircle, Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  getUsers,
  postUsers,
  putUsersId,
  deleteUsersId,
  InternalApiV1UsersCreateUserRequest,
  InternalApiV1UsersUpdateUserRequest,
  InternalApiV1UsersCreateUserRequestRole,
  InternalApiV1UsersUpdateUserRequestRole,
} from '@/api/client';

interface UserData {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  organization_id: number;
  created_at: string;
  last_login_at?: string;
}

export const UsersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  const [createForm, setCreateForm] = useState<InternalApiV1UsersCreateUserRequest>({
    username: '',
    email: '',
    password: '',
    role: 'user' as InternalApiV1UsersCreateUserRequestRole,
    organization_id: 1,
  });

  const [editForm, setEditForm] = useState<InternalApiV1UsersUpdateUserRequest>({});

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getUsers({ page: 1, page_size: 100 });
        const responseData = response.data as any;

        // Orval extracts the 'data' field from the API response, so response.data IS the array
        if (Array.isArray(responseData)) {
          setUsers(responseData);
        } else {
          console.error('[UsersPage] Unexpected response format:', responseData);
          setUsers([]);
        }
      } catch (err: any) {
        console.error('[UsersPage] Failed to fetch users:', err);
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const refreshUsers = async () => {
    try {
      const response = await getUsers({ page: 1, page_size: 100 });
      const responseData = response.data as any;

      // Orval extracts the 'data' field from the API response, so response.data IS the array
      if (Array.isArray(responseData)) {
        // Create a completely new array with new object references to force React re-render
        const newUsers = responseData.map((user: any) => ({ ...user }));
        setUsers(newUsers);
        setLastUpdateTime(Date.now());
      } else {
        console.error('[UsersPage] Unexpected response format:', responseData);
        setUsers([]);
      }
    } catch (err: any) {
      console.error('[UsersPage] Failed to refresh users:', err);
      showNotification('error', 'Failed to refresh users');
    }
  };

  const handleCreateUser = async () => {
    try {
      console.log('[UsersPage] Creating user with data:', createForm);
      await postUsers(createForm);
      showNotification('success', 'User created successfully');
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        role: 'user' as InternalApiV1UsersCreateUserRequestRole,
        organization_id: 1,
      });
      await refreshUsers();
    } catch (err: any) {
      console.error('[UsersPage] Failed to create user:', err);
      console.error('[UsersPage] Error response:', err.response);
      console.error('[UsersPage] Error data:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create user';
      showNotification('error', errorMessage);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      await putUsersId(selectedUser.id, editForm);
      showNotification('success', 'User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
      setEditForm({});
      await refreshUsers();
    } catch (err: any) {
      console.error('[UsersPage] Failed to update user:', err);
      showNotification('error', err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await deleteUsersId(selectedUser.id);
      showNotification('success', 'User deleted successfully');
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      await refreshUsers();
    } catch (err: any) {
      console.error('[UsersPage] Failed to delete user:', err);
      showNotification('error', err.response?.data?.message || 'Failed to delete user');
    }
  };

  const openEditModal = (user: UserData) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email,
      role: user.role as InternalApiV1UsersUpdateUserRequestRole,
      is_active: user.is_active,
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (user: UserData) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-secondary">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <p className="mt-2 text-secondary">Please check the console for details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">User Management</h1>
          <p className="mt-2 text-secondary">
            Manage user accounts across all organizations
          </p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by username or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
            />
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-secondary border-b border-line">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  Org ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-tertiary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-line">
              {filteredUsers.map((user) => (
                <tr key={`${user.id}-${lastUpdateTime}`} className="hover:bg-surface-hover">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900">
                        <User className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-primary">
                          {user.username}
                        </div>
                        <div className="text-sm text-tertiary">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                        : user.role === 'user'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-800 bg-surface-secondary text-secondary'
                    }`}>
                      {user.role === 'admin' && <Shield className="h-3 w-3" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-tertiary text-sm">
                        <XCircle className="h-4 w-4" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-tertiary">
                    {user.organization_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-tertiary">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(user)}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteConfirm(user)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Empty state */}
      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-primary">No users found</h3>
          <p className="mt-1 text-sm text-tertiary">
            {searchTerm ? 'Try adjusting your search' : 'Get started by creating a new user'}
          </p>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-primary">Create New User</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 hover:text-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                    placeholder="Enter username (min 3 characters)"
                    minLength={3}
                    required
                  />
                  {createForm.username && createForm.username.length < 3 && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">Username must be at least 3 characters</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                    placeholder="Enter email"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                    placeholder="Enter password (min 8 characters)"
                    minLength={8}
                    required
                  />
                  {createForm.password && createForm.password.length < 8 && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">Password must be at least 8 characters</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Role
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as InternalApiV1UsersCreateUserRequestRole })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                    <option value="operator">Operator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Organization ID
                  </label>
                  <input
                    type="number"
                    value={createForm.organization_id}
                    onChange={(e) => setCreateForm({ ...createForm, organization_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateUser}
                  disabled={
                    !createForm.username ||
                    createForm.username.length < 3 ||
                    !createForm.email ||
                    !createForm.password ||
                    createForm.password.length < 8
                  }
                >
                  Create User
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-primary">Edit User</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 hover:text-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={selectedUser?.username || ''}
                    disabled
                    className="w-full px-3 py-2 border border-line rounded-lg bg-surface-secondary text-primary cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-tertiary">Username cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Role
                  </label>
                  <select
                    value={editForm.role || ''}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as InternalApiV1UsersUpdateUserRequestRole })}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                    <option value="operator">Operator</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editForm.is_active ?? true}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-primary">
                    Active
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleEditUser}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-primary">Delete User</h2>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-gray-400 hover:text-gray-600 hover:text-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-secondary mb-6">
                Are you sure you want to delete user <strong>{selectedUser.username}</strong>? This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteUser}
                >
                  Delete User
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          notification.type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          <p className="font-medium">{notification.message}</p>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
