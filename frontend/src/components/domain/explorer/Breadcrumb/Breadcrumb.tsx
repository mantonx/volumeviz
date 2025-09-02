import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronRight, Home, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/atoms/explorer';

export interface BreadcrumbProps {
  /** Breadcrumb items */
  items: BreadcrumbItem[];
  /** Called when a breadcrumb item is clicked */
  onItemClick?: (path: string) => void;
  /** Maximum number of visible items before overflow */
  maxVisibleItems?: number;
  /** Class name for the container */
  className?: string;
}

/**
 * Advanced breadcrumb component with overflow handling
 * Automatically collapses items into overflow menu when space is limited
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  onItemClick,
  maxVisibleItems = 5,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [itemWidths, setItemWidths] = useState<number[]>([]);
  const [showOverflow, setShowOverflow] = useState(false);

  // Calculate which items to show based on available width
  const { visibleItems, overflowItems } = useMemo(() => {
    if (items.length <= maxVisibleItems) {
      return { visibleItems: items, overflowItems: [] };
    }

    // Always show the first and last item
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const middleItems = items.slice(1, -1);

    // Calculate how many middle items we can fit
    const availableForMiddle = maxVisibleItems - 2; // Reserve space for first and last
    
    if (middleItems.length <= availableForMiddle) {
      return { visibleItems: items, overflowItems: [] };
    }

    // Show some middle items and put the rest in overflow
    const visibleMiddleItems = middleItems.slice(-availableForMiddle + 1);
    const overflowMiddleItems = middleItems.slice(0, -availableForMiddle + 1);

    return {
      visibleItems: [firstItem, ...visibleMiddleItems, lastItem],
      overflowItems: overflowMiddleItems,
    };
  }, [items, maxVisibleItems]);

  // Measure container width on resize
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setAvailableWidth(entry.contentRect.width);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleItemClick = (item: BreadcrumbItem) => {
    if (item.isClickable && onItemClick) {
      onItemClick(item.path);
    }
  };

  const handleOverflowClick = () => {
    setShowOverflow(!showOverflow);
  };

  return (
    <nav
      ref={containerRef}
      className={cn(
        'flex items-center space-x-1 text-sm text-muted-foreground overflow-hidden',
        className
      )}
      aria-label="Breadcrumb navigation"
    >
      {visibleItems.map((item, index) => (
        <React.Fragment key={`${item.path}-${index}`}>
          {index > 0 && overflowItems.length > 0 && index === 1 && (
            <>
              <BreadcrumbOverflowButton
                items={overflowItems}
                onItemClick={onItemClick}
                isOpen={showOverflow}
                onToggle={handleOverflowClick}
              />
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            </>
          )}
          
          <BreadcrumbItemComponent
            item={item}
            isLast={index === visibleItems.length - 1}
            onClick={() => handleItemClick(item)}
          />
          
          {index < visibleItems.length - 1 && (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

interface BreadcrumbItemComponentProps {
  item: BreadcrumbItem;
  isLast: boolean;
  onClick: () => void;
}

const BreadcrumbItemComponent: React.FC<BreadcrumbItemComponentProps> = ({
  item,
  isLast,
  onClick,
}) => {
  const isRoot = item.path === '/';
  
  return (
    <span
      className={cn(
        'flex items-center gap-1 truncate',
        item.isClickable && !isLast && 'hover:text-foreground cursor-pointer',
        isLast && 'text-foreground font-medium'
      )}
      onClick={item.isClickable && !isLast ? onClick : undefined}
      title={item.name}
    >
      {isRoot ? (
        <Home className="h-4 w-4 flex-shrink-0" />
      ) : (
        <span className="truncate">{item.name}</span>
      )}
    </span>
  );
};

interface BreadcrumbOverflowButtonProps {
  items: BreadcrumbItem[];
  onItemClick?: (path: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const BreadcrumbOverflowButton: React.FC<BreadcrumbOverflowButtonProps> = ({
  items,
  onItemClick,
  isOpen,
  onToggle,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  const handleItemClick = (item: BreadcrumbItem) => {
    if (item.isClickable && onItemClick) {
      onItemClick(item.path);
      onToggle(); // Close dropdown after selection
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded hover:bg-muted',
          isOpen && 'bg-muted'
        )}
        onClick={onToggle}
        aria-label={`Show ${items.length} hidden breadcrumb items`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 py-1 bg-popover border border-border rounded-md shadow-md min-w-[200px] max-w-[300px]">
          {items.map((item, index) => (
            <button
              key={`${item.path}-overflow-${index}`}
              type="button"
              className={cn(
                'w-full px-3 py-2 text-left text-sm hover:bg-muted truncate',
                item.isClickable && 'hover:text-foreground',
                !item.isClickable && 'cursor-default text-muted-foreground'
              )}
              onClick={() => handleItemClick(item)}
              disabled={!item.isClickable}
              title={item.name}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Breadcrumb;