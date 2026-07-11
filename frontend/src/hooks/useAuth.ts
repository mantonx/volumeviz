/**
 * useAuth - Authentication hook for managing user authentication state
 *
 * Features:
 * - Check if user is authenticated
 * - Get current user info
 * - Login/logout functionality
 * - Token management
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  role: string;
  username?: string;
  display_name?: string;
}

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: () => boolean;
}

export const useAuth = (): UseAuthReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  // Check authentication status
  const checkAuth = useCallback((): boolean => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        setIsAuthenticated(true);
        return true;
      } catch (err) {
        console.error('Failed to parse user data:', err);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUser(null);
        return false;
      }
    }

    setIsAuthenticated(false);
    setUser(null);
    return false;
  }, []);

  // Login function
  const login = useCallback((token: string, userData: User) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
    // useAuth() is a plain hook, not a shared context — other components
    // (e.g. RealtimeProvider) that read localStorage directly wouldn't
    // otherwise learn the token just changed in this tab.
    window.dispatchEvent(new Event('auth-token-changed'));
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    window.dispatchEvent(new Event('auth-token-changed'));
    navigate('/login');
  }, [navigate]);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
    setIsLoading(false);
  }, [checkAuth]);

  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    checkAuth,
  };
};

export default useAuth;
