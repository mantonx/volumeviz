import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Download,
  Trash2,
  Settings,
  Database,
  Activity,
  Loader2,
} from 'lucide-react';

import { Toast, ToastProvider, useToast } from './';
import { Button } from '../Button';
import type { ToastProps, ToastVariant, ToastPosition, ToastSize } from './Toast.types';

const meta: Meta<typeof Toast> = {
  title: 'UI/Toast',
  component: Toast,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A comprehensive toast notification component with multiple variants, positioning, animations, and advanced features for scan monitoring systems.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['info', 'success', 'warning', 'error'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    position: {
      control: 'radio',
      options: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'],
    },
    persistent: {
      control: 'boolean',
    },
    dismissible: {
      control: 'boolean',
    },
    animate: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Toast>;

// Helper component for stories
const ToastDemo = ({ 
  children, 
  buttonText = 'Show Toast',
  ...toastProps 
}: { 
  children?: React.ReactNode;
  buttonText?: string;
} & Partial<ToastProps>) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleShow = () => setIsVisible(true);
  const handleDismiss = () => {
    setIsVisible(false);
    action('onDismiss')();
  };

  return (
    <>
      <Button onClick={handleShow}>{buttonText}</Button>
      {isVisible && (
        <div className="mt-4">
          <Toast
            {...toastProps}
            isVisible={isVisible}
            onDismiss={handleDismiss}
            onAction={action('onAction')}
          />
        </div>
      )}
    </>
  );
};

// Toast Provider demo component
const ToastProviderDemo = ({ position = 'top-right' }: { position?: ToastPosition }) => {
  const toast = useToast();

  const showToasts = () => {
    toast.info('Scan started for volume /Users/Documents');
    
    setTimeout(() => {
      toast.success('Volume scan completed successfully', {
        title: 'Scan Complete',
        action: {
          label: 'View Results',
          onClick: () => action('View Results')(),
        },
      });
    }, 1000);

    setTimeout(() => {
      toast.warning('Some files were skipped due to permissions', {
        title: 'Scan Warning',
      });
    }, 2000);
  };

  const showError = () => {
    toast.error('Failed to connect to volume scanner service', {
      title: 'Connection Error',
      persistent: true,
      action: {
        label: 'Retry',
        onClick: () => action('Retry')(),
      },
    });
  };

  const showLoading = () => {
    toast.loading('Indexing filesystem...');
  };

  const testPromise = () => {
    const mockScan = new Promise((resolve, reject) => {
      setTimeout(() => {
        Math.random() > 0.5 ? resolve({ files: 1247 }) : reject(new Error('Scan failed'));
      }, 2000);
    });

    toast.promise(
      mockScan,
      {
        loading: 'Scanning volume...',
        success: (data: any) => `Scan completed! Found ${data.files} files`,
        error: (err: Error) => `Scan failed: ${err.message}`,
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={showToasts}>Show Sequence</Button>
        <Button onClick={showError} variant="destructive">Show Error</Button>
        <Button onClick={showLoading}>Show Loading</Button>
        <Button onClick={testPromise}>Test Promise</Button>
        <Button onClick={() => toast.clearAllToasts()} variant="outline">Clear All</Button>
      </div>
      <p className="text-sm text-gray-600">
        Toasts will appear in the {position} corner
      </p>
    </div>
  );
};

// Default story
export const Default: Story = {
  render: () => (
    <ToastDemo
      variant="info"
      message="This is a default toast notification"
      title="Information"
    />
  ),
};

// Different variants
export const Variants: Story = {
  render: () => (
    <div className="space-y-4">
      <ToastDemo
        buttonText="Info Toast"
        variant="info"
        message="Volume scan has been queued for processing"
        title="Scan Queued"
      />
      
      <ToastDemo
        buttonText="Success Toast"
        variant="success"
        message="Volume scan completed successfully. Found 1,247 files."
        title="Scan Complete"
      />
      
      <ToastDemo
        buttonText="Warning Toast"
        variant="warning"
        message="Some files were skipped due to insufficient permissions"
        title="Partial Scan"
      />
      
      <ToastDemo
        buttonText="Error Toast"
        variant="error"
        message="Failed to connect to the volume scanner service"
        title="Connection Error"
      />
    </div>
  ),
};

// Different sizes
export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <ToastDemo
        buttonText="Small Toast"
        size="sm"
        variant="info"
        message="Small notification"
        title="Small"
      />
      
      <ToastDemo
        buttonText="Medium Toast"
        size="md"
        variant="success"
        message="Medium notification with more content space"
        title="Medium"
      />
      
      <ToastDemo
        buttonText="Large Toast"
        size="lg"
        variant="warning"
        message="Large notification with plenty of space for detailed information about the scan progress"
        title="Large"
      />
    </div>
  ),
};

// With actions
export const WithActions: Story = {
  render: () => (
    <div className="space-y-4">
      <ToastDemo
        buttonText="Toast with Action"
        variant="success"
        message="Volume scan completed. Click to view results."
        title="Scan Complete"
        action={{
          label: 'View Results',
          onClick: () => action('View Results')(),
        }}
      />
      
      <ToastDemo
        buttonText="Error with Retry"
        variant="error"
        message="Scan failed due to network error"
        title="Scan Failed"
        action={{
          label: 'Retry',
          onClick: () => action('Retry Scan')(),
        }}
      />
    </div>
  ),
};

// Custom icons
export const CustomIcons: Story = {
  render: () => (
    <div className="space-y-4">
      <ToastDemo
        buttonText="Database Icon"
        variant="info"
        message="Database indexing in progress"
        title="Indexing"
        icon={<Database className="w-5 h-5" />}
      />
      
      <ToastDemo
        buttonText="Activity Icon"
        variant="success"
        message="Real-time monitoring active"
        title="Monitoring"
        icon={<Activity className="w-5 h-5" />}
      />
      
      <ToastDemo
        buttonText="Loading Icon"
        variant="warning"
        message="Processing scan results..."
        title="Processing"
        icon={<Loader2 className="w-5 h-5 animate-spin" />}
      />
      
      <ToastDemo
        buttonText="No Icon"
        variant="error"
        message="This toast has no icon"
        title="No Icon"
        icon={null}
      />
    </div>
  ),
};

// Persistent toasts
export const Persistent: Story = {
  render: () => (
    <div className="space-y-4">
      <ToastDemo
        buttonText="Persistent Toast"
        variant="info"
        message="This toast will not auto-dismiss"
        title="Persistent"
        persistent
      />
      
      <ToastDemo
        buttonText="Non-dismissible"
        variant="warning"
        message="This toast cannot be manually dismissed"
        title="Loading..."
        persistent
        dismissible={false}
      />
    </div>
  ),
};

// Toast Provider examples
export const ToastProvider: Story = {
  render: () => (
    <ToastProvider defaultPosition="top-right" maxToasts={3}>
      <ToastProviderDemo />
    </ToastProvider>
  ),
};

// Different positions
export const Positions: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      {(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as ToastPosition[]).map(position => (
        <ToastProvider key={position} defaultPosition={position} maxToasts={2}>
          <div className="p-4 border rounded">
            <h3 className="font-medium mb-2 capitalize">{position.replace('-', ' ')}</h3>
            <ToastProviderDemo position={position} />
          </div>
        </ToastProvider>
      ))}
    </div>
  ),
};

