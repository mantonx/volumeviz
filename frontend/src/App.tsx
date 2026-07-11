import React, { Suspense, useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from 'react-router-dom';
import { ApiHealthChecker } from '@/components/application';
import { ProtectedRoute, RequireAdmin } from '@/components/auth';
import { Layout } from '@/components/layout/Layout';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ToastProvider } from '@/components/ui';
import { RealtimeProvider } from '@/providers/realtime';
import { ThemeProvider } from '@/providers/theme/ThemeProvider';
import { backgroundSyncManager } from '@/utils/background-sync';

// Error Boundary for React errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-primary mb-4">Something went wrong</h1>
            <p className="text-secondary mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lazy load pages for better code splitting
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const VolumesPage = React.lazy(() => import('@/pages/VolumesPage'));
const FilesPage = React.lazy(() => import('@/pages/FilesPage'));
const TrendsPage = React.lazy(() => import('@/pages/TrendsPage'));
const AlertsPage = React.lazy(() => import('@/pages/AlertsPage'));
const HealthPage = React.lazy(() => import('@/pages/HealthPage'));
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage'));
const OnboardingPage = React.lazy(() => import('@/pages/OnboardingPage'));
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/RegisterPage'));
const UserProfilePage = React.lazy(() => import('@/pages/UserProfilePage'));
const NotFoundPage = React.lazy(() => import('@/pages/NotFoundPage'));

// Admin pages
const AdminDashboardPage = React.lazy(() => import('@/pages/admin/DashboardPage'));
const AdminUsersPage = React.lazy(() => import('@/pages/admin/UsersPage'));
const AdminAuditLogsPage = React.lazy(() => import('@/pages/admin/AuditLogsPage'));
const AdminPermissionsPage = React.lazy(() => import('@/pages/admin/PermissionsPage'));
const AdminSystemSettingsPage = React.lazy(() => import('@/pages/admin/SystemSettingsPage'));

const RulesPage = React.lazy(() => import('@/pages/RulesPage'));

const PageLoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    <span className="ml-2 text-secondary">Loading...</span>
  </div>
);

const App: React.FC = () => {
  const [shouldRedirectToOnboarding, setShouldRedirectToOnboarding] =
    useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if onboarding has been completed
    const checkOnboardingStatus = async () => {
      try {
        const onboardingComplete = localStorage.getItem(
          'volumeviz_onboarding_complete',
        );
        const onboardingAttempted = localStorage.getItem(
          'volumeviz_onboarding_attempted',
        );

        if (onboardingComplete === 'true' || onboardingAttempted === 'true') {
          setShouldRedirectToOnboarding(false);
        } else {
          // Check if there are any existing tracking rules
          const response = await fetch('/api/v1/tracking/rules');
          if (response.ok) {
            const data = await response.json();
            const hasRules = data.total > 0;
            setShouldRedirectToOnboarding(!hasRules);
          } else {
            // If API fails, assume fresh install
            setShouldRedirectToOnboarding(true);
          }
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        // Default to showing onboarding on error
        setShouldRedirectToOnboarding(true);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();

    // shouldRedirectToOnboarding is only computed once, here, at mount —
    // OnboardingPage's completion step sets localStorage but that alone
    // doesn't make this component re-render, so without this listener a
    // user who just finished onboarding gets bounced straight back into it
    // by the stale `true` value the very first mount computed.
    const handleOnboardingComplete = () => setShouldRedirectToOnboarding(false);
    window.addEventListener(
      'volumeviz-onboarding-complete',
      handleOnboardingComplete,
    );

    // Set up background sync event listener
    const handleBackgroundSync = () => {
      // Background sync triggered from service worker
      backgroundSyncManager.forcSync();
    };

    window.addEventListener('sw-background-sync', handleBackgroundSync);

    // DISABLED: Service worker caching conflicts with Vite dev mode hot reload
    // TODO: Re-enable in production builds only
    // Register for background sync if supported
    // if (serviceWorkerManager.isSupported()) {
    //   serviceWorkerManager.registerBackgroundSync();
    // }

    return () => {
      window.removeEventListener('sw-background-sync', handleBackgroundSync);
      window.removeEventListener(
        'volumeviz-onboarding-complete',
        handleOnboardingComplete,
      );
    };
  }, []);

  if (loading) {
    return (
      <div
        data-testid="app-loading"
        className="min-h-screen flex items-center justify-center bg-gray-50 bg-surface"
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-secondary">
            Loading VolumeViz...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div data-testid="app-root">
          <ToastProvider>
            <RealtimeProvider>
              <ApiHealthChecker />
              <Router>
                <Suspense fallback={<PageLoadingSpinner />}>
                    <Routes>
                  {/* Public Routes (no Layout) */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Admin Routes (protected, admin-only, separate layout) */}
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute>
                        <RequireAdmin>
                          <AdminLayout>
                            <Routes>
                              <Route index element={<AdminDashboardPage />} />
                              <Route path="users" element={<AdminUsersPage />} />
                              <Route path="audit" element={<AdminAuditLogsPage />} />
                              <Route path="permissions" element={<AdminPermissionsPage />} />
                              <Route path="settings" element={<AdminSystemSettingsPage />} />
                              <Route path="*" element={<Navigate to="/admin" replace />} />
                            </Routes>
                          </AdminLayout>
                        </RequireAdmin>
                      </ProtectedRoute>
                    }
                  />

                  {/* Protected Routes (with Layout) */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <Layout>
                            <Routes>
                            {/* Onboarding Route */}
                            <Route
                              path="/onboarding"
                              element={<OnboardingPage />}
                            />

                            {/* Main Routes - redirect to onboarding if needed */}
                            <Route
                              path="/"
                              element={
                                shouldRedirectToOnboarding ? (
                                  <Navigate to="/onboarding" replace />
                                ) : (
                                  <Dashboard />
                                )
                              }
                            />
                            {/* Main Navigation Routes */}
                            <Route path="/volumes" element={<VolumesPage />} />
                            <Route path="/files" element={<FilesPage />} />
                            <Route path="/trends" element={<TrendsPage />} />
                            <Route path="/alerts" element={<AlertsPage />} />

                            <Route path="/rules" element={<RulesPage />} />

                            {/* System Routes */}
                            <Route path="/health" element={<HealthPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/profile" element={<UserProfilePage />} />

                            {/* 404 Route */}
                            <Route path="*" element={<NotFoundPage />} />
                          </Routes>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Suspense>
              </Router>
          </RealtimeProvider>
        </ToastProvider>
      </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
