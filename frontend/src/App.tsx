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
  NotFoundPage,
  SearchPage,
  SettingsPage,
  VolumeDetailsPage,
  VolumesPage,
} from '@/pages';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import React from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

const App: React.FC = () => {
  return (
    <div data-testid="app-root">
      <ToastProvider>
        <WebSocketProvider>
          <ApiHealthChecker />
          <Router>
            <Layout>
              <Routes>
                {/* Main Routes */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/volumes" element={<VolumesPage />} />
                <Route path="/volumes/:name" element={<VolumeDetailsPage />} />

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
