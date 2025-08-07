import React from 'react';

/**
 * Props for the Card component extending HTML div attributes.
 *
 * Cards are container components used throughout VolumeViz for
 * consistent content presentation and grouping.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to display inside the card container */
  children: React.ReactNode;
}
