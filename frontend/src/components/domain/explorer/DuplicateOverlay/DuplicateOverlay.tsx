import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileX, Copy, Archive, AlertTriangle, ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from '@/utils/class-names/cn';

export interface DuplicateFile {
  id: string;
  path: string;
  name: string;
  size: number;
  hash?: string;
  modifiedTime: Date;
  volumeId: string;
}

export interface DuplicateGroup {
  id: string;
  hash?: string;
  size: number;
  count: number;
  files: DuplicateFile[];
  wastedSpace: number;
  createdAt: Date;
}

export interface DuplicateSummary {
  totalGroups: number;
  totalDuplicates: number;
  totalWastedSpace: number;
  processedFiles: number;
  largestGroup?: {
    id: string;
    count: number;
    wastedSpace: number;
  };
}

export interface DuplicateOverlayProps {
  /** Whether overlay is visible */
  isVisible: boolean;
  /** Called when overlay should be closed */
  onClose: () => void;
  /** Volume ID to analyze */
  volumeId: string;
  /** Path to analyze */
  path?: string;
  /** Minimum file size for analysis */
  minSize?: number;
  /** Maximum file size for analysis */
  maxSize?: number;
  /** Include empty files */
  includeEmpty?: boolean;
  /** Called when file is selected for action */
  onFileAction?: (action: 'delete' | 'move' | 'keep', files: DuplicateFile[]) => void;
}

/**
 * Overlay component for duplicate file detection and management
 */
