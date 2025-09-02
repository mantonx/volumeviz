import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Archive, Move, CheckSquare, Square, AlertTriangle, Clock, X, Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/class-names/cn';

export interface CleanupItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  reason: string;
  risk: 'low' | 'medium' | 'high';
  lastAccessed?: Date;
  lastModified?: Date;
  isSelected: boolean;
  canDelete: boolean;
  canMove: boolean;
  canArchive: boolean;
  details?: {
    isDuplicate?: boolean;
    isEmpty?: boolean;
    isTemporary?: boolean;
    extensions?: string[];
  };
}

export interface CleanupAction {
  id: string;
  type: 'delete' | 'move' | 'archive';
  items: CleanupItem[];
  destination?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  error?: string;
  estimatedTime?: number;
  spaceReclaimed?: number;
}

export interface CleanupWorkflowProps {
  /** Whether workflow is visible */
  isVisible: boolean;
  /** Called when workflow should be closed */
  onClose: () => void;
  /** Volume ID to clean up */
  volumeId: string;
  /** Path to clean up */
  path?: string;
  /** Initial cleanup suggestions */
  initialItems?: CleanupItem[];
  /** Called when cleanup is executed */
  onExecuteCleanup?: (actions: CleanupAction[]) => Promise<void>;
  /** Called when items are selected/deselected */
  onSelectionChange?: (selectedItems: CleanupItem[]) => void;
}

type WorkflowStep = 'scan' | 'review' | 'confirm' | 'execute' | 'complete';
type CleanupCategory = 'duplicates' | 'empty' | 'temporary' | 'old' | 'large';

/**
 * Cleanup workflow component for guided file system maintenance
 */
