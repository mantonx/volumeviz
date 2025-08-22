import React, { useState, useEffect } from 'react';
import { Shield, Plus, Play } from 'lucide-react';
import type {
  InternalApiV1RulesRuleResponse as Rule,
  InternalApiV1RulesConditionRequest as Condition,
  InternalApiV1RulesTrackingRulesConfigResponse as TrackingRulesConfig,
  GithubComMantonxVolumevizInternalServicesRulesPreviewResponse as PreviewResponse,
  GithubComMantonxVolumevizInternalServicesRulesPreviewSummary as PreviewSummary,
} from '../../api/generated/Api';

const RulesPage: React.FC = () => {
  const [config, setConfig] = useState<TrackingRulesConfig | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedRule, setDraggedRule] = useState<Rule | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/tracking/rules');
      if (!response.ok) throw new Error('Failed to fetch rules configuration');
      const data = await response.json();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  };

  const previewRules = async () => {
    try {
      setPreviewLoading(true);
      const response = await fetch('/api/v1/tracking/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_rule_details: true,
          include_unmatched: false,
          dry_run: true
        }),
      });
      if (!response.ok) throw new Error('Failed to preview rules');
      const data = await response.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview rules');
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateRulesConfig = async (rules: Rule[]) => {
    try {
      // Reassign priorities based on order
      const updatedRules = rules.map((rule, index) => ({
        id: rule.id!,
        priority: (index + 1) * 10, // 10, 20, 30, etc.
        is_enabled: rule.is_enabled || false,
      }));

      const response = await fetch('/api/v1/tracking/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updatedRules }),
      });

      if (!response.ok) throw new Error('Failed to update rules configuration');
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rules');
    }
  };

  const toggleRuleEnabled = async (ruleId: number, enabled: boolean) => {
    if (!config) return;
    
    const updatedRules = config.rules?.map(rule => 
      rule.id === ruleId ? { ...rule, is_enabled: enabled } : rule
    ) || [];
    
    await updateRulesConfig(updatedRules);
  };

  const reorderRules = (fromIndex: number, toIndex: number) => {
    if (!config || !config.rules) return;
    
    const newRules = [...config.rules];
    const [moved] = newRules.splice(fromIndex, 1);
    newRules.splice(toIndex, 0, moved);
    
    updateRulesConfig(newRules);
  };

  const applyRules = async () => {
    try {
      const response = await fetch('/api/v1/tracking/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: false }),
      });

      if (!response.ok) throw new Error('Failed to apply rules');
      
      // Refresh data after applying
      await fetchConfig();
      await previewRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply rules');
    }
  };

  useEffect(() => {
    fetchConfig();
    previewRules();
  }, []);

  const handleDragStart = (e: React.DragEvent, rule: Rule, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    setDraggedRule(rule);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIndex !== toIndex) {
      reorderRules(fromIndex, toIndex);
    }
    setDraggedRule(null);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'include': return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/50 dark:border-green-700';
      case 'exclude': return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/50 dark:border-red-700';
      default: return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:border-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-700 dark:text-gray-300">Loading rules configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Tracking Rules
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure which mounts to track using ordered rules
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={previewRules}
            disabled={previewLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Play className="h-4 w-4 mr-2" />
            {previewLoading ? 'Previewing...' : 'Preview'}
          </button>
          <button
            onClick={applyRules}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Apply Rules
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      {config && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Shield className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Total Rules
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {config.total || 0}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Enabled Rules
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {config.enabled || 0}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Plus className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Include Rules
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {config.rules?.filter(r => r.action === 'include').length || 0}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Exclude Rules
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {config.rules?.filter(r => r.action === 'exclude').length || 0}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Summary */}
      {preview && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Preview Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{preview.summary?.total_mounts || 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Mounts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{preview.summary?.mounts_included || 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Will Include</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{preview.summary?.mounts_excluded || 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Will Exclude</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{preview.summary?.mounts_unmatched || 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Unmatched</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{preview.execution_time_ms || 0}ms</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Execution Time</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Rules (Ordered by Priority)</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Drag to reorder • Higher rules take precedence</p>
        </div>
        
        {config && config.rules && config.rules.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {config.rules.map((rule, index) => (
              <div
                key={rule.id}
                draggable
                onDragStart={(e) => handleDragStart(e, rule, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={`p-6 cursor-move hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  draggedRule?.id === rule.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <span className="text-2xl text-gray-400">⋮⋮</span>
                      <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{rule.name}</h3>
                      {rule.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{rule.description}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded border ${getActionColor(rule.action || '')}`}>
                          {(rule.action || '').toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Priority: {rule.priority || 0}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Matches: {rule.match_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={rule.is_enabled || false}
                        onChange={(e) => toggleRuleEnabled(rule.id!, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enabled</span>
                    </label>
                  </div>
                </div>
                
                {/* Conditions */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conditions:</h4>
                  <div className="flex flex-wrap gap-2">
                    {rule.conditions?.map((condition, condIndex) => (
                      <span
                        key={condIndex}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {condition.field_name} {condition.operator} {condition.value || condition.values?.join(', ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p>No tracking rules configured</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Create First Rule
            </button>
          </div>
        )}
      </div>

      {/* Create Rule Form Placeholder */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Create New Rule</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Rule creation form would go here...</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RulesPage;