import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';
import {
  Settings,
  User,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info,
  Activity,
  Database,
} from 'lucide-react';

import { Modal } from './Modal';
import { Button } from '../Button';
import type { ModalProps } from './Modal.types';

const meta: Meta<typeof Modal> = {
  title: 'UI/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A versatile modal and drawer component with comprehensive features including focus trapping, animations, and accessibility.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['modal', 'drawer'],
    },
    size: {
      control: 'radio',
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'top', 'bottom'],
    },
    animation: {
      control: 'radio',
      options: ['fade', 'slide', 'scale', 'none'],
    },
    closable: {
      control: 'boolean',
    },
    closeOnEscape: {
      control: 'boolean',
    },
    closeOnOutsideClick: {
      control: 'boolean',
    },
    preventBodyScroll: {
      control: 'boolean',
    },
    scrollable: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

// Helper component for stories
const ModalTrigger = ({
  children,
  buttonText = 'Open Modal',
  ...modalProps
}: {
  children: React.ReactNode;
  buttonText?: string;
} & Omit<ModalProps, 'open' | 'onClose' | 'children'>) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>{buttonText}</Button>
      <Modal {...modalProps} open={isOpen} onClose={() => setIsOpen(false)}>
        {children}
      </Modal>
    </>
  );
};

// Default story
export const Default: Story = {
  render: () => (
    <ModalTrigger
      header={{
        title: 'Default Modal',
        subtitle: 'This is a basic modal example',
      }}
      footer={{
        primaryAction: <Button variant="primary">Save</Button>,
        secondaryAction: <Button variant="outline">Cancel</Button>,
      }}
    >
      <div className="space-y-4">
        <p>
          This is the modal content. It can contain any React components or HTML
          elements.
        </p>
        <p>
          The modal includes focus trapping, keyboard navigation, and
          accessibility features.
        </p>
      </div>
    </ModalTrigger>
  ),
};

// Different sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ModalTrigger
        buttonText="Extra Small"
        size="xs"
        header={{ title: 'Extra Small Modal' }}
      >
        <p>This is an extra small modal.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Small"
        size="sm"
        header={{ title: 'Small Modal' }}
      >
        <p>This is a small modal with more content space.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Medium"
        size="md"
        header={{ title: 'Medium Modal' }}
      >
        <div className="space-y-4">
          <p>
            This is a medium modal that provides a good balance between content
            space and screen usage.
          </p>
          <p>Perfect for most use cases like forms and detailed information.</p>
        </div>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Large"
        size="lg"
        header={{ title: 'Large Modal' }}
      >
        <div className="space-y-4">
          <p>This is a large modal suitable for complex content.</p>
          <p>
            It provides more space for detailed forms, tables, or rich content.
          </p>
          <p>
            Use this size when you need to display substantial amounts of
            information.
          </p>
        </div>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Full Screen"
        size="full"
        header={{ title: 'Full Screen Modal' }}
      >
        <div className="space-y-4">
          <p>This is a full screen modal that takes up the entire viewport.</p>
          <p>
            Perfect for immersive experiences or when you need maximum space.
          </p>
          <p>
            Often used for detailed workflows, complex forms, or media viewers.
          </p>
        </div>
      </ModalTrigger>
    </div>
  ),
};

// Drawer variants
export const Drawers: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ModalTrigger
        buttonText="Left Drawer"
        variant="drawer"
        position="left"
        size="sm"
        header={{ title: 'Left Drawer' }}
      >
        <div className="space-y-4">
          <p>This is a left-positioned drawer.</p>
          <p>Great for navigation menus or side panels.</p>
        </div>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Right Drawer"
        variant="drawer"
        position="right"
        size="md"
        header={{ title: 'Right Drawer' }}
      >
        <div className="space-y-4">
          <p>This is a right-positioned drawer.</p>
          <p>Perfect for settings panels or additional information.</p>
        </div>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Top Drawer"
        variant="drawer"
        position="top"
        size="sm"
        header={{ title: 'Top Drawer' }}
      >
        <p>
          This is a top-positioned drawer, useful for notifications or quick
          actions.
        </p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Bottom Drawer"
        variant="drawer"
        position="bottom"
        size="lg"
        header={{ title: 'Bottom Drawer' }}
      >
        <div className="space-y-4">
          <p>This is a bottom-positioned drawer.</p>
          <p>
            Commonly used on mobile devices for action sheets or additional
            content.
          </p>
        </div>
      </ModalTrigger>
    </div>
  ),
};

