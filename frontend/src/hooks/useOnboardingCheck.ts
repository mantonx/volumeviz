import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface OnboardingStatus {
  shouldRedirect: boolean;
  isLoading: boolean;
  hasRules: boolean;
  onboardingComplete: boolean;
}

/**
 * Hook to check if user needs onboarding and redirect accordingly
 * Only redirects on first run when no tracking rules exist
 */
export function useOnboardingCheck(): OnboardingStatus {
  const [status, setStatus] = useState<OnboardingStatus>({
    shouldRedirect: false,
    isLoading: true,
    hasRules: false,
    onboardingComplete: false,
  });
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        // Skip check if already on onboarding page
        if (location.pathname === '/onboarding') {
          setStatus({
            shouldRedirect: false,
            isLoading: false,
            hasRules: false,
            onboardingComplete: false,
          });
          return;
        }

        // Check if onboarding was already completed
        const onboardingComplete = localStorage.getItem('volumeviz_onboarding_complete') === 'true';
        const onboardingAttempted = localStorage.getItem('volumeviz_onboarding_attempted') === 'true';

        if (onboardingComplete || onboardingAttempted) {
          setStatus({
            shouldRedirect: false,
            isLoading: false,
            hasRules: true,
            onboardingComplete: true,
          });
          return;
        }

        // Check if any tracking rules exist
        const response = await fetch('/api/v1/tracking/rules');
        if (!response.ok) {
          console.error('Failed to check tracking rules status');
          setStatus(prev => ({ ...prev, isLoading: false }));
          return;
        }

        const data = await response.json();
        const hasRules = data.total > 0;

        if (!hasRules) {
          // No rules exist, redirect to onboarding
          setStatus({
            shouldRedirect: true,
            isLoading: false,
            hasRules: false,
            onboardingComplete: false,
          });
          navigate('/onboarding', { replace: true });
        } else {
          // Rules exist, mark as having completed setup
          localStorage.setItem('volumeviz_onboarding_complete', 'true');
          setStatus({
            shouldRedirect: false,
            isLoading: false,
            hasRules: true,
            onboardingComplete: true,
          });
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setStatus(prev => ({ ...prev, isLoading: false }));
      }
    };

    checkOnboardingStatus();
  }, [location.pathname, navigate]);

  return status;
}

/**
 * Function to reset onboarding state and trigger re-run
 */
export function resetOnboarding(): void {
  localStorage.removeItem('volumeviz_onboarding_complete');
  localStorage.removeItem('volumeviz_onboarding_attempted');
  localStorage.removeItem('volumeviz_preset_used');
  localStorage.removeItem('volumeviz_onboarding_state');
}