import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/utils';
import type { ToastProps } from './Toast.types';

const variantStyles = {
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300',
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300',
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
};

const variantIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export const Toast: React.FC<ToastProps> = ({
  id,
  message,
  variant = 'info',
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const Icon = variantIcons[variant];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.(id);
    }, 300);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-start p-4 border rounded-lg shadow-lg max-w-md w-full transition-all duration-300 ease-in-out',
        variantStyles[variant],
        isAnimating ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mr-3">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 text-sm font-medium">
        {message}
      </div>
      <button
        onClick={handleClose}
        className={cn(
          'flex-shrink-0 ml-3 inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors',
          variant === 'success' && 'text-green-500 hover:bg-green-100 focus:ring-green-600 dark:hover:bg-green-800',
          variant === 'error' && 'text-red-500 hover:bg-red-100 focus:ring-red-600 dark:hover:bg-red-800',
          variant === 'warning' && 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600 dark:hover:bg-yellow-800',
          variant === 'info' && 'text-blue-500 hover:bg-blue-100 focus:ring-blue-600 dark:hover:bg-blue-800'
        )}
        aria-label="Close toast"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};