/**
 * Example integration of the new AppProvider with TanStack Query and Jotai
 *
 * To use this, rename your current main.tsx to main-backup.tsx
 * and rename this file to main.tsx
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from '@/providers/AppProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