// Scan monitoring example
export const ScanMonitoring: Story = {
  render: () => (
    <ToastProvider defaultPosition="bottom-right" maxToasts={5}>
      <ScanMonitoringDemo />
    </ToastProvider>
  ),
};

const ScanMonitoringDemo = () => {
  const toast = useToast();
  const [scanId, setScanId] = useState<string | null>(null);

  const startScan = () => {
    const id = toast.showToast({
      variant: 'info',
      title: 'Scan Started',
      message: 'Volume scan initiated for /Users/Documents',
      persistent: true,
      dismissible: false,
      icon: <Activity className="w-5 h-5" />,
    });
    setScanId(id);

    // Simulate scan progress
    setTimeout(() => {
      toast.updateToast(id, {
        message: 'Filesystem indexing in progress... (45%)',
        icon: <Database className="w-5 h-5" />,
      });
    }, 1000);

    setTimeout(() => {
      toast.updateToast(id, {
        message: 'Media enrichment phase... (78%)',
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
      });
    }, 2000);

    setTimeout(() => {
      toast.hideToast(id);
      toast.success('Scan completed successfully!', {
        title: 'Scan Complete',
        message: 'Found 1,247 files in 2.1 GB',
        action: {
          label: 'View Results',
          onClick: () => action('View Results')(),
        },
      });
      setScanId(null);
    }, 3000);
  };

  const cancelScan = () => {
    if (scanId) {
      toast.hideToast(scanId);
      toast.warning('Scan cancelled by user', {
        title: 'Scan Cancelled',
      });
      setScanId(null);
    }
  };

  const showError = () => {
    toast.error('Unable to access volume due to permission denied', {
      title: 'Access Error',
      action: {
        label: 'Check Permissions',
        onClick: () => action('Check Permissions')(),
      },
    });
  };

  const showMultiple = () => {
    toast.info('Preparing scan environment...');
    
    setTimeout(() => {
      toast.warning('Large volume detected - scan may take longer', {
        title: 'Performance Warning',
      });
    }, 500);

    setTimeout(() => {
      toast.success('Scan environment ready', {
        title: 'Ready',
      });
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={startScan} disabled={!!scanId}>
          {scanId ? 'Scanning...' : 'Start Scan'}
        </Button>
        <Button onClick={cancelScan} variant="outline" disabled={!scanId}>
          Cancel Scan
        </Button>
        <Button onClick={showError} variant="destructive">
          Simulate Error
        </Button>
        <Button onClick={showMultiple}>
          Show Multiple
        </Button>
        <Button onClick={() => toast.clearAllToasts()} variant="outline">
          Clear All
        </Button>
      </div>
      
      <div className="bg-gray-50 p-4 rounded text-sm">
        <h4 className="font-medium mb-2">Scan Monitoring Features:</h4>
        <ul className="space-y-1 text-gray-600">
          <li>• Real-time scan progress updates</li>
          <li>• Persistent notifications for long-running operations</li>
          <li>• Error handling with retry actions</li>
          <li>• Multiple notification queuing</li>
          <li>• Dynamic content updates</li>
        </ul>
      </div>
    </div>
  );
};

// Interactive playground
export const Interactive: Story = {
  render: () => {
    const [config, setConfig] = useState({
      variant: 'info' as ToastVariant,
      size: 'md' as ToastSize,
      position: 'top-right' as ToastPosition,
      persistent: false,
      dismissible: true,
      hasAction: false,
      hasIcon: true,
      title: 'Toast Title',
      message: 'This is a customizable toast message',
    });

    return (
      <ToastProvider defaultPosition={config.position} maxToasts={3}>
        <div className="space-y-6">
          {/* Controls */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
            <div>
              <label className="block text-sm font-medium mb-1">Variant</label>
              <select
                value={config.variant}
                onChange={(e) => setConfig(prev => ({ ...prev, variant: e.target.value as ToastVariant }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Size</label>
              <select
                value={config.size}
                onChange={(e) => setConfig(prev => ({ ...prev, size: e.target.value as ToastSize }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <select
                value={config.position}
                onChange={(e) => setConfig(prev => ({ ...prev, position: e.target.value as ToastPosition }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.persistent}
                  onChange={(e) => setConfig(prev => ({ ...prev, persistent: e.target.checked }))}
                  className="mr-2"
                />
                Persistent
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.dismissible}
                  onChange={(e) => setConfig(prev => ({ ...prev, dismissible: e.target.checked }))}
                  className="mr-2"
                />
                Dismissible
              </label>
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.hasAction}
                  onChange={(e) => setConfig(prev => ({ ...prev, hasAction: e.target.checked }))}
                  className="mr-2"
                />
                Action Button
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.hasIcon}
                  onChange={(e) => setConfig(prev => ({ ...prev, hasIcon: e.target.checked }))}
                  className="mr-2"
                />
                Show Icon
              </label>
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea
                value={config.message}
                onChange={(e) => setConfig(prev => ({ ...prev, message: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                rows={2}
              />
            </div>
          </div>

          {/* Demo */}
          <InteractiveToastDemo config={config} />
        </div>
      </ToastProvider>
    );
  },
};

const InteractiveToastDemo = ({ config }: { config: any }) => {
  const toast = useToast();

  const showCustomToast = () => {
    toast.showToast({
      variant: config.variant,
      title: config.title,
      message: config.message,
      persistent: config.persistent,
      dismissible: config.dismissible,
      icon: config.hasIcon ? undefined : null,
      action: config.hasAction ? {
        label: 'Action',
        onClick: () => action('Custom Action')(),
      } : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Button onClick={showCustomToast}>Show Custom Toast</Button>
      <Button onClick={() => toast.clearAllToasts()} variant="outline">Clear All</Button>
      
      <div className="text-sm text-gray-600">
        <p>Toast will appear in the <strong>{config.position}</strong> position</p>
        <p>Configured as: {config.variant} • {config.size} • {config.persistent ? 'persistent' : 'auto-dismiss'}</p>
      </div>
    </div>
  );
};