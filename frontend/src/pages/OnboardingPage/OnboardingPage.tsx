import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Layers,
  Server,
  Shield,
  Settings,
  Eye,
  Save,
} from 'lucide-react';
import type { InternalApiV1MountsMountCatalogResponse } from '@/api/orval-generated/api';

// Types for onboarding flow
interface MountDiscovery {
  totalMounts: number;
  volumeCount: number;
  bindCount: number;
  tmpfsCount: number;
  orphanedCount: number;
  composeProjects: { [project: string]: number };
  composeServices: { [service: string]: number };
}

interface OnboardingPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  rules: any[];
}

interface OnboardingState {
  currentStep: number;
  discovery: MountDiscovery | null;
  selectedPreset: string | null;
  customRules: any[];
  previewResults: any | null;
  // Real rule IDs created (via POST /api/v1/rules) so the Preview step can
  // evaluate them for real via POST /api/v1/tracking/preview - the preview
  // endpoint only evaluates already-persisted rules, it can't take ad-hoc
  // rule payloads inline. Cleaned up (DELETE) if the user goes back to
  // change preset; left alone and reused (not recreated) on Complete.
  createdRuleIds: number[] | null;
}

const STEPS = [
  {
    id: 'discover',
    title: 'Discover',
    description: 'Analyze your Docker mounts',
  },
  {
    id: 'preset',
    title: 'Choose Preset',
    description: 'Select tracking strategy',
  },
  { id: 'preview', title: 'Preview', description: 'Review and confirm' },
  { id: 'complete', title: 'Complete', description: 'Setup finished' },
];

