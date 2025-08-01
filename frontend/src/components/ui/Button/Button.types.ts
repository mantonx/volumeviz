import React from 'react';

/**
 * Button component variant types
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive';

/**
 * Button component size types
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props for the Button component
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Icon to display on the left side of the button */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side of the button */
  rightIcon?: React.ReactNode;
  /** Additional CSS classes to apply */
  className?: string;
  /** Button content */
  children?: React.ReactNode;
}
