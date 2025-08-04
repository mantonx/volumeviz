import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import {
  Dashboard,
  VolumesPage,
  ContainersPage,
  NetworksPage,
  MetricsPage,
  LogsPage,
  HealthPage,
  SecurityPage,
  SettingsPage,
  NotFoundPage,
} from '@/pages';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Main Routes */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/volumes" element={<VolumesPage />} />
          <Route path="/containers" element={<ContainersPage />} />
          <Route path="/networks" element={<NetworksPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/logs" element={<LogsPage />} />

          {/* System Routes */}
          <Route path="/health" element={<HealthPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
