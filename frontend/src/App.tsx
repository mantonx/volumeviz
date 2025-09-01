import { ApiHealthChecker } from '@/components/ApiHealthChecker';
import { Layout } from '@/components/layout/Layout';
import { ToastProvider } from '@/components/ui';
// Lazy load visualization components
const RealTimeDashboard = React.lazy(() => import('@/components/visualization/RealTimeDashboard'));
const HistoricalDataDashboard = React.lazy(() => import('@/components/visualization/HistoricalDataDashboard'));
// Lazy load pages for better code splitting
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const VolumesPage = React.lazy(() => import('@/pages/VolumesPage'));  
const VolumeDetailsPage = React.lazy(() => import('@/pages/VolumeDetailsPage'));
const MountsPage = React.lazy(() => import('@/pages/MountsPage'));
const RulesPage = React.lazy(() => import('@/pages/RulesPage'));
const ExplorerPage = React.lazy(() => import('@/pages/ExplorerPage'));
const SearchPage = React.lazy(() => import('@/pages/SearchPage'));
const AlertsPage = React.lazy(() => import('@/pages/AlertsPage'));
const HealthPage = React.lazy(() => import('@/pages/HealthPage'));
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage'));
const OnboardingPage = React.lazy(() => import('@/pages/OnboardingPage'));
const NotFoundPage = React.lazy(() => import('@/pages/NotFoundPage'));
const RealtimeTestPage = React.lazy(() => import('@/pages/RealtimeTestPage'));
const WebSocketTestPage = React.lazy(() => import('@/pages/WebSocketTestPage'));
import { RealtimeProvider } from '@/providers/realtime';
import { backgroundSyncManager } from '@/utils/background-sync';
import { serviceWorkerManager } from '@/utils/service-worker';
import React, { Suspense, useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from 'react-router-dom';

const PageLoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
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
    
    // Set up background sync event listener
    const handleBackgroundSync = () => {
      // Background sync triggered from service worker
      backgroundSyncManager.forcSync();
    };
    
    window.addEventListener('sw-background-sync', handleBackgroundSync);
    
    // Register for background sync if supported
    if (serviceWorkerManager.isSupported()) {
      serviceWorkerManager.registerBackgroundSync();
    }
    
    return () => {
      window.removeEventListener('sw-background-sync', handleBackgroundSync);
    };
  }, []);

  if (loading) {
    return (
      <div
        data-testid="app-loading"
        className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading VolumeViz...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="app-root">
      <ToastProvider>
        <RealtimeProvider>
          <ApiHealthChecker />
          <Router>
            <Layout>
              <Suspense fallback={<PageLoadingSpinner />}>
                <Routes>
                {/* Onboarding Route */}
                <Route path="/onboarding" element={<OnboardingPage />} />

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
                <Route path="/volumes" element={<VolumesPage />} />
                <Route path="/volumes/:name" element={<VolumeDetailsPage />} />
                <Route path="/mounts" element={<MountsPage />} />
                <Route path="/rules" element={<RulesPage />} />

                {/* Explorer Routes */}
                <Route path="/explorer" element={<ExplorerPage />} />
                <Route path="/explorer/:volumeId" element={<ExplorerPage />} />

                {/* Search Routes */}
                <Route path="/search" element={<SearchPage />} />

                {/* Visualization Routes */}
                <Route path="/realtime" element={<RealTimeDashboard />} />
                <Route
                  path="/historical"
                  element={<HistoricalDataDashboard />}
                />

                {/* Alerts Routes */}
                <Route path="/alerts" element={<AlertsPage />} />

                {/* System Routes */}
                <Route path="/health" element={<HealthPage />} />
                <Route path="/settings" element={<SettingsPage />} />

                {/* Debug Routes */}
                <Route path="/realtime-test" element={<RealtimeTestPage />} />
                <Route path="/websocket-test" element={<WebSocketTestPage />} />

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </Layout>
          </Router>
        </RealtimeProvider>
      </ToastProvider>
    </div>
  );
};

export default App;
