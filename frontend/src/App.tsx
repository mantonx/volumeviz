import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ToastProvider } from '@/components/ui';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import {
  AlertsPage,
  Dashboard,
  VolumesPage,
  VolumeDetailsPage,
  HealthPage,
  SettingsPage,
  NotFoundPage,
} from '@/pages';
import {
  RealTimeDashboard,
  HistoricalDataDashboard,
} from '@/components/visualization';

const App: React.FC = () => {
  return (
    <div data-testid="app-root">
      <ToastProvider>
        <WebSocketProvider>
          <Router>
            <Layout>
              <Routes>
                {/* Main Routes */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/volumes" element={<VolumesPage />} />
                <Route path="/volumes/:name" element={<VolumeDetailsPage />} />

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
