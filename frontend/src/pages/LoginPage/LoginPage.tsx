/**
 * LoginPage - User authentication page
 *
 * Features:
 * - Email/password login
 * - JWT token management
 * - Remember me functionality
 * - Password reset link
 * - Error handling and validation
 * - Redirect after successful login
 */

import React, { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        email,
        password,
      } as any);

      const responseData = response as any;

      // Store the JWT token and user info
      if (responseData.access_token) {
        // Store refresh token if remember me is checked
        if (rememberMe && responseData.refresh_token) {
          localStorage.setItem('refresh_token', responseData.refresh_token);
        }

        // Use the auth hook to set authentication state
        login(responseData.access_token, responseData.user);

        // Redirect to the page they were trying to access, or dashboard
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else {
        setError('Login failed: No access token received');
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

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-900 dark:text-gray-900 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500 dark:text-gray-600" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 text-gray-900 bg-white dark:bg-white dark:text-gray-900 dark:border-gray-300"
                  placeholder="you@example.com"
                  autoComplete="email"
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
              Default credentials:{' '}
              <code className="bg-blue-100 px-1 rounded font-medium">
                admin@volumeviz.local
              </code>
            </p>
            <p className="text-xs text-blue-900 mt-1">
              Or use the JWT token from the integration test page.
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-800 dark:text-gray-800">
            Don't have an account?{' '}
            <button
              onClick={() => console.log('Registration not implemented')}
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-600 dark:hover:text-blue-700"
            >
              Contact your administrator
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
