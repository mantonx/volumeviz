import React, { useState, useCallback, useEffect } from 'react';
import {
  AlertCircle,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn, formatBytes } from '@/utils';

export interface Operation {
  id: string;
  type: 'delete' | 'move' | 'copy' | 'rename';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  volumeId: string;
  description: string;
  createdAt: string;
  completedAt?: string;
  actions: OperationAction[];
  metadata: OperationMetadata;
}

export interface OperationAction {
  id: string;
  type: 'delete' | 'move' | 'copy' | 'rename';
  sourcePath: string;
  targetPath?: string;
  fileSize: number;
  status: string;
  executedAt?: string;
  backupPath?: string;
  errorMessage?: string;
}

export interface OperationMetadata {
  totalFiles: number;
  processedFiles: number;
  totalSizeBytes: number;
  savedSpaceBytes?: number;
  workflowId?: string;
  riskLevel?: string;
}

export interface RollbackResponse {
  success: boolean;
  rolledBack: string[];
  failed: RollbackFailure[];
  operationId: string;
  completedAt: string;
}

export interface RollbackFailure {
  actionId: string;
  errorMessage: string;
  reason: string;
}

export interface UndoRollbackProps {
  className?: string;
  volumeId: string;
  isVisible: boolean;
  onClose: () => void;
  onOperationRollback?: (
    operationId: string,
    response: RollbackResponse,
  ) => void;
}

