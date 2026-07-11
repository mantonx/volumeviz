/**
 * DuplicateDetectionModal - Finds duplicate files within a volume
 *
 * Calls the real /api/v1/duplicates/detect endpoint (content-hash based).
 * The endpoint is scoped to a single volume, so the modal requires one to
 * be selected before it can run.
 */

import { useState } from 'react';
import { Copy, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useGetApiV1DuplicatesDetect } from '@/api/orval-generated/api';
import { formatBytes } from '@/utils/formatters';

interface DuplicateDetectionModalProps {
  open: boolean;
  onClose: () => void;
  volumeId?: string;
  path?: string;
}

export const DuplicateDetectionModal: React.FC<
  DuplicateDetectionModalProps
> = ({ open, onClose, volumeId, path = '/' }) => {
  const [hasScanned, setHasScanned] = useState(false);

  const {
    data,
    isFetching,
    error,
    refetch,
  } = useGetApiV1DuplicatesDetect(
    { volumeId: volumeId ?? '', path },
    { query: { enabled: false } },
  );

  const result = data?.status === 200 ? data.data : undefined;
  const groups = result?.groups ?? [];

  const handleScan = () => {
    setHasScanned(true);
    refetch();
  };

  const handleClose = () => {
    setHasScanned(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      header={{ title: 'Duplicate File Detection' }}
      size="lg"
    >
      <div className="space-y-4">
        {!volumeId ? (
          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Select a single volume in Advanced Filters to scan it for
              duplicate files.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Copy className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary">
                  Scan for Duplicate Files
                </p>
                <p className="text-sm text-secondary mt-1">
                  Analyzes files in volume "{volumeId}" starting at {path} and
                  groups them by content hash.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
                Failed to detect duplicates: {String(error)}
              </div>
            )}

            {!hasScanned && (
              <div className="flex justify-end">
                <Button onClick={handleScan} disabled={isFetching}>
                  {isFetching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    'Scan Volume'
                  )}
                </Button>
              </div>
            )}

            {hasScanned && isFetching && (
              <div className="flex items-center justify-center py-8 text-secondary">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Scanning for duplicates...
              </div>
            )}

            {hasScanned && !isFetching && result && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-surface-secondary rounded-lg">
                    <p className="text-xl font-bold text-primary">
                      {result.summary?.total_groups ?? 0}
                    </p>
                    <p className="text-xs text-secondary">Duplicate Groups</p>
                  </div>
                  <div className="p-3 bg-surface-secondary rounded-lg">
                    <p className="text-xl font-bold text-primary">
                      {result.summary?.total_duplicates ?? 0}
                    </p>
                    <p className="text-xs text-secondary">Duplicate Files</p>
                  </div>
                  <div className="p-3 bg-surface-secondary rounded-lg">
                    <p className="text-xl font-bold text-primary">
                      {formatBytes(result.summary?.total_wasted_space ?? 0)}
                    </p>
                    <p className="text-xs text-secondary">Wasted Space</p>
                  </div>
                </div>

                {groups.length === 0 ? (
                  <p className="text-sm text-secondary text-center py-4">
                    No duplicate files found.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        className="p-3 border border-line rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-primary">
                            {group.count} copies · {formatBytes(group.size ?? 0)} each
                          </span>
                          <span className="text-xs text-tertiary">
                            {formatBytes(group.wasted_space ?? 0)} wasted
                          </span>
                        </div>
                        <div className="space-y-1">
                          {(group.files ?? []).map((file) => (
                            <p
                              key={file.id ?? file.path}
                              className="text-xs text-secondary font-mono truncate"
                            >
                              {file.path}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleScan}>
                    Scan Again
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-line">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
