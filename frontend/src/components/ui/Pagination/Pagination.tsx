import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/utils';
import type { PaginationProps } from './Pagination.types';

/**
 * Pagination component for data lists
 * Handles page navigation with first/previous/next/last controls
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  loading = false,
  className,
}) => {
  if (totalPages <= 1) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to show (max 5 pages)
  const getPageNumbers = () => {
    const maxVisiblePages = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    // Adjust start if we're near the end
    if (end - start < maxVisiblePages - 1) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const pageNumbers = getPageNumbers();

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between">
        <div className="text-sm text-secondary">
          Showing {startItem} to {endItem} of {totalItems} items
        </div>

        <div className="flex items-center gap-2">
          {/* Previous button */}
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1 || loading}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {/* Show first page if not in range */}
            {pageNumbers[0] > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(1)}
                  className="w-10"
                  disabled={loading}
                  aria-label="Page 1"
                >
                  1
                </Button>
                {pageNumbers[0] > 2 && (
                  <span className="px-2 text-gray-400">...</span>
                )}
              </>
            )}

            {/* Page number buttons */}
            {pageNumbers.map((pageNum) => (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="w-10"
                disabled={loading}
                aria-label={`Page ${pageNum}`}
                aria-current={pageNum === currentPage ? 'page' : undefined}
              >
                {pageNum}
              </Button>
            ))}

            {/* Show last page if not in range */}
            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="px-2 text-gray-400">...</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(totalPages)}
                  className="w-10"
                  disabled={loading}
                  aria-label={`Page ${totalPages}`}
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          {/* Next button */}
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages || loading}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default Pagination;