const PRESETS: OnboardingPreset[] = [
  {
    id: 'server',
    name: 'Server Default',
    description:
      'Recommended for most server workloads. Includes Docker volumes, excludes backup services, home directories, and read-only mounts.',
    icon: Server,
    rules: [
      {
        name: 'Include Docker Volumes',
        action: 'include',
        priority: 100,
        conditions: [
          {
            field_name: 'source_type',
            operator: 'equals',
            value: 'volume',
            is_case_sensitive: false,
          },
        ],
      },
      {
        name: 'Exclude Backup Services',
        action: 'exclude',
        priority: 200,
        conditions: [
          {
            field_name: 'compose_service',
            operator: 'contains',
            value: 'backup',
            is_case_sensitive: false,
          },
        ],
      },
      {
        name: 'Exclude Home Directory Binds',
        action: 'exclude',
        priority: 300,
        conditions: [
          {
            field_name: 'source_type',
            operator: 'equals',
            value: 'bind',
            is_case_sensitive: false,
          },
          {
            field_name: 'host_path',
            operator: 'prefix',
            value: '/home/',
            is_case_sensitive: false,
          },
        ],
      },
      {
        name: 'Exclude Read-Only Mounts',
        action: 'exclude',
        priority: 400,
        conditions: [
          {
            field_name: 'read_only',
            operator: 'equals',
            value: 'true',
            is_case_sensitive: false,
          },
        ],
      },
    ],
  },
  {
    id: 'strict',
    name: 'Strict',
    description:
      'Track only Docker named volumes. Excludes all bind mounts and temporary filesystems.',
    icon: Shield,
    rules: [
      {
        name: 'Include Only Named Volumes',
        action: 'include',
        priority: 100,
        conditions: [
          {
            field_name: 'source_type',
            operator: 'equals',
            value: 'volume',
            is_case_sensitive: false,
          },
        ],
      },
      {
        name: 'Exclude All Bind Mounts',
        action: 'exclude',
        priority: 200,
        conditions: [
          {
            field_name: 'source_type',
            operator: 'equals',
            value: 'bind',
            is_case_sensitive: false,
          },
        ],
      },
      {
        name: 'Exclude All Tmpfs Mounts',
        action: 'exclude',
        priority: 300,
        conditions: [
          {
            field_name: 'source_type',
            operator: 'equals',
            value: 'tmpfs',
            is_case_sensitive: false,
          },
        ],
      },
    ],
  },
  {
    id: 'custom',
    name: 'Custom',
    description:
      'Start with no rules and build your own tracking configuration.',
    icon: Settings,
    rules: [],
  },
];

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<OnboardingState>(() => {
    // Try to restore state from localStorage
    try {
      const savedState = localStorage.getItem('volumeviz_onboarding_state');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        // Only restore if onboarding is not already complete
        const isComplete = localStorage.getItem(
          'volumeviz_onboarding_complete',
        );
        if (isComplete !== 'true') {
          return {
            ...parsedState,
            // Don't restore discovery, preview results, or created rule IDs
            // as they may be stale (a reload loses the in-memory IDs but not
            // the server-side rows, so generating a fresh preview here would
            // create a second set of rules rather than reusing the first -
            // an accepted, low-consequence edge case, not a correctness bug)
            discovery: null,
            previewResults: null,
            createdRuleIds: null,
          };
        }
      }
    } catch (error) {
      console.error('Failed to restore onboarding state:', error);
    }

    // Default initial state
    return {
      currentStep: 0,
      discovery: null,
      selectedPreset: null,
      customRules: [],
      previewResults: null,
      createdRuleIds: null,
    };
  });
  const [loading, setLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Transform mount catalog data to discovery format
  const transformMountDataToDiscovery = (
    mounts: InternalApiV1MountsMountCatalogResponse[],
  ): MountDiscovery => {
    const discovery: MountDiscovery = {
      totalMounts: mounts.length,
      volumeCount: 0,
      bindCount: 0,
      tmpfsCount: 0,
      orphanedCount: 0,
      composeProjects: {},
      composeServices: {},
    };

    mounts.forEach((mount) => {
      // Count by mount type (not source_type)
      switch (mount.mount_type) {
        case 'volume':
          discovery.volumeCount++;
          break;
        case 'bind':
          discovery.bindCount++;
          break;
        case 'tmpfs':
          discovery.tmpfsCount++;
          break;
      }

      // Count orphaned mounts
      if (mount.is_orphaned) {
        discovery.orphanedCount++;
      }

      // Count compose projects
      if (mount.compose_project) {
        discovery.composeProjects[mount.compose_project] =
          (discovery.composeProjects[mount.compose_project] || 0) + 1;
      }

      // Count compose services
      if (mount.compose_services && mount.compose_services.length > 0) {
        mount.compose_services.forEach((service) => {
          discovery.composeServices[service] =
            (discovery.composeServices[service] || 0) + 1;
        });
      }
    });

    return discovery;
  };

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      const stateToSave = {
        currentStep: state.currentStep,
        selectedPreset: state.selectedPreset,
        customRules: state.customRules,
        // Don't save discovery or preview results as they should be fresh
      };
      localStorage.setItem(
        'volumeviz_onboarding_state',
        JSON.stringify(stateToSave),
      );
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  }, [state.currentStep, state.selectedPreset, state.customRules]);

  // Load discovery data on mount
  useEffect(() => {
    if (state.currentStep === 0 && !state.discovery) {
      setLoading(true);
      setDiscoveryError(null);

      const loadDiscoveryData = async () => {
        try {
          // First try to get existing mount data
          let response = await fetch('/api/v1/mounts');
          let data = await response.json();

          // If no mounts found, trigger discovery first
          if (!data.mounts || data.mounts.length === 0) {
            const discoveryResponse = await fetch('/api/v1/mounts/discover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ force: true }),
            });

            if (discoveryResponse.ok) {
              // Wait a moment for discovery to complete, then fetch again
              await new Promise((resolve) => setTimeout(resolve, 1000));
              response = await fetch('/api/v1/mounts');
              data = await response.json();
            }
          }

          const mounts = data.mounts || [];

          // Transform API response to discovery format. A genuinely empty
          // result (0 real mounts on this host) is honest, valid data —
          // shown as-is rather than papered over with fake numbers.
          const discovery = transformMountDataToDiscovery(mounts);
          setState((prev) => ({ ...prev, discovery }));
        } catch (error) {
          console.error('Failed to load mount discovery data:', error);
          setDiscoveryError(
            error instanceof Error
              ? error.message
              : 'Failed to load mount discovery data',
          );
        } finally {
          setLoading(false);
        }
      };

      loadDiscoveryData();
    }
  }, [state.currentStep, state.discovery]);

  const nextStep = () => {
    if (state.currentStep < STEPS.length - 1) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  // Deletes any rules generatePreview created for real, so going back to
  // change preset (or re-generating) doesn't leave duplicate/stale rule
  // rows behind. Best-effort - a delete failure here just means an unused
  // rule row remains (same accepted risk as the abandoned-tab-close case).
  const deleteCreatedRules = async (ruleIds: number[]) => {
    await Promise.allSettled(
      ruleIds.map((id) =>
        fetch(`/api/v1/rules/${id}`, { method: 'DELETE' }),
      ),
    );
  };

  const prevStep = () => {
    if (state.currentStep > 0) {
      if (state.currentStep === 2 && state.createdRuleIds) {
        deleteCreatedRules(state.createdRuleIds);
      }
      setState((prev) => ({
        ...prev,
        currentStep: prev.currentStep - 1,
        previewResults: null,
        createdRuleIds: null,
      }));
    }
  };

  const selectPreset = (presetId: string) => {
    if (state.createdRuleIds) {
      deleteCreatedRules(state.createdRuleIds);
    }
    setState((prev) => ({
      ...prev,
      selectedPreset: presetId,
      previewResults: null,
      createdRuleIds: null,
    }));
  };

  const generatePreview = async () => {
    if (!state.selectedPreset) return;

    setLoading(true);
    setPreviewError(null);

    try {
      const selectedPresetData = PRESETS.find(
        (p) => p.id === state.selectedPreset,
      );
      if (!selectedPresetData) {
        throw new Error('Selected preset not found');
      }

      // The preview endpoint treats an empty rule_ids list as "preview all
      // enabled rules system-wide", not "preview zero rules" - so a
      // zero-rule preset (Custom) must skip the API call entirely rather
      // than send [] and get back unrelated pre-existing rules' results.
      if (selectedPresetData.rules.length === 0) {
        setState((prev) => ({
          ...prev,
          createdRuleIds: [],
          previewResults: {
            summary: {
              totalMounts: state.discovery?.totalMounts ?? 0,
              mountsIncluded: 0,
              mountsExcluded: 0,
              mountsUnmatched: state.discovery?.totalMounts ?? 0,
            },
          },
        }));
        setLoading(false);
        return;
      }

      // POST /api/v1/tracking/preview evaluates already-persisted rule rows
      // by ID (it can't take ad-hoc rule payloads inline) — so create the
      // preset's rules for real first. dry_run below only controls whether
      // an evaluation log record is written; it never applies tracking
      // status, so this is safe to do before the user has confirmed anything.
      const createdRuleIds: number[] = [];
      for (const rule of selectedPresetData.rules) {
        const response = await fetch('/api/v1/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: rule.name,
            description: `Auto-generated from ${selectedPresetData.name} preset during onboarding`,
            action: rule.action,
            priority: rule.priority,
            is_enabled: true,
            conditions: rule.conditions,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to save rule "${rule.name}": ${response.status}`,
          );
        }

        const savedRule = await response.json();
        createdRuleIds.push(savedRule.id);
      }

      const previewResponse = await fetch('/api/v1/tracking/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_ids: createdRuleIds,
          include_rule_details: false,
          include_unmatched: true,
          dry_run: true,
        }),
      });

      if (!previewResponse.ok) {
        throw new Error(
          `Failed to preview tracking rules: ${previewResponse.status}`,
        );
      }

      const preview = await previewResponse.json();

      setState((prev) => ({
        ...prev,
        createdRuleIds,
        previewResults: {
          summary: {
            totalMounts: preview.summary?.total_mounts ?? 0,
            mountsIncluded: preview.summary?.mounts_included ?? 0,
            mountsExcluded: preview.summary?.mounts_excluded ?? 0,
            mountsUnmatched: preview.summary?.mounts_unmatched ?? 0,
          },
        },
      }));
    } catch (error) {
      console.error('Failed to generate preview:', error);
      // Leave previewResults unset on failure rather than fabricating
      // plausible-looking numbers — the Preview step already renders an
      // honest "no preview available" state when previewResults is null.
      setState((prev) => ({ ...prev, previewResults: null }));
      setPreviewError(
        error instanceof Error
          ? error.message
          : 'Failed to generate a tracking preview',
      );
    }

    setLoading(false);
  };

  const triggerDiscovery = async () => {
    setLoading(true);
    setDiscoveryError(null);

    try {
      // Trigger mount discovery
      const response = await fetch('/api/v1/mounts/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger discovery');
      }

      // Wait a moment then fetch updated mounts
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const mountsResponse = await fetch('/api/v1/mounts');
      const data = await mountsResponse.json();
      const mounts = data.mounts || [];

      // Transform to discovery format. A genuine zero-mounts result is
      // shown as-is via the existing "No Docker Mounts Discovered" panel
      // (state.discovery.totalMounts === 0) rather than swapped for fake
      // sample data — the panel already explains what that means and how
      // to retry.
      const discovery = transformMountDataToDiscovery(mounts);
      setState((prev) => ({ ...prev, discovery }));
    } catch (error) {
      console.error('Failed to trigger discovery:', error);
      setDiscoveryError(
        error instanceof Error ? error.message : 'Failed to discover mounts',
      );
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!state.selectedPreset) return;

    setLoading(true);

    try {
      // Get the rules for the selected preset
      const selectedPresetData = PRESETS.find(
        (p) => p.id === state.selectedPreset,
      );
      if (!selectedPresetData) {
        throw new Error('Selected preset not found');
      }

      // Rules were already created for real during the Preview step (see
      // generatePreview) so the preview and the applied result are
      // guaranteed to match. Only fall back to creating them here if the
      // user somehow reached Complete without generating a preview first
      // (canProceed already gates step 2 on previewResults existing, so
      // this is a defensive fallback, not the normal path).
      let createdRuleCount = state.createdRuleIds?.length ?? 0;
      if (state.createdRuleIds === null) {
        for (const rule of selectedPresetData.rules) {
          const response = await fetch('/api/v1/rules', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: rule.name,
              description: `Auto-generated from ${selectedPresetData.name} preset during onboarding`,
              action: rule.action,
              priority: rule.priority,
              is_enabled: true,
              conditions: rule.conditions,
            }),
          });

          if (!response.ok) {
            throw new Error(
              `Failed to save rule "${rule.name}": ${response.status}`,
            );
          }
        }
        createdRuleCount = selectedPresetData.rules.length;
      }

      // Apply the rules to update tracking status
      try {
        await fetch('/api/v1/tracking/apply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dry_run: false }),
        });
      } catch (applyError) {
        console.warn('Failed to apply rules automatically:', applyError);
        // Continue even if apply fails - user can apply rules manually
      }

      // Mark onboarding as complete in localStorage
      localStorage.setItem('volumeviz_onboarding_complete', 'true');
      localStorage.setItem('volumeviz_preset_used', state.selectedPreset);

      // Clean up onboarding state as it's no longer needed
      localStorage.removeItem('volumeviz_onboarding_state');

      // App.tsx's shouldRedirectToOnboarding is computed once at mount and
      // isn't re-derived on client-side navigation, so without this a
      // first-time user completing onboarding gets bounced straight back
      // into it by that stale value.
      window.dispatchEvent(new Event('volumeviz-onboarding-complete'));

      // The Dashboard's volumes query may have been fetched (and cached
      // for 5 minutes) before tracking/apply just changed is_tracked on
      // every volume — without this it shows stale/empty data right after
      // onboarding "completes".
      await queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/v1/mounts'] });

      // Navigate to dashboard with success state
      navigate('/', {
        state: {
          onboardingComplete: true,
          trackedCount: state.previewResults?.summary?.mountsIncluded || 0,
          rulesCreated: createdRuleCount,
          presetUsed: selectedPresetData.name,
        },
      });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);

      // Show error to user but still allow navigation
      const message = error instanceof Error ? error.message : String(error);
      alert(
        `Error saving rules: ${message}. You can configure rules manually from the Rules page.`,
      );

      // Mark as attempted completion even if failed
      localStorage.setItem('volumeviz_onboarding_attempted', 'true');
      window.dispatchEvent(new Event('volumeviz-onboarding-complete'));
      navigate('/');
    }

    setLoading(false);
  };

  const renderDiscoveryStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Layers className="mx-auto h-12 w-12 text-blue-600" />
        <h2 className="mt-4 text-2xl font-semibold text-primary">
          Discovering Your Docker Mounts
        </h2>
        <p className="mt-2 text-secondary">
          Let's analyze what you have running to recommend the best tracking
          strategy
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-secondary">
            Scanning Docker mounts...
          </p>
        </div>
      ) : state.discovery ? (
        <div className="space-y-6">
          {/* No Mounts Found Message */}
          {state.discovery.totalMounts === 0 && (
            <div className="text-center py-8">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <div className="flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  No Docker Mounts Discovered
                </h3>
                <p className="text-yellow-700 dark:text-yellow-300 mb-4">
                  VolumeViz couldn't find any Docker mounts on your system. This
                  could mean:
                </p>
                <ul className="text-left text-sm text-yellow-700 dark:text-yellow-300 space-y-1 mb-4 inline-block">
                  <li>• Docker is not running</li>
                  <li>• No containers with volumes are currently running</li>
                  <li>• VolumeViz doesn't have permission to access Docker</li>
                </ul>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                  Click "Refresh Discovery" below after starting some
                  containers with volumes mounted, or continue and set up
                  tracking rules now — they'll apply automatically once real
                  mounts appear.
                </p>
              </div>
            </div>
          )}

          {/* Mount Type Summary */}
          <div className="bg-surface rounded-lg p-6 shadow">
            <h3 className="text-lg font-medium text-primary mb-4">
              Mount Types Found
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {state.discovery.totalMounts}
                </div>
                <div className="text-sm text-secondary">
                  Total
                </div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {state.discovery.volumeCount}
                </div>
                <div className="text-sm text-secondary">
                  Volumes
                </div>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {state.discovery.bindCount}
                </div>
                <div className="text-sm text-secondary">
                  Bind Mounts
                </div>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {state.discovery.tmpfsCount}
                </div>
                <div className="text-sm text-secondary">
                  Tmpfs
                </div>
              </div>
            </div>
            {state.discovery.orphanedCount > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {state.discovery.orphanedCount} of these aren't attached to a
                  running container right now — that's normal for data
                  volumes between restarts, not necessarily a problem. You can
                  still track them; VolumeViz will pick them back up when a
                  container reattaches.
                </p>
              </div>
            )}

            {/* Refresh Discovery Button */}
            <div className="mt-4 text-center">
              <button
                onClick={triggerDiscovery}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-line rounded-md shadow-sm text-sm font-medium text-secondary bg-surface hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Discovering...
                  </>
                ) : (
                  <>
                    <Server className="h-4 w-4 mr-2" />
                    Refresh Discovery
                  </>
                )}
              </button>
              <p className="mt-2 text-xs text-tertiary">
                Re-scan for Docker mounts if data looks incomplete
              </p>
            </div>
          </div>

          {/* Compose Projects */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-surface rounded-lg p-6 shadow">
              <h3 className="text-lg font-medium text-primary mb-4">
                Compose Projects
              </h3>
              <div className="space-y-2">
                {Object.keys(state.discovery.composeProjects).length === 0 ? (
                  <p className="text-sm text-tertiary">
                    No Docker Compose projects detected among these mounts.
                  </p>
                ) : (
                  Object.entries(state.discovery.composeProjects).map(
                    ([project, count]) => (
                      <div
                        key={project}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm text-secondary">
                          {project}
                        </span>
                        <span className="px-2 py-1 bg-surface-secondary rounded text-sm">
                          {count}
                        </span>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>

            <div className="bg-surface rounded-lg p-6 shadow">
              <h3 className="text-lg font-medium text-primary mb-4">
                Top Services
              </h3>
              <div className="space-y-2">
                {Object.keys(state.discovery.composeServices).length === 0 ? (
                  <p className="text-sm text-tertiary">
                    No Docker Compose services detected among these mounts.
                  </p>
                ) : (
                  Object.entries(state.discovery.composeServices)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([service, count]) => (
                      <div
                        key={service}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm text-secondary">
                          {service}
                        </span>
                        <span className="px-2 py-1 bg-surface-secondary rounded text-sm">
                          {count}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
              Couldn't Load Mount Discovery
            </h3>
            <p className="text-red-700 dark:text-red-300 text-sm mb-4">
              {discoveryError || 'Something went wrong while discovering Docker mounts.'}
            </p>
            <button
              onClick={triggerDiscovery}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderPresetStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Settings className="mx-auto h-12 w-12 text-blue-600" />
        <h2 className="mt-4 text-2xl font-semibold text-primary">
          Choose Your Tracking Strategy
        </h2>
        <p className="mt-2 text-secondary">
          A preset is a small set of rules — each one says "include" or
          "exclude" mounts matching some condition. Pick one below, or start
          from scratch with Custom.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PRESETS.map((preset) => (
          <div
            key={preset.id}
            className={`relative rounded-lg border-2 p-6 cursor-pointer transition-all ${
              state.selectedPreset === preset.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-line hover:border-gray-300 hover:border-line'
            }`}
            onClick={() => selectPreset(preset.id)}
          >
            {state.selectedPreset === preset.id && (
              <div className="absolute top-4 right-4">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            )}

            <div className="flex flex-col items-center text-center">
              <div
                className={`p-3 rounded-lg ${
                  state.selectedPreset === preset.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-secondary text-secondary'
                }`}
              >
                <preset.icon className="h-8 w-8" />
              </div>

              <h3 className="mt-4 text-lg font-medium text-primary">
                {preset.name}
              </h3>

              <p className="mt-2 text-sm text-secondary">
                {preset.description}
              </p>

              <div className="mt-4 text-xs text-gray-500 text-tertiary">
                {preset.rules.length} rule{preset.rules.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Eye className="mx-auto h-12 w-12 text-blue-600" />
        <h2 className="mt-4 text-2xl font-semibold text-primary">
          Preview Your Configuration
        </h2>
        <p className="mt-2 text-secondary">
          Review what will be tracked with your selected preset
        </p>
      </div>

      {!state.previewResults ? (
        <div className="text-center py-8">
          {previewError && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">
              {previewError} — you can try again below.
            </p>
          )}
          <button
            onClick={generatePreview}
            disabled={loading || !state.selectedPreset}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating Preview...
              </>
            ) : (
              <>
                <Eye className="h-5 w-5 mr-2" />
                Generate Preview
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Preview Summary */}
          <div className="bg-surface rounded-lg p-6 shadow">
            <h3 className="text-lg font-medium text-primary">
              Tracking Results
            </h3>
            <p className="text-sm text-tertiary mb-4">
              These numbers come from actually running the rules below against
              your real discovered mounts — this is exactly what happens when
              you finish setup.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {state.previewResults.summary.mountsIncluded}
                </div>
                <div className="text-sm text-secondary">
                  Will Track
                </div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {state.previewResults.summary.mountsExcluded}
                </div>
                <div className="text-sm text-secondary">
                  Excluded
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 bg-surface/20 rounded-lg">
                <div className="text-2xl font-bold text-secondary">
                  {state.previewResults.summary.mountsUnmatched}
                </div>
                <div className="text-sm text-secondary">
                  No Rules
                </div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {state.previewResults.summary.totalMounts}
                </div>
                <div className="text-sm text-secondary">
                  Total
                </div>
              </div>
            </div>
          </div>

          {/* Selected Preset Info */}
          {state.selectedPreset && (
            <div className="bg-surface rounded-lg p-6 shadow">
              <h3 className="text-lg font-medium text-primary mb-4">
                Selected Preset:{' '}
                {PRESETS.find((p) => p.id === state.selectedPreset)?.name}
              </h3>
              <div className="space-y-3">
                {PRESETS.find((p) => p.id === state.selectedPreset)?.rules.map(
                  (rule, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 bg-surface-secondary rounded"
                    >
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          rule.action === 'include'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {rule.action.toUpperCase()}
                      </div>
                      <span className="text-sm text-primary">
                        {rule.name}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
      <div>
        <h2 className="text-2xl font-semibold text-primary">
          Setup Complete!
        </h2>
        <p className="mt-2 text-secondary">
          Your tracking rules have been configured successfully
        </p>
      </div>

      <div className="bg-surface rounded-lg p-6 shadow max-w-md mx-auto">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {state.previewResults?.summary?.mountsIncluded || 0}
          </div>
          <div className="text-sm text-secondary">
            Mounts will be tracked
          </div>
        </div>
      </div>

      <button
        onClick={completeOnboarding}
        disabled={loading}
        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Saving Configuration...
          </>
        ) : (
          <>
            <Save className="h-5 w-5 mr-2" />
            Go to Dashboard
          </>
        )}
      </button>
    </div>
  );

  const currentStepData = STEPS[state.currentStep];
  const canProceed = (() => {
    switch (state.currentStep) {
      case 0:
        return !!state.discovery;
      case 1:
        return !!state.selectedPreset;
      case 2:
        return !!state.previewResults;
      default:
        return true;
    }
  })();

  return (
    <div className="min-h-screen bg-gray-50 bg-surface">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    index <= state.currentStep
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-line text-gray-400'
                  }`}
                >
                  {index < state.currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-16 h-0.5 ml-4 ${
                      index < state.currentStep
                        ? 'bg-blue-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <h1 className="text-xl font-medium text-primary">
              {currentStepData.title}
            </h1>
            <p className="text-sm text-tertiary">
              {currentStepData.description}
            </p>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-surface rounded-lg shadow-sm p-8 mb-8">
          {state.currentStep === 0 && renderDiscoveryStep()}
          {state.currentStep === 1 && renderPresetStep()}
          {state.currentStep === 2 && renderPreviewStep()}
          {state.currentStep === 3 && renderCompleteStep()}
        </div>

        {/* Navigation */}
        {state.currentStep < 3 && (
          <div className="flex justify-between">
            <button
              onClick={prevStep}
              disabled={state.currentStep === 0}
              className="inline-flex items-center px-4 py-2 border border-line rounded-md shadow-sm text-sm font-medium text-secondary bg-surface hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </button>

            <button
              onClick={nextStep}
              disabled={!canProceed || loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
