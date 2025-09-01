/**
 * Common component prop interfaces for consistency across the design system
 */

import React from 'react';

/**
 * Standard size variants used across components
 */
export type StandardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Standard semantic variants used across components
 */
export type StandardVariant = 
  | 'default' 
  | 'primary' 
  | 'secondary' 
  | 'success' 
  | 'warning' 
  | 'error'
  | 'info';

/**
 * Standard loading state
 */
export interface LoadingProps {
  /** Whether the component is in a loading state */
  loading?: boolean;
  /** Custom loading text or element */
  loadingText?: React.ReactNode;
}

/**
 * Standard disabled state
 */
export interface DisabledProps {
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Standard className prop for style customization
 */
export interface ClassNameProps {
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * Standard size prop
 */
export interface SizeProps {
  /** Size of the component */
  size?: StandardSize;
}

/**
 * Standard variant prop
 */
export interface VariantProps {
  /** Visual variant of the component */
  variant?: StandardVariant;
}

/**
 * Standard icon props for components that support icons
 */
export interface IconProps {
  /** Icon to display on the left side */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side */
  rightIcon?: React.ReactNode;
}

/**
 * Base props that most interactive components should have
 */
export interface BaseComponentProps 
  extends ClassNameProps, 
          SizeProps, 
          VariantProps, 
          LoadingProps, 
          DisabledProps {
  /** Unique identifier for the component */
  id?: string;
  /** Test identifier for automated testing */
  'data-testid'?: string;
}

/**
 * Props for polymorphic components (components that can render as different elements)
 */
export interface PolymorphicProps<T extends React.ElementType = 'div'> {
  /** The element type to render as */
  as?: T;
}

/**
 * Complete polymorphic component props
 */
export type PolymorphicComponentProps<
  T extends React.ElementType,
  Props = {}
> = Props & 
  PolymorphicProps<T> & 
  Omit<React.ComponentPropsWithoutRef<T>, keyof Props | 'as'>;

/**
 * Ref type for polymorphic components
 */
export type PolymorphicRef<T extends React.ElementType> = 
  React.ComponentPropsWithRef<T>['ref'];