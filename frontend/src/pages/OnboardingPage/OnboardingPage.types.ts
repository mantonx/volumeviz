/**
 * OnboardingPage Types
 * Type definitions for the onboarding wizard flow
 */

export interface MountDiscovery {
  totalMounts: number;
  volumeCount: number;
  bindCount: number;
  tmpfsCount: number;
  orphanedCount: number;
  composeProjects: { [project: string]: number };
  composeServices: { [service: string]: number };
}

export interface OnboardingPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  rules: OnboardingRule[];
}

export interface OnboardingRule {
  name: string;
  action: 'include' | 'exclude';
  priority: number;
  conditions: RuleCondition[];
}

export interface RuleCondition {
  field_name: string;
  operator: 'equals' | 'contains' | 'prefix' | 'suffix' | 'regex';
  value: string;
  is_case_sensitive: boolean;
}

export interface OnboardingState {
  currentStep: number;
  discovery: MountDiscovery | null;
  selectedPreset: string | null;
  customRules: OnboardingRule[];
  previewResults: PreviewResults | null;
  skippedSteps: number[];
}

export interface PreviewResults {
  summary: {
    totalMounts: number;
    mountsMatched: number;
    mountsIncluded: number;
    mountsExcluded: number;
    mountsUnmatched: number;
  };
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  optional?: boolean;
  validator?: (state: OnboardingState) => boolean;
}

export interface OnboardingPageProps {
  className?: string;
  onComplete?: (result: OnboardingCompletionResult) => void;
  onSkip?: () => void;
}

export interface OnboardingCompletionResult {
  preset: string;
  rulesCreated: number;
  mountsTracked: number;
  timeSpent: number;
}

export interface FeatureTourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}
