import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue } from 'jotai';
import {
  Menu,
  X,
  Bell,
  Settings,
  User,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  LogOut,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useRealtime } from '@/providers/realtime';
import { ReadyState } from 'react-use-websocket';
import { useAuth } from '@/hooks/useAuth';
import { themeAtom, websocketEnabledAtom } from '@/store';
import { cn } from '@/utils';
import type { HeaderProps, ThemeOption, ApiStatus } from './Header.types';
import type { WebSocketStatus } from '@/atoms/websocket';

/**
 * Theme icon component mapping theme names to appropriate icons
 */
const ThemeIcon = ({ theme }: { theme: ThemeOption }) => {
  switch (theme) {
    case 'light':
      return <Sun className="h-4 w-4" />;
    case 'dark':
      return <Moon className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
};

/**
 * API status icon component with visual feedback for connection state
 */
const StatusIcon = ({ status }: { status: ApiStatus }) => {
  const baseClasses = 'h-4 w-4';

  switch (status) {
    case 'online':
      return <Wifi className={cn(baseClasses, 'text-green-500')} />;
    case 'offline':
      return <WifiOff className={cn(baseClasses, 'text-red-500')} />;
    case 'connecting':
      return (
        <Wifi className={cn(baseClasses, 'text-yellow-500 animate-pulse')} />
      );
    case 'error':
      return <AlertTriangle className={cn(baseClasses, 'text-red-500')} />;
    default:
      return <WifiOff className={cn(baseClasses, 'text-gray-400')} />;
  }
};

/**
 * WebSocket status icon component with enhanced visual feedback
 */
const WebSocketIcon = ({
  status,
}: {
  status: WebSocketStatus;
  latency?: number | null;
}) => {
  const baseClasses = 'h-3 w-3';

  switch (status) {
    case 'connected':
      return (
        <div className="relative">
          <div className={cn(baseClasses, 'rounded-full bg-green-500')} />
          {/* Pulse animation for active connection */}
          <div
            className={cn(
              baseClasses,
              'absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20',
            )}
          />
        </div>
      );
    case 'connecting':
      return (
        <RefreshCw
          className={cn(baseClasses, 'text-yellow-500 animate-spin')}
        />
      );
    case 'reconnecting':
      return (
        <div
          className={cn(
            baseClasses,
            'rounded-full bg-yellow-500 animate-pulse',
          )}
        />
      );
    case 'disconnected':
      return <div className={cn(baseClasses, 'rounded-full bg-gray-400')} />;
    case 'error':
      return (
        <div
          className={cn(baseClasses, 'rounded-full bg-red-500 animate-pulse')}
        />
      );
    default:
      return <div className={cn(baseClasses, 'rounded-full bg-gray-400')} />;
  }
};

/**
 * Application header component providing navigation and system status.
 *
 * Features:
 * - Mobile sidebar toggle (hamburger menu)
 * - Real-time API connection status indicator
 * - Active request counter with loading animation
 * - Theme switcher (light/dark/system)
 * - User menu with settings and help links
 * - Notification bell (future feature)
 *
 * The header is responsive and adapts its layout for mobile and desktop views.
 * Connection status updates automatically based on API health checks.
 * Theme changes are applied immediately to the entire application.
 */
export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const navigate = useNavigate();
  const [theme, setTheme] = useAtom(themeAtom);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  // API status is now handled by TanStack Query - using placeholder values
  const requestCount = 0;
  const apiStatus: ApiStatus = 'online';
  const websocketEnabled = useAtomValue(websocketEnabledAtom);
  const {
    connectionStatus: wsReadyState,
    latency,
    reconnectAttempts,
  } = useRealtime();

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Convert ReadyState to display format (no legacy compatibility in provider)
  const wsStatus = React.useMemo(() => {
    switch (wsReadyState) {
      case ReadyState.CONNECTING:
        return 'connecting';
      case ReadyState.OPEN:
        return 'connected';
      case ReadyState.CLOSING:
        return 'disconnected';
      case ReadyState.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }, [wsReadyState]);

  /**
   * Cycle through available themes: system -> light -> dark -> system
   */
  const handleThemeToggle = () => {
    const themes: ThemeOption[] = ['system', 'light', 'dark'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  /**
   * Get human-readable status text for accessibility
   */
  const getStatusText = (status: ApiStatus): string => {
    switch (status) {
      case 'online':
        return 'Connected to API';
      case 'offline':
        return 'Disconnected from API';
      case 'connecting':
        return 'Connecting to API';
      case 'error':
        return 'API connection error';
      default:
        return 'Unknown API status';
    }
  };

  /**
   * Get WebSocket status text for accessibility
   */
  const getWebSocketStatusText = (status: WebSocketStatus): string => {
    switch (status) {
      case 'connected':
        return 'WebSocket connected';
      case 'connecting':
        return 'WebSocket connecting';
      case 'reconnecting':
        return 'WebSocket reconnecting';
      case 'disconnected':
        return 'WebSocket disconnected';
      case 'error':
        return 'WebSocket connection error';
      default:
        return 'Unknown WebSocket status';
    }
  };

  /**
   * Get combined status text for tooltip
   */
  const getCombinedStatusText = (): string => {
    let text = getStatusText(apiStatus);
    if (websocketEnabled) {
      text += ` | ${getWebSocketStatusText(wsStatus)}`;
      if (latency) {
        text += ` (${latency}ms)`;
      }
      if (reconnectAttempts > 0) {
        text += ` - Attempt ${reconnectAttempts}`;
      }
    }
    return text;
  };

  /**
   * Get WebSocket status text for display
   */
  const getWebSocketDisplayText = (status: WebSocketStatus): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left side: Mobile menu button */}
        <div className="flex items-center lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>

        {/* Center: Page title and breadcrumbs (future enhancement) */}
        <div className="flex-1 lg:flex-none">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white lg:hidden">
            VolumeViz
          </h1>
        </div>

        {/* Right side: Status indicators and user menu */}
        <div className="flex items-center space-x-4">
          {/* Combined API and WebSocket Status */}
          <div className="flex items-center space-x-2">
            {!websocketEnabled ? (
              /* REST-only status */
              <div
                data-testid="status-pill"
                className="flex items-center space-x-2 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700"
                title={getStatusText(apiStatus)}
              >
                <StatusIcon status={apiStatus} />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  API: {apiStatus === 'online' ? 'OK' : 'Error'}
                </span>
                {requestCount > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                    {requestCount}
                  </span>
                )}
              </div>
            ) : (
              /* REST + WebSocket status */
              <div
                data-testid="status-pill"
                className="flex items-center space-x-3 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700"
                title={getCombinedStatusText()}
              >
                {/* API Status */}
                <div className="flex items-center space-x-1">
                  <StatusIcon status={apiStatus} />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    API: {apiStatus === 'online' ? 'OK' : 'Error'}
                  </span>
                </div>

                {/* Separator dot */}
                <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 separator-dot" />

                {/* WebSocket Status */}
                <div className="flex items-center space-x-1">
                  <div data-testid="ws-status-icon">
                    <WebSocketIcon status={wsStatus} latency={latency} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    RT: {getWebSocketDisplayText(wsStatus)}
                  </span>
                </div>

                {/* Request counter */}
                {requestCount > 0 && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 separator-dot" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                      {requestCount}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleThemeToggle}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title={`Current theme: ${theme}`}
            aria-label="Toggle theme"
          >
            <ThemeIcon theme={theme} />
          </Button>

          {/* Notifications (future feature) */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>

          {/* Settings Menu */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef} data-tour="user-menu">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="User menu"
              aria-label="Open user menu"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              <User className="h-4 w-4" />
            </Button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <UserCircle className="h-8 w-8 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {user?.display_name ||
                          user?.username ||
                          user?.email ||
                          'User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/profile');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  View Profile
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/admin');
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Admin Panel
                  </button>
                )}
                <button
                  onClick={logout}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Help */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Help"
            aria-label="Get help"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
