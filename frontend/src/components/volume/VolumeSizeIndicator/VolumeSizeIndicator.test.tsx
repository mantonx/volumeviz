import React from 'react';
import { render, screen } from '@testing-library/react';
import { VolumeSizeIndicator } from './VolumeSizeIndicator';

describe('VolumeSizeIndicator', () => {
  it('renders bar variant by default', () => {
    render(<VolumeSizeIndicator size={1073741824} />);

    expect(screen.getByText('1.00 GB')).toBeInTheDocument();
  });

  it('renders compact variant', () => {
    render(<VolumeSizeIndicator size={268435456} variant="compact" />);

    expect(screen.getByText('256.00 MB')).toBeInTheDocument();
  });

  it('shows percentage when maxSize is provided', () => {
    render(
      <VolumeSizeIndicator
        size={5368709120}
        maxSize={10737418240}
        variant="bar"
      />,
    );

    expect(screen.getByText('50% of 10.00 GB')).toBeInTheDocument();
  });

  it('renders circle variant', () => {
    render(
      <VolumeSizeIndicator
        size={2147483648}
        maxSize={10737418240}
        variant="circle"
      />,
    );

    expect(screen.getByText('2.00 GB')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('applies status color scheme', () => {
    const { container } = render(
      <VolumeSizeIndicator
        size={9663676416} // 90% of 10GB
        maxSize={10737418240}
        colorScheme="status"
      />,
    );

    // Should have red color for 90% usage
    const bar = container.querySelector('.bg-red-500');
    expect(bar).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<VolumeSizeIndicator size={1073741824} showLabel={false} />);

    expect(screen.queryByText('1.00 GB')).not.toBeInTheDocument();
  });

  it('hides icon when showIcon is false', () => {
    const { container } = render(
      <VolumeSizeIndicator size={1073741824} showIcon={false} />,
    );

    const icon = container.querySelector('svg[class*="lucide"]');
    expect(icon).not.toBeInTheDocument();
  });

  it('shows appropriate icon based on size', () => {
    const { rerender, container } = render(
      <VolumeSizeIndicator size={536870912} />, // 512MB
    );

    // Small size should show HardDrive icon
    expect(container.querySelector('svg')).toBeInTheDocument();

    // Large size should show Server icon
    rerender(<VolumeSizeIndicator size={21474836480} />); // 20GB
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies gradient color scheme', () => {
    const { container } = render(
      <VolumeSizeIndicator size={1073741824} colorScheme="gradient" />,
    );

    const bar = container.querySelector('.bg-gradient-to-r');
    expect(bar).toBeInTheDocument();
  });

  it('handles zero size', () => {
    render(<VolumeSizeIndicator size={0} />);

    expect(screen.getByText('0 B')).toBeInTheDocument();
  });
});
