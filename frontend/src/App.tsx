import { ApiHealthChecker } from '@/components/ApiHealthChecker';
import { Layout } from '@/components/layout/Layout';
import { ToastProvider } from '@/components/ui';
import {
  HistoricalDataDashboard,
  RealTimeDashboard,
} from '@/components/visualization';
import {
  AlertsPage,
  Dashboard,
  ExplorerPage,
  HealthPage,
  MountsPage,
  NotFoundPage,
  OnboardingPage,
  RulesPage,
  SearchPage,
  SettingsPage,
  VolumeDetailsPage,
  VolumesPage,
} from '@/pages';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import React, { useEffect, useState } from 'react';
import { Route, BrowserRouter as Router, Routes, Navigate } from 'react-router-dom';

const App: React.FC = () => {
  const [shouldRedirectToOnboarding, setShouldRedirectToOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if onboarding has been completed
    const checkOnboardingStatus = async () => {
      try {
        const onboardingComplete = localStorage.getItem('volumeviz_onboarding_complete');
        const onboardingAttempted = localStorage.getItem('volumeviz_onboarding_attempted');
        
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
  }, []);

  if (loading) {
    return (
      <div data-testid="app-loading" className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading VolumeViz...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="app-root">
      <ToastProvider>
        <WebSocketProvider>
          <ApiHealthChecker />
          <Router>
            <Layout>
              <Routes>
                {/* Onboarding Route */}
                <Route path="/onboarding" element={<OnboardingPage />} />
                
                {/* Main Routes - redirect to onboarding if needed */}
                <Route 
                  path="/" 
                  element={shouldRedirectToOnboarding ? <Navigate to="/onboarding" replace /> : <Dashboard />} 
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

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          </Router>
        </WebSocketProvider>
      </ToastProvider>
    </div>
  );
};

export default App;
