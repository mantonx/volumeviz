import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Start MSW in development/testing
const enableMSW = async () => {
  const shouldUseMSW =
    import.meta.env.VITE_USE_MSW === 'true' ||
    import.meta.env.MODE === 'development';

  if (shouldUseMSW && typeof window !== 'undefined') {
    const { startMSW } = await import('./mocks');
    return startMSW();
  }
};

enableMSW().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
