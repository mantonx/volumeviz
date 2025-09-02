import type { Meta, StoryObj } from '@storybook/react'
import { UndoRollback } from './UndoRollback'

const meta = {
  title: 'Domain/Explorer/UndoRollback',
  component: UndoRollback,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    isVisible: {
      control: { type: 'boolean' },
    },
    volumeId: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<typeof UndoRollback>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isVisible: true,
    volumeId: 'media-library',
    onClose: () => console.log('Close undo/rollback'),
    onOperationRollback: (operationId, response) => 
      console.log('Operation rollback:', { operationId, response }),
  },
}

export const EmptyState: Story = {
  args: {
    isVisible: true,
    volumeId: 'empty-volume',
    onClose: () => console.log('Close undo/rollback'),
    onOperationRollback: (operationId, response) => 
      console.log('Operation rollback:', { operationId, response }),
  },
}

export const LoadingState: Story = {
  args: {
    isVisible: true,
    volumeId: 'loading-volume',
    onClose: () => console.log('Close undo/rollback'),
    onOperationRollback: (operationId, response) => 
      console.log('Operation rollback:', { operationId, response }),
  },
}

export const WithMultipleOperations: Story = {
  args: {
    isVisible: true,
    volumeId: 'project-storage',
    onClose: () => console.log('Close undo/rollback'),
    onOperationRollback: (operationId, response) => 
      console.log('Operation rollback:', { operationId, response }),
  },
}

export const HighRiskOperations: Story = {
  args: {
    isVisible: true,
    volumeId: 'system-drive',
    onClose: () => console.log('Close undo/rollback'),
    onOperationRollback: (operationId, response) => 
      console.log('Operation rollback:', { operationId, response }),
  },
}

export const FailedOperations: Story = {
  args: {
    isVisible: true,
    volumeId: 'failed-operations',
    onClose: () => console.log('Close undo/rollback'),
    onOperationRollback: (operationId, response) => 
      console.log('Operation rollback:', { operationId, response }),
  },
}

export const CompletedCleanup: Story = {
  args: {
    isVisible: true,
    volumeId: 'cleaned-storage',
    onClose: () => console.log('Close undo/rollback'),
    onOperationRollback: (operationId, response) => 
      console.log('Operation rollback:', { operationId, response }),
  },
}

export const InteractiveDemo: Story = {
  args: {
    isVisible: true,
    volumeId: 'demo-volume',
    onClose: () => {
      console.log('Undo/rollback closed');
      // In a real app, this would update state to hide the overlay
    },
    onOperationRollback: (operationId, response) => {
      console.log('Rollback operation completed:', {
        operationId,
        success: response.success,
        rolledBackActions: response.rolledBack.length,
        failedActions: response.failed.length,
        completedAt: response.completedAt,
      });
      // In a real app, this would update the UI and show success/error messages
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-gray-50">
        <div className="p-4 bg-blue-50 text-center">
          <p className="text-sm text-blue-700">
            Interactive undo/rollback system - try expanding operations and rolling them back
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
}

export const Hidden: Story = {
  args: {
    isVisible: false,
    volumeId: 'media-library',
    onClose: () => console.log('Close undo/rollback'),
    onOperationRollback: (operationId, response) => 
      console.log('Operation rollback:', { operationId, response }),
  },
}