export const DuplicateOverlay: React.FC<DuplicateOverlayProps> = ({
  isVisible,
  onClose,
  volumeId,
  path = '/',
  minSize = 0,
  maxSize = 0,
  includeEmpty = false,
  onFileAction,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [summary, setSummary] = useState<DuplicateSummary | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [detectionMode, setDetectionMode] = useState<'hash' | 'size'>('size');
  const [verifyingGroups, setVerifyingGroups] = useState<Set<string>>(new Set());

  // Mock API functions - in real implementation, these would call actual APIs
  const detectDuplicates = useCallback(async (mode: 'hash' | 'size') => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock duplicate detection result
      const mockGroups: DuplicateGroup[] = [
        {
          id: 'dup-1',
          hash: mode === 'hash' ? 'd41d8cd98f00b204e9800998ecf8427e' : undefined,
          size: 2048000,
          count: 3,
          wastedSpace: 4096000,
          createdAt: new Date(),
          files: [
            {
              id: 'file-1',
              path: '/media/photos/img1.jpg',
              name: 'img1.jpg',
              size: 2048000,
              modifiedTime: new Date('2024-01-15'),
              volumeId,
            },
            {
              id: 'file-2',
              path: '/media/backup/img1_copy.jpg',
              name: 'img1_copy.jpg',
              size: 2048000,
              modifiedTime: new Date('2024-01-16'),
              volumeId,
            },
            {
              id: 'file-3',
              path: '/media/old/img1_backup.jpg',
              name: 'img1_backup.jpg',
              size: 2048000,
              modifiedTime: new Date('2024-01-10'),
              volumeId,
            },
          ],
        },
        {
          id: 'dup-2',
          hash: mode === 'hash' ? 'e99a18c428cb38d5f260853678922e03' : undefined,
          size: 5242880,
          count: 2,
          wastedSpace: 5242880,
          createdAt: new Date(),
          files: [
            {
              id: 'file-4',
              path: '/media/videos/movie.mp4',
              name: 'movie.mp4',
              size: 5242880,
              modifiedTime: new Date('2024-02-01'),
              volumeId,
            },
            {
              id: 'file-5',
              path: '/media/downloads/movie_download.mp4',
              name: 'movie_download.mp4',
              size: 5242880,
              modifiedTime: new Date('2024-02-02'),
              volumeId,
            },
          ],
        },
      ];

      const mockSummary: DuplicateSummary = {
        totalGroups: mockGroups.length,
        totalDuplicates: mockGroups.reduce((sum, g) => sum + g.count - 1, 0),
        totalWastedSpace: mockGroups.reduce((sum, g) => sum + g.wastedSpace, 0),
        processedFiles: 10000,
        largestGroup: {
          id: 'dup-1',
          count: 3,
          wastedSpace: 4096000,
        },
      };

      setDuplicateGroups(mockGroups);
      setSummary(mockSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect duplicates');
    } finally {
      setIsLoading(false);
    }
  }, [volumeId]);

  const verifyGroup = useCallback(async (groupId: string) => {
    setVerifyingGroups(prev => new Set([...prev, groupId]));
    
    try {
      // Simulate API delay for verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock verification - assume 80% of files are actually duplicates
      setDuplicateGroups(prev => prev.map(group => {
        if (group.id === groupId) {
          const actualDuplicates = Math.max(1, Math.floor(group.files.length * 0.8));
          return {
            ...group,
            id: group.id + '-verified',
            count: actualDuplicates,
            files: group.files.slice(0, actualDuplicates),
            wastedSpace: group.size * (actualDuplicates - 1),
            hash: 'd41d8cd98f00b204e9800998ecf8427e', // Add actual hash
          };
        }
        return group;
      }));
    } finally {
      setVerifyingGroups(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  }, []);

  // Start detection when overlay becomes visible
  useEffect(() => {
    if (isVisible) {
      detectDuplicates(detectionMode);
    }
  }, [isVisible, detectionMode, detectDuplicates]);

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const toggleFileSelected = useCallback((fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const getSelectedFiles = useCallback(() => {
    const selected: DuplicateFile[] = [];
    duplicateGroups.forEach(group => {
      group.files.forEach(file => {
        if (selectedFiles.has(file.id)) {
          selected.push(file);
        }
      });
    });
    return selected;
  }, [duplicateGroups, selectedFiles]);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  const sortedGroups = useMemo(() => {
    return [...duplicateGroups].sort((a, b) => b.wastedSpace - a.wastedSpace);
  }, [duplicateGroups]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 bg-background border border-border rounded-lg shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Copy className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Duplicate File Detection</h2>
              <p className="text-sm text-muted-foreground">
                Analyzing {volumeId} • {path}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Detection Mode:</label>
              <select
                value={detectionMode}
                onChange={(e) => setDetectionMode(e.target.value as 'hash' | 'size')}
                disabled={isLoading}
                className="px-3 py-1 border border-border rounded text-sm"
              >
                <option value="size">By Size (Fast)</option>
                <option value="hash">By Hash (Accurate)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => detectDuplicates(detectionMode)}
              disabled={isLoading}
              className={cn(
                'px-4 py-2 bg-primary text-primary-foreground rounded text-sm',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isLoading ? 'Detecting...' : 'Detect Duplicates'}
            </button>
          </div>

          {selectedFiles.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedFiles.size} files selected
              </span>
              <button
                type="button"
                onClick={() => onFileAction?.('delete', getSelectedFiles())}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p>Detecting duplicates...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This may take a few moments
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-red-500">
                <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
                <p>Failed to detect duplicates</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && summary && (
            <>
              {/* Summary */}
              <div className="p-4 border-b border-border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{summary.totalGroups}</div>
                    <div className="text-sm text-muted-foreground">Duplicate Groups</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">{summary.totalDuplicates}</div>
                    <div className="text-sm text-muted-foreground">Duplicate Files</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {formatFileSize(summary.totalWastedSpace)}
                    </div>
                    <div className="text-sm text-muted-foreground">Wasted Space</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">{summary.processedFiles}</div>
                    <div className="text-sm text-muted-foreground">Files Analyzed</div>
                  </div>
                </div>
              </div>

              {/* Duplicate Groups */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {sortedGroups.map((group) => (
                  <DuplicateGroupCard
                    key={group.id}
                    group={group}
                    isExpanded={expandedGroups.has(group.id)}
                    selectedFiles={selectedFiles}
                    isVerifying={verifyingGroups.has(group.id)}
                    onToggleExpanded={() => toggleGroupExpanded(group.id)}
                    onToggleFileSelected={toggleFileSelected}
                    onVerify={() => verifyGroup(group.id)}
                    formatFileSize={formatFileSize}
                  />
                ))}

                {sortedGroups.length === 0 && (
                  <div className="text-center py-12">
                    <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg">No duplicates found</p>
                    <p className="text-muted-foreground">
                      All files in this location appear to be unique
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  isExpanded: boolean;
  selectedFiles: Set<string>;
  isVerifying: boolean;
  onToggleExpanded: () => void;
  onToggleFileSelected: (fileId: string) => void;
  onVerify: () => void;
  formatFileSize: (bytes: number) => string;
}

const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({
  group,
  isExpanded,
  selectedFiles,
  isVerifying,
  onToggleExpanded,
  onToggleFileSelected,
  onVerify,
  formatFileSize,
}) => {
  const needsVerification = !group.hash && group.id.includes('size-');

  return (
    <div className="border border-border rounded-lg">
      <div
        className="p-3 cursor-pointer hover:bg-muted/50 flex items-center justify-between"
        onClick={onToggleExpanded}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Archive className="h-4 w-4 text-orange-500" />
          <div>
            <div className="font-medium">
              {group.count} identical files ({formatFileSize(group.size)} each)
            </div>
            <div className="text-sm text-muted-foreground">
              Wasting {formatFileSize(group.wastedSpace)}
              {needsVerification && ' • Size-based match'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {needsVerification && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVerify();
              }}
              disabled={isVerifying}
              className={cn(
                'px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </button>
          )}
          <div className="text-right text-sm">
            <div className="font-medium text-red-500">-{formatFileSize(group.wastedSpace)}</div>
            <div className="text-muted-foreground">{group.count} files</div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border">
          {group.files.map((file, index) => (
            <div
              key={file.id}
              className={cn(
                'p-3 flex items-center justify-between hover:bg-muted/30',
                index !== group.files.length - 1 && 'border-b border-border',
              )}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.id)}
                  onChange={() => onToggleFileSelected(file.id)}
                  className="rounded"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate" title={file.path}>
                    {file.name}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {file.path}
                  </div>
                </div>
              </div>
              
              <div className="text-right text-sm">
                <div>{formatFileSize(file.size)}</div>
                <div className="text-muted-foreground">
                  {file.modifiedTime.toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DuplicateOverlay;