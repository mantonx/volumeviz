/**
 * Delete Volume Modal Component
 *
 * Confirms permanent deletion of one or more real Docker volumes. This is
 * irreversible — unlike the other bulk actions in this app (scan, track,
 * untrack), there's no undo, so the confirmation is deliberately higher
 * friction: the user must type "delete" to enable the confirm button, and
 * every volume name (not just a count) is listed so nothing gets removed
 * that the user didn't see named.
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/utils/formatters';

export interface DeleteVolumeModalVolume {
  name: string;
  size_bytes?: number;
}

export interface DeleteVolumeFailure {
  volume_id: string;
  error: string;
}

export interface DeleteVolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  volumes: DeleteVolumeModalVolume[];
  isDeleting?: boolean;
  /** Per-volume failures from a completed bulk-delete call, shown distinctly
   * from the volumes that succeeded rather than a single pass/fail result. */
  failures?: DeleteVolumeFailure[];
}

const CONFIRM_WORD = 'delete';

export const DeleteVolumeModal: React.FC<DeleteVolumeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  volumes,
  isDeleting = false,
  failures = [],
}) => {
  const [confirmText, setConfirmText] = useState('');

  const totalSize = useMemo(
    () => volumes.reduce((sum, v) => sum + (v.size_bytes || 0), 0),
    [volumes],
  );

  const isConfirmEnabled =
    confirmText.trim().toLowerCase() === CONFIRM_WORD && !isDeleting;

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  const handleConfirm = () => {
    if (!isConfirmEnabled) return;
    onConfirm();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      animation="scale"
      closable={!isDeleting}
      closeOnEscape={!isDeleting}
      closeOnOutsideClick={!isDeleting}
      header={{ title: `Delete ${volumes.length} Volume${volumes.length !== 1 ? 's' : ''}` }}
      testId="delete-volume-modal"
      footer={{
        align: 'right',
        secondaryAction: (
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
        ),
        primaryAction: (
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
          >
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        ),
      }}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-200">
              This permanently deletes real Docker volume data.
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              This cannot be undone. Volumes still attached to a running
              container will be rejected automatically and left untouched.
            </p>
          </div>
        </div>

        <div className="bg-surface-secondary rounded-md p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-secondary">Volumes to delete:</span>
            <span className="font-medium text-primary">{volumes.length}</span>
          </div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-secondary">Space to be freed:</span>
            <span className="font-medium text-primary">
              {formatBytes(totalSize)}
            </span>
          </div>
          <ul className="max-h-40 overflow-y-auto space-y-1 text-sm font-mono border-t border-line pt-3">
            {volumes.map((v) => (
              <li key={v.name} className="text-primary truncate" title={v.name}>
                {v.name}
              </li>
            ))}
          </ul>
        </div>

        {failures.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-md p-4">
            <p className="text-sm font-medium text-orange-900 dark:text-orange-200 mb-2">
              {failures.length} volume{failures.length !== 1 ? 's' : ''} could
              not be deleted:
            </p>
            <ul className="space-y-1 text-sm text-orange-700 dark:text-orange-300">
              {failures.map((f) => (
                <li key={f.volume_id}>
                  <span className="font-mono">{f.volume_id}</span>: {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label
            htmlFor="delete-confirm-input"
            className="block text-sm font-medium text-primary mb-1"
          >
            Type <span className="font-mono font-semibold">delete</span> to
            confirm
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isDeleting}
            autoComplete="off"
            className="w-full px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed bg-surface text-primary"
            placeholder={CONFIRM_WORD}
          />
        </div>
      </div>
    </Modal>
  );
};