export const CleanupWorkflow: React.FC<CleanupWorkflowProps> = ({
  isVisible,
  onClose,
  volumeId,
  path = '/',
  initialItems = [],
  onExecuteCleanup,
  onSelectionChange,
}) => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('scan');
  const [cleanupItems, setCleanupItems] = useState<CleanupItem[]>(initialItems);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CleanupCategory | 'all'>('all');
  const [actions, setActions] = useState<CleanupAction[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // Mock data generation for cleanup suggestions
  const generateMockCleanupItems = useCallback((): CleanupItem[] => {
    const mockItems: CleanupItem[] = [];
    const categories = [
      { type: 'duplicates', count: 15, sizeRange: [1000000, 50000000] },
      { type: 'empty', count: 8, sizeRange: [0, 1024] },
      { type: 'temporary', count: 25, sizeRange: [1024, 10000000] },
      { type: 'old', count: 12, sizeRange: [5000000, 100000000] },
      { type: 'large', count: 6, sizeRange: [100000000, 5000000000] },
    ];

    categories.forEach(({ type, count, sizeRange }) => {
      for (let i = 0; i < count; i++) {
        const size = Math.floor(Math.random() * (sizeRange[1] - sizeRange[0]) + sizeRange[0]);
        const risk = Math.random() < 0.3 ? 'high' : Math.random() < 0.6 ? 'medium' : 'low';
        const isDirectory = Math.random() < 0.3;
        
        const item: CleanupItem = {
          id: `${type}-${i}`,
          name: `${type}_file_${i + 1}${isDirectory ? '' : getRandomExtension()}`,
          path: `${path}/${type}_file_${i + 1}`,
          size,
          type: isDirectory ? 'directory' : 'file',
          reason: getReasonForType(type),
          risk,
          lastAccessed: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
          lastModified: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
          isSelected: false,
          canDelete: risk !== 'high' || type === 'temporary',
          canMove: true,
          canArchive: type !== 'temporary',
          details: {
            isDuplicate: type === 'duplicates',
            isEmpty: type === 'empty',
            isTemporary: type === 'temporary',
            extensions: isDirectory ? undefined : [getRandomExtension().slice(1)],
          },
        };

        mockItems.push(item);
      }
    });

    return mockItems;
  }, [path]);

  // Start cleanup scan
  const startScan = useCallback(async () => {
    setIsScanning(true);
    setCurrentStep('scan');
    
    try {
      // Simulate scanning delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const items = generateMockCleanupItems();
      setCleanupItems(items);
      setCurrentStep('review');
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  }, [generateMockCleanupItems]);

  // Toggle item selection
  const toggleItemSelection = useCallback((itemId: string) => {
    setCleanupItems(prev => {
      const updated = prev.map(item => 
        item.id === itemId ? { ...item, isSelected: !item.isSelected } : item
      );
      
      const selectedItems = updated.filter(item => item.isSelected);
      onSelectionChange?.(selectedItems);
      
      return updated;
    });
  }, [onSelectionChange]);

  // Select all items in category
  const selectAllInCategory = useCallback((category: CleanupCategory | 'all') => {
    setCleanupItems(prev => {
      const updated = prev.map(item => ({
        ...item,
        isSelected: category === 'all' || getCategoryForItem(item) === category,
      }));
      
      const selectedItems = updated.filter(item => item.isSelected);
      onSelectionChange?.(selectedItems);
      
      return updated;
    });
  }, [onSelectionChange]);

  // Deselect all items
  const deselectAll = useCallback(() => {
    setCleanupItems(prev => {
      const updated = prev.map(item => ({ ...item, isSelected: false }));
      onSelectionChange?.([]);
      return updated;
    });
  }, [onSelectionChange]);

  // Create cleanup actions
  const createCleanupActions = useCallback(() => {
    const selectedItems = cleanupItems.filter(item => item.isSelected);
    const newActions: CleanupAction[] = [];

    // Group by action type
    const deleteItems = selectedItems.filter(item => item.canDelete);
    const archiveItems = selectedItems.filter(item => item.canArchive && !deleteItems.includes(item));
    
    if (deleteItems.length > 0) {
      newActions.push({
        id: 'delete-action',
        type: 'delete',
        items: deleteItems,
        status: 'pending',
        progress: 0,
        estimatedTime: deleteItems.length * 0.5, // 0.5 seconds per item
        spaceReclaimed: deleteItems.reduce((sum, item) => sum + item.size, 0),
      });
    }

    if (archiveItems.length > 0) {
      newActions.push({
        id: 'archive-action',
        type: 'archive',
        items: archiveItems,
        destination: `${path}/.archive`,
        status: 'pending',
        progress: 0,
        estimatedTime: archiveItems.length * 1, // 1 second per item
        spaceReclaimed: 0, // Archives don't reclaim space
      });
    }

    setActions(newActions);
  }, [cleanupItems, path]);

  // Execute cleanup actions
  const executeCleanup = useCallback(async () => {
    setIsExecuting(true);
    setCurrentStep('execute');

    try {
      // Execute each action
      for (const action of actions) {
        setActions(prev => prev.map(a => 
          a.id === action.id ? { ...a, status: 'running' } : a
        ));

        // Simulate action execution with progress updates
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setActions(prev => prev.map(a => 
            a.id === action.id ? { ...a, progress } : a
          ));
        }

        setActions(prev => prev.map(a => 
          a.id === action.id ? { ...a, status: 'completed', progress: 100 } : a
        ));
      }

      if (onExecuteCleanup) {
        await onExecuteCleanup(actions);
      }

      setCurrentStep('complete');
      setCanUndo(true);
    } catch (error) {
      console.error('Cleanup execution failed:', error);
      setActions(prev => prev.map(a => ({ ...a, status: 'failed', error: 'Cleanup failed' })));
    } finally {
      setIsExecuting(false);
    }
  }, [actions, onExecuteCleanup]);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return cleanupItems;
    return cleanupItems.filter(item => getCategoryForItem(item) === selectedCategory);
  }, [cleanupItems, selectedCategory]);

  // Calculate statistics
  const stats = useMemo(() => {
    const selectedItems = cleanupItems.filter(item => item.isSelected);
    const totalSize = selectedItems.reduce((sum, item) => sum + item.size, 0);
    const riskBreakdown = {
      low: selectedItems.filter(item => item.risk === 'low').length,
      medium: selectedItems.filter(item => item.risk === 'medium').length,
      high: selectedItems.filter(item => item.risk === 'high').length,
    };

    return {
      totalItems: cleanupItems.length,
      selectedItems: selectedItems.length,
      totalSize,
      riskBreakdown,
    };
  }, [cleanupItems]);

  // Start scan when workflow becomes visible
  useEffect(() => {
    if (isVisible && currentStep === 'scan' && !isScanning) {
      startScan();
    }
  }, [isVisible, currentStep, isScanning, startScan]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 bg-background border border-border rounded-lg shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Cleanup Workflow</h2>
              <p className="text-sm text-muted-foreground">
                {volumeId} • {path}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canUndo && (
              <button
                type="button"
                className="p-2 hover:bg-muted rounded-lg text-orange-500"
                title="Undo cleanup"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center p-4 border-b border-border">
          <div className="flex items-center gap-4">
            {(['scan', 'review', 'confirm', 'execute', 'complete'] as const).map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  getCurrentStepIndex(currentStep) > index ? 'bg-green-500 text-white' :
                  getCurrentStepIndex(currentStep) === index ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                )}>
                  {index + 1}
                </div>
                <span className={cn(
                  'text-sm capitalize',
                  getCurrentStepIndex(currentStep) >= index ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {step}
                </span>
                {index < 4 && (
                  <div className={cn(
                    'w-8 h-px',
                    getCurrentStepIndex(currentStep) > index ? 'bg-green-500' : 'bg-muted'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {currentStep === 'scan' && (
            <ScanStep 
              isScanning={isScanning} 
              onStartScan={startScan}
              volumeId={volumeId}
              path={path}
            />
          )}

          {currentStep === 'review' && (
            <ReviewStep
              items={filteredItems}
              selectedCategory={selectedCategory}
              stats={stats}
              onCategoryChange={setSelectedCategory}
              onItemToggle={toggleItemSelection}
              onSelectAll={selectAllInCategory}
              onDeselectAll={deselectAll}
              onNext={() => {
                createCleanupActions();
                setCurrentStep('confirm');
              }}
              formatFileSize={formatFileSize}
              getRiskColor={getRiskColor}
            />
          )}

          {currentStep === 'confirm' && (
            <ConfirmStep
              actions={actions}
              stats={stats}
              onConfirm={executeCleanup}
              onBack={() => setCurrentStep('review')}
              formatFileSize={formatFileSize}
            />
          )}

          {currentStep === 'execute' && (
            <ExecuteStep
              actions={actions}
              isExecuting={isExecuting}
              formatFileSize={formatFileSize}
            />
          )}

          {currentStep === 'complete' && (
            <CompleteStep
              actions={actions}
              stats={stats}
              onClose={onClose}
              onStartNew={() => {
                setCurrentStep('scan');
                setCleanupItems([]);
                setActions([]);
                setCanUndo(false);
              }}
              formatFileSize={formatFileSize}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
const getRandomExtension = (): string => {
  const extensions = ['.tmp', '.log', '.cache', '.bak', '.old', '.jpg', '.mp4', '.pdf', '.docx', '.zip'];
  return extensions[Math.floor(Math.random() * extensions.length)];
};

const getReasonForType = (type: string): string => {
  const reasons = {
    duplicates: 'Duplicate file detected',
    empty: 'Empty file or directory',
    temporary: 'Temporary file that can be safely removed',
    old: 'File not accessed in over 6 months',
    large: 'Large file consuming significant space',
  };
  return reasons[type as keyof typeof reasons] || 'Cleanup candidate';
};

const getCategoryForItem = (item: CleanupItem): CleanupCategory => {
  if (item.details?.isDuplicate) return 'duplicates';
  if (item.details?.isEmpty) return 'empty';
  if (item.details?.isTemporary) return 'temporary';
  if (item.size > 100000000) return 'large';
  return 'old';
};

const getCurrentStepIndex = (step: WorkflowStep): number => {
  const steps = ['scan', 'review', 'confirm', 'execute', 'complete'];
  return steps.indexOf(step);
};

// Step Components
interface ScanStepProps {
  isScanning: boolean;
  onStartScan: () => void;
  volumeId: string;
  path: string;
}

const ScanStep: React.FC<ScanStepProps> = ({ isScanning, onStartScan, volumeId, path }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center max-w-md">
      {isScanning ? (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-6" />
          <h3 className="text-lg font-semibold mb-2">Scanning for cleanup candidates...</h3>
          <p className="text-muted-foreground mb-4">
            Analyzing {volumeId} at {path} for files and folders that can be cleaned up
          </p>
        </>
      ) : (
        <>
          <Trash2 className="h-12 w-12 text-primary mx-auto mb-6" />
          <h3 className="text-lg font-semibold mb-2">Ready to scan for cleanup opportunities</h3>
          <p className="text-muted-foreground mb-6">
            We'll identify duplicates, temporary files, empty directories, and other cleanup candidates
          </p>
          <button
            type="button"
            onClick={onStartScan}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Start Scan
          </button>
        </>
      )}
    </div>
  </div>
);

interface ReviewStepProps {
  items: CleanupItem[];
  selectedCategory: CleanupCategory | 'all';
  stats: any;
  onCategoryChange: (category: CleanupCategory | 'all') => void;
  onItemToggle: (itemId: string) => void;
  onSelectAll: (category: CleanupCategory | 'all') => void;
  onDeselectAll: () => void;
  onNext: () => void;
  formatFileSize: (bytes: number) => string;
  getRiskColor: (risk: string) => string;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  items, selectedCategory, stats, onCategoryChange, onItemToggle, 
  onSelectAll, onDeselectAll, onNext, formatFileSize, getRiskColor
}) => (
  <div className="h-full flex flex-col">
    {/* Controls */}
    <div className="flex items-center justify-between p-4 border-b border-border">
      <div className="flex items-center gap-4">
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value as CleanupCategory | 'all')}
          className="px-3 py-1 border border-border rounded text-sm"
        >
          <option value="all">All Categories</option>
          <option value="duplicates">Duplicates</option>
          <option value="empty">Empty Files</option>
          <option value="temporary">Temporary Files</option>
          <option value="old">Old Files</option>
          <option value="large">Large Files</option>
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectAll(selectedCategory)}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm">
          <span className="font-medium">{stats.selectedItems}</span> of {stats.totalItems} selected
          <span className="ml-2">({formatFileSize(stats.totalSize)})</span>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={stats.selectedItems === 0}
          className={cn(
            'px-4 py-2 rounded-lg',
            stats.selectedItems > 0
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          Continue
        </button>
      </div>
    </div>

    {/* Items List */}
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer border-b border-border',
              item.isSelected && 'bg-primary/5 border-primary/20'
            )}
            onClick={() => onItemToggle(item.id)}
          >
            <div className="flex-shrink-0">
              {item.isSelected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium truncate">{item.name}</span>
                <span className={cn('text-xs px-2 py-1 rounded-full', getRiskColor(item.risk))}>
                  {item.risk} risk
                </span>
              </div>
              <div className="text-sm text-muted-foreground truncate">{item.path}</div>
              <div className="text-xs text-muted-foreground">{item.reason}</div>
            </div>

            <div className="flex-shrink-0 text-right">
              <div className="font-medium">{formatFileSize(item.size)}</div>
              <div className="text-xs text-muted-foreground">{item.type}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

interface ConfirmStepProps {
  actions: CleanupAction[];
  stats: any;
  onConfirm: () => void;
  onBack: () => void;
  formatFileSize: (bytes: number) => string;
}

const ConfirmStep: React.FC<ConfirmStepProps> = ({ actions, stats, onConfirm, onBack, formatFileSize }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center max-w-2xl">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-6" />
      <h3 className="text-lg font-semibold mb-4">Confirm Cleanup Actions</h3>
      
      <div className="space-y-4 mb-8">
        {actions.map((action) => (
          <div key={action.id} className="p-4 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium capitalize">{action.type} {action.items.length} items</span>
              <span>{formatFileSize(action.spaceReclaimed || 0)} reclaimed</span>
            </div>
            {action.destination && (
              <div className="text-sm text-muted-foreground">Destination: {action.destination}</div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2 border border-border rounded-lg hover:bg-muted"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Execute Cleanup
        </button>
      </div>
    </div>
  </div>
);

interface ExecuteStepProps {
  actions: CleanupAction[];
  isExecuting: boolean;
  formatFileSize: (bytes: number) => string;
}

const ExecuteStep: React.FC<ExecuteStepProps> = ({ actions, isExecuting, formatFileSize }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center max-w-md">
      <Clock className="h-12 w-12 text-primary mx-auto mb-6" />
      <h3 className="text-lg font-semibold mb-6">Executing Cleanup...</h3>
      
      <div className="space-y-4">
        {actions.map((action) => (
          <div key={action.id} className="p-4 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="capitalize">{action.type} ({action.items.length} items)</span>
              <span className={cn(
                'text-sm px-2 py-1 rounded-full',
                action.status === 'completed' && 'bg-green-100 text-green-700',
                action.status === 'running' && 'bg-blue-100 text-blue-700',
                action.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                action.status === 'failed' && 'bg-red-100 text-red-700'
              )}>
                {action.status}
              </span>
            </div>
            {action.progress !== undefined && (
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all duration-300"
                  style={{ width: `${action.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

interface CompleteStepProps {
  actions: CleanupAction[];
  stats: any;
  onClose: () => void;
  onStartNew: () => void;
  formatFileSize: (bytes: number) => string;
}

const CompleteStep: React.FC<CompleteStepProps> = ({ actions, stats, onClose, onStartNew, formatFileSize }) => {
  const totalReclaimed = actions.reduce((sum, action) => sum + (action.spaceReclaimed || 0), 0);
  const totalProcessed = actions.reduce((sum, action) => sum + action.items.length, 0);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckSquare className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold mb-4">Cleanup Complete!</h3>
        
        <div className="space-y-2 mb-8 text-sm">
          <div>Processed <span className="font-medium">{totalProcessed}</span> items</div>
          <div>Reclaimed <span className="font-medium">{formatFileSize(totalReclaimed)}</span> of space</div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onStartNew}
            className="px-6 py-2 border border-border rounded-lg hover:bg-muted"
          >
            Start New Cleanup
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CleanupWorkflow;