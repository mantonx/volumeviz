import { useAtomValue } from 'jotai';
import { Loader2, AlertCircle, Save, Building, Settings } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useOrganizationManagement } from '@/hooks/api/useOrganizationManagement';
import { organizationIdAtom } from '@/atoms/organization';

interface OrganizationSettingsProps {
  className?: string;
}

export function OrganizationSettings({ className = '' }: OrganizationSettingsProps) {
  const orgId = useAtomValue(organizationIdAtom);
  const { organization, updateOrganization, isLoading, error } = useOrganizationManagement();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    plan_type: 'basic' as 'basic' | 'premium' | 'enterprise',
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Sync form data with organization data
  useEffect(() => {
    if (organization) {
      const newFormData = {
        name: organization.name || '',
        description: organization.description || '',
        plan_type: organization.plan_type || 'basic',
      };
      setFormData(newFormData);
      setHasChanges(false);
    }
  }, [organization]);

  // Check for changes
  useEffect(() => {
    if (organization) {
      const hasChanged = 
        formData.name !== (organization.name || '') ||
        formData.description !== (organization.description || '') ||
        formData.plan_type !== (organization.plan_type || 'basic');
      setHasChanges(hasChanged);
    }
  }, [formData, organization]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasChanges) return;

    try {
      await updateOrganization.mutateAsync(formData);
      // Success is handled by the hook's onSuccess callback
    } catch (error) {
      console.error('Failed to update organization:', error);
    }
  };

  if (!orgId) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No organization selected</h3>
          <p className="mt-1 text-sm text-gray-500">
            Please select an organization to view settings.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && !organization) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-2 text-sm text-gray-500">Loading organization settings...</p>
        </div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load organization</h3>
          <p className="mt-1 text-sm text-gray-500">
            {error?.message || 'An error occurred while loading organization settings.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="ml-5">
            <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your organization's profile and preferences.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="plan_type" className="block text-sm font-medium text-gray-700">
                    Plan Type
                  </label>
                  <select
                    id="plan_type"
                    value={formData.plan_type}
                    onChange={(e) => handleInputChange('plan_type', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="A brief description of your organization..."
                />
              </div>
            </div>

            {/* Organization Info (Read-only) */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Organization Details</h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Organization ID
                  </label>
                  <div className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded-md">
                    {organization.id}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Created
                  </label>
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {new Date(organization.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      organization.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {organization.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Last Updated
                  </label>
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {new Date(organization.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!hasChanges || updateOrganization.isLoading}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  hasChanges && !updateOrganization.isLoading
                    ? 'text-white bg-blue-600 hover:bg-blue-700'
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                }`}
              >
                {updateOrganization.isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {updateOrganization.isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}