import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with conflict resolution.
 * Combines clsx for conditionals and tailwind-merge for deduplication.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
