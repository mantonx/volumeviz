/**
 * LoginPage - User authentication page
 *
 * Features:
 * - Username/password login with organization ID
 * - JWT token management
 * - Remember me functionality
 * - Error handling and validation
 * - Redirect after successful login
 * - Organization-scoped authentication
 */

import React, { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { postAuthLogin } from '@/api/orval-generated/api';
import { useAuth } from '@/hooks/useAuth';

interface LoginPageProps {
  className?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('1'); // Default to org 1
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Call the login API
      const response = await postAuthLogin({
        username,
        password,
        organization_id: parseInt(organizationId, 10),
      } as any);

      const responseData = response as any;

      // Store the JWT token and user info
      if (responseData.token) {
        // Store refresh token if remember me is checked
        if (rememberMe && responseData.refresh_token) {
          localStorage.setItem('refresh_token', responseData.refresh_token);
        }

        // Use the auth hook to set authentication state
        login(responseData.token, {
          id: responseData.user.ID.toString(),
          email: responseData.user.Email,
          username: responseData.user.Username,
          role: responseData.user.Role,
        });

        // Redirect to the page they were trying to access, or dashboard
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else {
        setError('Login failed: No token received');
      }
    } catch (err: any) {
      console.error('Login error:', err);

      // Extract error message
      if (err.data?.error) {
        setError(err.data.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4 ${className}`}
    >
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-900">VolumeViz</h1>
          <p className="mt-2 text-gray-800 dark:text-gray-800">Sign in to your account</p>
        </div>

        <Card className="p-8 bg-white dark:bg-white dark:text-gray-900">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Username Field */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-900 dark:text-gray-900 mb-2"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500 dark:text-gray-600" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 text-gray-900 bg-white dark:bg-white dark:text-gray-900 dark:border-gray-300"
                  placeholder="Enter your username"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-900 dark:text-gray-900 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500 dark:text-gray-600" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 text-gray-900 bg-white dark:bg-white dark:text-gray-900 dark:border-gray-300"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-500 hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-800" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-500 hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-800" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-900 dark:text-gray-900"
                >
                  Remember me
                </label>
              </div>

              <button
                type="button"
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
                onClick={() => console.log('Password reset not implemented')}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Development Note */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-900 mb-2 font-semibold">
              Development Mode:
            </p>
            <p className="text-xs text-blue-900">
              Test credentials:{' '}
              <code className="bg-blue-100 px-1 rounded font-medium">
                demouser / NewPassword123
              </code>
            </p>
            <p className="text-xs text-blue-900 mt-1">
              Organization ID is set to 1 by default.
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-800 dark:text-gray-800">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/register')}
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-600 dark:hover:text-blue-700"
            >
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
