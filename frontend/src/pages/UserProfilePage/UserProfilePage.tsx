/**
 * UserProfilePage - User profile and account settings
 *
 * Features:
 * - View user information
 * - Change password
 * - View account details
 */

import React, { useState, FormEvent } from 'react';
import { User, Mail, Shield, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
// TODO: Implement change password endpoint
// import { postAuthChangePassword } from '@/api/orval-generated/api';

export const UserProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);

    try {
      // TODO: Implement change password endpoint
      // await postAuthChangePassword({
      //   current_password: currentPassword,
      //   new_password: newPassword,
      // } as any);
      setError('Change password feature is not yet implemented');
      setIsChangingPassword(false);
      return;

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Password change error:', err);

      if (err.data?.error) {
        setError(err.data.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary">Profile & Settings</h1>
        <p className="mt-2 text-secondary">
          Manage your account information and security settings
        </p>
      </div>

      {/* User Information Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">
          Account Information
        </h2>
        <div className="space-y-4">
          {/* Username */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-tertiary">Username</p>
              <p className="text-base font-medium text-primary">
                {user?.username || 'Not set'}
              </p>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900">
              <Mail className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-tertiary">Email</p>
              <p className="text-base font-medium text-primary">
                {user?.email || 'Not set'}
              </p>
            </div>
          </div>

          {/* Role */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900">
              <Shield className="h-5 w-5 text-green-600 dark:text-green-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-tertiary">Role</p>
              <p className="text-base font-medium text-primary capitalize">
                {user?.role || 'Not set'}
              </p>
            </div>
          </div>

          {/* User ID */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-secondary">
              <User className="h-5 w-5 text-secondary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-tertiary">User ID</p>
              <p className="text-base font-mono text-primary">
                {user?.id || 'Not set'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Change Password Card */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="h-5 w-5 text-secondary" />
          <h2 className="text-xl font-semibold text-primary">
            Change Password
          </h2>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          {/* Success Message */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-green-800 dark:text-green-300">
                  Password changed successfully!
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Current Password */}
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-secondary mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={isChangingPassword}
                className="block w-full pr-10 py-2.5 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:bg-surface-secondary disabled:text-gray-500 text-primary bg-surface"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                disabled={isChangingPassword}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-5 w-5 text-tertiary hover:text-secondary" />
                ) : (
                  <Eye className="h-5 w-5 text-tertiary hover:text-secondary" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-secondary mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isChangingPassword}
                className="block w-full pr-10 py-2.5 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:bg-surface-secondary disabled:text-gray-500 text-primary bg-surface"
                placeholder="Enter new password"
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={isChangingPassword}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? (
                  <EyeOff className="h-5 w-5 text-tertiary hover:text-secondary" />
                ) : (
                  <Eye className="h-5 w-5 text-tertiary hover:text-secondary" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isChangingPassword}
                className="block w-full pr-10 py-2.5 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:bg-surface-secondary disabled:text-gray-500 text-primary bg-surface"
                placeholder="Confirm new password"
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isChangingPassword}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5 text-tertiary hover:text-secondary" />
                ) : (
                  <Eye className="h-5 w-5 text-tertiary hover:text-secondary" />
                )}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isChangingPassword || newPassword !== confirmPassword || !currentPassword || !newPassword}
              className="w-full sm:w-auto"
            >
              {isChangingPassword ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Changing password...
                </span>
              ) : (
                'Change Password'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default UserProfilePage;