// Different animations
export const Animations: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ModalTrigger
        buttonText="Fade Animation"
        animation="fade"
        header={{ title: 'Fade Animation' }}
      >
        <p>This modal uses a fade animation effect.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Slide Animation"
        animation="slide"
        header={{ title: 'Slide Animation' }}
      >
        <p>This modal uses a slide animation effect.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Scale Animation"
        animation="scale"
        header={{ title: 'Scale Animation' }}
      >
        <p>This modal uses a scale animation effect.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="No Animation"
        animation="none"
        header={{ title: 'No Animation' }}
      >
        <p>This modal appears instantly without animation.</p>
      </ModalTrigger>
    </div>
  ),
};

// Header configurations
export const HeaderVariations: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ModalTrigger
        buttonText="Basic Header"
        header={{
          title: 'Basic Header',
          subtitle: 'Simple title and subtitle',
        }}
      >
        <p>Modal with basic header configuration.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Header with Actions"
        header={{
          title: 'Header with Actions',
          actions: (
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Settings className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline">
                <User className="w-4 h-4" />
              </Button>
            </div>
          ),
        }}
      >
        <p>Modal with action buttons in the header.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="No Close Button"
        header={{
          title: 'No Close Button',
          showClose: false,
        }}
        footer={{
          primaryAction: <Button variant="primary">Done</Button>,
        }}
      >
        <p>
          Modal without a close button in the header. Use the footer button to
          close.
        </p>
      </ModalTrigger>
    </div>
  ),
};

// Footer configurations
export const FooterVariations: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ModalTrigger
        buttonText="Standard Footer"
        header={{ title: 'Standard Footer' }}
        footer={{
          primaryAction: <Button variant="primary">Save</Button>,
          secondaryAction: <Button variant="outline">Cancel</Button>,
        }}
      >
        <p>Modal with standard footer buttons.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Left Aligned Footer"
        header={{ title: 'Left Aligned Footer' }}
        footer={{
          align: 'left',
          content: (
            <span className="text-sm text-gray-500">
              Last saved: 2 minutes ago
            </span>
          ),
          primaryAction: <Button variant="primary">Save</Button>,
        }}
      >
        <p>Modal with left-aligned footer content.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Multiple Actions"
        header={{ title: 'Multiple Actions' }}
        footer={{
          align: 'between',
          actions: [
            <Button key="delete" variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>,
            <Button key="download" variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>,
          ],
          primaryAction: <Button variant="primary">Save</Button>,
        }}
      >
        <p>Modal with multiple action buttons in the footer.</p>
      </ModalTrigger>
    </div>
  ),
};

// Scrollable content
export const ScrollableContent: Story = {
  render: () => (
    <ModalTrigger
      buttonText="Scrollable Modal"
      size="md"
      maxHeight="400px"
      header={{ title: 'Scrollable Content', sticky: true }}
      footer={{
        primaryAction: <Button variant="primary">Save</Button>,
        sticky: true,
      }}
    >
      <div className="space-y-4">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="p-4 border border-gray-200 rounded">
            <h3 className="font-semibold">Section {i + 1}</h3>
            <p>
              This is content section {i + 1}. The modal has a maximum height
              and this content will be scrollable when it exceeds that height.
            </p>
          </div>
        ))}
      </div>
    </ModalTrigger>
  ),
};

// Loading and error states
export const LoadingAndError: Story = {
  render: () => (
    <div className="flex gap-2">
      <ModalTrigger
        buttonText="Loading Modal"
        header={{ title: 'Loading Content' }}
        loading={true}
      >
        <p>This content won't be visible due to loading state.</p>
      </ModalTrigger>

      <ModalTrigger
        buttonText="Error Modal"
        header={{ title: 'Error State' }}
        error="Failed to load content. Please try again."
      >
        <p>This content won't be visible due to error state.</p>
      </ModalTrigger>
    </div>
  ),
};

// Non-closable modal
export const NonClosable: Story = {
  render: () => (
    <ModalTrigger
      buttonText="Non-Closable Modal"
      closable={false}
      closeOnEscape={false}
      closeOnOutsideClick={false}
      header={{
        title: 'Processing...',
        showClose: false,
      }}
    >
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p>Please wait while we process your request...</p>
        <p className="text-sm text-gray-500 mt-2">
          This modal cannot be closed until processing is complete.
        </p>
      </div>
    </ModalTrigger>
  ),
};

