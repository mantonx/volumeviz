import React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/utils';

interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  className,
  id,
  'aria-label': ariaLabel,
}) => {
  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 border-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        checked || indeterminate
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:border-blue-500',
        className
      )}
    >
      {indeterminate ? (
        <Minus className="w-3 h-3" />
      ) : checked ? (
        <Check className="w-3 h-3" />
      ) : null}
    </button>
  );
};