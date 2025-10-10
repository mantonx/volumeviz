import { clsx } from 'clsx';
import { MoreHorizontal } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { DropdownItem, DropdownProps } from './Dropdown.types';

export const Dropdown: React.FC<DropdownProps> = ({
  items,
  trigger,
  className,
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (item: DropdownItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)}>
          {trigger}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            'text-tertiary',
            'hover:text-primary',
            'hover:bg-surface-hover',
            'active:bg-surface-secondary',
          )}
          aria-label="More actions"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      )}

      {isOpen && (
        <div
          className={clsx(
            'absolute top-full mt-1 py-1 bg-surface border border-line rounded-lg shadow-lg z-50 min-w-[160px]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                className={clsx(
                  'w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors',
                  'hover:bg-surface-hover',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  item.destructive
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-secondary',
                )}
              >
                {IconComponent && <IconComponent className="w-4 h-4" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
