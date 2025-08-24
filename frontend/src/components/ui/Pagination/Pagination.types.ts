export interface PaginationProps {
  /** Current page number (1-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Handler for page changes */
  onPageChange: (page: number) => void;
  /** Whether pagination is in loading state */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
}
