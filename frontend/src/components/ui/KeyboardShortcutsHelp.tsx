/**
 * Keyboard Shortcuts Help Modal
 * Reusable component to display keyboard shortcuts in a clean, organized way
 */

import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils';
import type { KeyboardShortcutGroup } from '@/utils/keyboardShortcuts';
import { formatShortcut, getAllShortcuts } from '@/utils/keyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcutGroups: KeyboardShortcutGroup[];
  title?: string;
  className?: string;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  shortcutGroups,
  title = 'Keyboard Shortcuts',
  className,
}) => {
  if (!isOpen) return null;

  const enabledGroups = shortcutGroups.filter(group => group.shortcuts.length > 0);
  const totalShortcuts = getAllShortcuts(enabledGroups).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <Card className={cn(
        "relative w-full max-w-4xl max-h-[90vh] m-4 overflow-hidden",
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Keyboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {totalShortcuts} shortcuts available
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            aria-label="Close shortcuts help"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {enabledGroups.map((group) => (
              <div key={group.name} className="space-y-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {group.name}
                  </h3>
                  {group.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {group.description}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={`${group.name}-${index}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                      >
                        {formatShortcut(shortcut)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Tip:</strong> Shortcuts work when not focused on input fields. 
              Press <Badge variant="secondary" className="mx-1 font-mono">?</Badge> anytime to show this help.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

/**
 * Compact shortcuts display for inline help
 */
interface InlineShortcutsProps {
  shortcuts: string[];
  className?: string;
}

export const InlineShortcuts: React.FC<InlineShortcutsProps> = ({
  shortcuts,
  className,
}) => {
  if (shortcuts.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400", className)}>
      <span className="hidden lg:inline">Shortcuts:</span>
      {shortcuts.map((shortcut, index) => (
        <React.Fragment key={shortcut}>
          {index > 0 && <span className="text-gray-300 dark:text-gray-600">•</span>}
          <Badge variant="secondary" className="font-mono text-xs px-1 py-0">
            {shortcut}
          </Badge>
        </React.Fragment>
      ))}
    </div>
  );
};