// formatBytes is now imported from @/utils

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'rolled_back':
      return <RotateCcw className="h-4 w-4 text-orange-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const getRiskColor = (riskLevel?: string) => {
  switch (riskLevel) {
    case 'high':
      return 'text-red-600 bg-red-50';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'low':
      return 'text-green-600 bg-green-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export const UndoRollback: React.FC<UndoRollbackProps> = ({
  className,
  volumeId,
  isVisible,
  onClose,
  onOperationRollback,
}) => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(
    null,
  );
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(
    new Set(),
  );
  const [rollbackLoading, setRollbackLoading] = useState<Set<string>>(
    new Set(),
  );
  const [page, setPage] = useState(1);

  // Load operations history
  const loadOperations = useCallback(async () => {
    if (!isVisible) return;

    setLoading(true);
    try {
      // Simulate API call - replace with actual API integration
      const mockOperations: Operation[] = [
        {
          id: 'op-1',
          type: 'delete',
          status: 'completed',
          volumeId: volumeId,
          description: 'Deleted 5 duplicate image files',
          createdAt: '2024-01-15T14:30:00Z',
          completedAt: '2024-01-15T14:30:15Z',
          actions: [
            {
              id: 'action-1',
              type: 'delete',
              sourcePath: '/photos/IMG_001.jpg',
              fileSize: 2048000,
              status: 'completed',
              executedAt: '2024-01-15T14:30:10Z',
              backupPath: '/tmp/volumeviz-backup/IMG_001.jpg',
            },
            {
              id: 'action-2',
              type: 'delete',
              sourcePath: '/photos/IMG_001_copy.jpg',
              fileSize: 2048000,
              status: 'completed',
              executedAt: '2024-01-15T14:30:12Z',
              backupPath: '/tmp/volumeviz-backup/IMG_001_copy.jpg',
            },
          ],
          metadata: {
            totalFiles: 5,
            processedFiles: 5,
            totalSizeBytes: 10240000,
            savedSpaceBytes: 8192000,
            workflowId: 'cleanup-workflow-1',
            riskLevel: 'medium',
          },
        },
        {
          id: 'op-2',
          type: 'move',
          status: 'completed',
          volumeId: volumeId,
          description: 'Moved 3 files to archive folder',
          createdAt: '2024-01-14T10:15:00Z',
          completedAt: '2024-01-14T10:15:08Z',
          actions: [
            {
              id: 'action-3',
              type: 'move',
              sourcePath: '/documents/old-report.pdf',
              targetPath: '/archive/old-report.pdf',
              fileSize: 5242880,
              status: 'completed',
              executedAt: '2024-01-14T10:15:05Z',
            },
          ],
          metadata: {
            totalFiles: 3,
            processedFiles: 3,
            totalSizeBytes: 15728640,
            riskLevel: 'low',
          },
        },
      ];

      setOperations(mockOperations);
    } catch (error) {
      console.error('Failed to load operations:', error);
    } finally {
      setLoading(false);
    }
  }, [isVisible, volumeId]);

  // Handle rollback operation
  const handleRollback = useCallback(
    async (operationId: string, actionIds?: string[]) => {
      setRollbackLoading((prev) => new Set([...prev, operationId]));

      try {
        // Simulate API call - replace with actual API integration
        const rollbackResponse: RollbackResponse = {
          success: true,
          rolledBack: actionIds || ['action-1', 'action-2'],
          failed: [],
          operationId: `rollback-${operationId}`,
          completedAt: new Date().toISOString(),
        };

        // Update operation status
        setOperations((prev) =>
          prev.map((op) =>
            op.id === operationId
              ? { ...op, status: 'rolled_back' as const }
              : op,
          ),
        );

        if (onOperationRollback) {
          onOperationRollback(operationId, rollbackResponse);
        }
      } catch (error) {
        console.error('Failed to rollback operation:', error);
      } finally {
        setRollbackLoading((prev) => {
          const next = new Set(prev);
          next.delete(operationId);
          return next;
        });
      }
    },
    [onOperationRollback],
  );

  // Toggle operation expansion
  const toggleExpanded = useCallback((operationId: string) => {
    setExpandedOperations((prev) => {
      const next = new Set(prev);
      if (next.has(operationId)) {
        next.delete(operationId);
      } else {
        next.add(operationId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4',
        className,
      )}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Undo & Rollback Operations
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="h-8 w-8 text-blue-500 animate-spin" />
              <span className="ml-2 text-gray-600">Loading operations...</span>
            </div>
          ) : operations.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Operations Found
              </h3>
              <p className="text-gray-600">
                No file operations have been performed yet on this volume.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {operations.map((operation) => {
                const isExpanded = expandedOperations.has(operation.id);
                const isRollbackLoading = rollbackLoading.has(operation.id);
                const canRollback = operation.status === 'completed';

                return (
                  <div
                    key={operation.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Operation Header */}
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleExpanded(operation.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </button>
                          {getStatusIcon(operation.status)}
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {operation.description}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {formatDate(operation.createdAt)} •{' '}
                              {operation.metadata.totalFiles} files
                              {operation.metadata.savedSpaceBytes && (
                                <>
                                  {' '}
                                  • Saved{' '}
                                  {formatBytes(
                                    operation.metadata.savedSpaceBytes,
                                  )}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {operation.metadata.riskLevel && (
                            <span
                              className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium',
                                getRiskColor(operation.metadata.riskLevel),
                              )}
                            >
                              {operation.metadata.riskLevel} risk
                            </span>
                          )}
                          {canRollback && (
                            <button
                              onClick={() => handleRollback(operation.id)}
                              disabled={isRollbackLoading}
                              className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                isRollbackLoading
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200',
                              )}
                            >
                              {isRollbackLoading ? (
                                <>
                                  <Clock className="h-4 w-4 animate-spin inline mr-1" />
                                  Rolling back...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4 inline mr-1" />
                                  Rollback
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Operation Details */}
                    {isExpanded && (
                      <div className="p-4">
                        {operation.actions.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">
                              Actions ({operation.actions.length})
                            </h4>
                            <div className="space-y-2">
                              {operation.actions.map((action) => (
                                <div
                                  key={action.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    {getStatusIcon(action.status)}
                                    <div>
                                      <p className="font-medium text-gray-900">
                                        {action.type.charAt(0).toUpperCase() +
                                          action.type.slice(1)}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        {action.sourcePath}
                                        {action.targetPath &&
                                          ` → ${action.targetPath}`}
                                      </p>
                                      {action.errorMessage && (
                                        <p className="text-sm text-red-600 mt-1">
                                          {action.errorMessage}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-gray-600">
                                      {formatBytes(action.fileSize)}
                                    </p>
                                    {action.executedAt && (
                                      <p className="text-xs text-gray-500">
                                        {formatDate(action.executedAt)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Operation Metadata */}
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">
                            Operation Details
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-blue-700">Total Size:</span>
                              <span className="ml-2 text-blue-900 font-medium">
                                {formatBytes(operation.metadata.totalSizeBytes)}
                              </span>
                            </div>
                            <div>
                              <span className="text-blue-700">Progress:</span>
                              <span className="ml-2 text-blue-900 font-medium">
                                {operation.metadata.processedFiles}/
                                {operation.metadata.totalFiles} files
                              </span>
                            </div>
                            {operation.metadata.workflowId && (
                              <div>
                                <span className="text-blue-700">Workflow:</span>
                                <span className="ml-2 text-blue-900 font-medium">
                                  {operation.metadata.workflowId}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="text-blue-700">Type:</span>
                              <span className="ml-2 text-blue-900 font-medium capitalize">
                                {operation.type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <AlertCircle className="h-4 w-4" />
            <span>
              Rollback operations will restore files from backup when possible
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
