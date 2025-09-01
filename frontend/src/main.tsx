import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from '@/providers/AppProvider';
import './index.css';

// MSW disabled for now to fix HMR stalling issues
// Start app immediately without MSW with new Jotai + TanStack Query providers
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
