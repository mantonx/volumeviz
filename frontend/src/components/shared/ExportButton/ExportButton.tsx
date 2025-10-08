/**
 * ExportButton - Reusable export button with format selection
 */

import React, { useState } from 'react';
import { Download, FileText, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export interface ExportButtonProps {
  onExport: (format: 'csv' | 'json') => void;
  disabled?: boolean;
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  disabled = false,
  label = 'Export',
  variant = 'outline',
  size = 'md',
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleExport = (format: 'csv' | 'json') => {
    onExport(format);
    setIsModalOpen(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        className={className}
      >
        <Download className="h-4 w-4 mr-2" />
        {label}
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Export Data"
        size="sm"
      >
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Choose a format to export your data:
          </p>

          <div className="space-y-3">
            <button
              onClick={() => handleExport('csv')}
              className="w-full flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <FileText className="h-8 w-8 text-green-600 dark:text-green-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  CSV (Spreadsheet)
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Compatible with Excel, Google Sheets
                </div>
              </div>
            </button>

            <button
              onClick={() => handleExport('json')}
              className="w-full flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <FileJson className="h-8 w-8 text-blue-600 dark:text-blue-500" />
              <div className="text-left">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  JSON (Data Format)
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  For developers and data processing
                </div>
              </div>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
