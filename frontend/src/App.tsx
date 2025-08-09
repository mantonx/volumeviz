import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ToastProvider } from '@/components/ui';
import {
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
    <ToastProvider>
      <Router>
        <Layout>
          <Routes>
            {/* Main Routes */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/volumes" element={<VolumesPage />} />
            <Route path="/volumes/:name" element={<VolumeDetailsPage />} />

            {/* Visualization Routes */}
            <Route path="/realtime" element={<RealTimeDashboard />} />
            <Route path="/historical" element={<HistoricalDataDashboard />} />

            {/* System Routes */}
            <Route path="/health" element={<HealthPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </Router>
    </ToastProvider>
  );
};

export default App;
