import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Start MSW only when explicitly enabled
const enableMSW = async () => {
  const shouldUseMSW = import.meta.env.VITE_USE_MSW === 'true';

  if (shouldUseMSW && typeof window !== 'undefined') {
    try {
      const { startMSW } = await import('./mocks');
      return startMSW();
    } catch {
      console.warn('MSW not available in production build');
      return Promise.resolve();
    }
  }
};

enableMSW().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