// Scan progress modal example
export const ScanProgressModal: Story = {
  render: () => {
    const [progress, setProgress] = useState(45);

    return (
      <ModalTrigger
        buttonText="Scan Progress Modal"
        size="lg"
        closeOnOutsideClick={false}
        header={{
          title: 'Volume Scan in Progress',
          subtitle: 'Scanning /Users/Documents',
          actions: (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Activity className="w-4 h-4" />
              <span>Active</span>
            </div>
          ),
        }}
        footer={{
          align: 'between',
          content: (
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Files: 1,247 / 2,500</span>
              <span>Speed: 42 files/s</span>
            </div>
          ),
          actions: [
            <Button key="pause" variant="outline" size="sm">
              Pause
            </Button>,
          ],
          primaryAction: <Button variant="outline">Cancel</Button>,
        }}
      >
        <div className="space-y-6">
          {/* Progress Overview */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-gray-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Current Phase */}
          <div className="space-y-3">
            <h4 className="font-medium">Current Phase: Filesystem Indexing</h4>
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-500" />
              <div className="flex-1">
                <div className="text-sm text-gray-600">
                  Processing: /Users/Documents/Projects/important-file.pdf
                </div>
                <div className="text-xs text-gray-500">
                  2.1 MB • Modified 2 hours ago
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-lg font-semibold text-gray-900">1,247</div>
              <div className="text-sm text-gray-600">Files Processed</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-lg font-semibold text-gray-900">2.1 GB</div>
              <div className="text-sm text-gray-600">Data Scanned</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-lg font-semibold text-gray-900">3m 42s</div>
              <div className="text-sm text-gray-600">Elapsed Time</div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h4 className="font-medium mb-2">Recent Activity</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Completed: Media Enrichment Phase</span>
              </div>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                <span>Started: Filesystem Indexing Phase</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span>Skipped 3 files due to permissions</span>
              </div>
            </div>
          </div>
        </div>
      </ModalTrigger>
    );
  },
};

// Interactive example
export const Interactive: Story = {
  render: () => {
    const [modalConfig, setModalConfig] = useState({
      size: 'md' as const,
      variant: 'modal' as const,
      animation: 'fade' as const,
      position: 'right' as const,
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded">
          <div>
            <label className="block text-sm font-medium mb-1">Size</label>
            <select
              value={modalConfig.size}
              onChange={(e) =>
                setModalConfig((prev) => ({
                  ...prev,
                  size: e.target.value as any,
                }))
              }
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="xs">Extra Small</option>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra Large</option>
              <option value="2xl">2X Large</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Variant</label>
            <select
              value={modalConfig.variant}
              onChange={(e) =>
                setModalConfig((prev) => ({
                  ...prev,
                  variant: e.target.value as any,
                }))
              }
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="modal">Modal</option>
              <option value="drawer">Drawer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Animation</label>
            <select
              value={modalConfig.animation}
              onChange={(e) =>
                setModalConfig((prev) => ({
                  ...prev,
                  animation: e.target.value as any,
                }))
              }
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="scale">Scale</option>
              <option value="none">None</option>
            </select>
          </div>

          {modalConfig.variant === 'drawer' && (
            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <select
                value={modalConfig.position}
                onChange={(e) =>
                  setModalConfig((prev) => ({
                    ...prev,
                    position: e.target.value as any,
                  }))
                }
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
          )}
        </div>

        <ModalTrigger
          buttonText="Open Customized Modal"
          {...modalConfig}
          header={{
            title: `${modalConfig.variant === 'modal' ? 'Modal' : 'Drawer'} - ${modalConfig.size}`,
            subtitle: `Animation: ${modalConfig.animation}${modalConfig.variant === 'drawer' ? `, Position: ${modalConfig.position}` : ''}`,
          }}
          footer={{
            primaryAction: <Button variant="primary">Apply</Button>,
            secondaryAction: <Button variant="outline">Cancel</Button>,
          }}
        >
          <div className="space-y-4">
            <p>This is a customizable modal/drawer example.</p>
            <p>You can adjust the configuration using the controls above.</p>
            <div className="bg-gray-50 p-4 rounded">
              <h4 className="font-medium mb-2">Current Configuration:</h4>
              <ul className="text-sm space-y-1">
                <li>
                  <strong>Variant:</strong> {modalConfig.variant}
                </li>
                <li>
                  <strong>Size:</strong> {modalConfig.size}
                </li>
                <li>
                  <strong>Animation:</strong> {modalConfig.animation}
                </li>
                {modalConfig.variant === 'drawer' && (
                  <li>
                    <strong>Position:</strong> {modalConfig.position}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </ModalTrigger>
      </div>
    );
  },
};
