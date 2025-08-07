import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <h2>Volume Information</h2>
        <p>This is card content</p>
      </Card>,
    );

    expect(screen.getByText('Volume Information')).toBeInTheDocument();
    expect(screen.getByText('This is card content')).toBeInTheDocument();
  });

  it('applies default card styling', () => {
    render(<Card data-testid="card">Card content</Card>);

    const card = screen.getByTestId('card');
    expect(card).toHaveClass(
      'rounded-lg',
      'border',
      'border-gray-200',
      'bg-white',
      'shadow-sm',
    );
  });

  it('applies dark mode classes', () => {
    render(<Card data-testid="card">Card content</Card>);

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('dark:border-gray-700', 'dark:bg-gray-800');
  });

  it('accepts custom className', () => {
    render(
      <Card className="custom-padding p-6" data-testid="card">
        Content
      </Card>,
    );

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-padding', 'p-6');
  });

  it('forwards HTML attributes', () => {
    render(
      <Card data-testid="custom-card" role="article">
        Article content
      </Card>,
    );

    const card = screen.getByTestId('custom-card');
    expect(card).toHaveAttribute('role', 'article');
  });

  it('handles complex nested content', () => {
    render(
      <Card>
        <div className="card-header">
          <h3>Volume: my-volume</h3>
        </div>
        <div className="card-body">
          <p>Driver: local</p>
          <p>Size: 1.5 GB</p>
        </div>
      </Card>,
    );

    expect(screen.getByText('Volume: my-volume')).toBeInTheDocument();
    expect(screen.getByText('Driver: local')).toBeInTheDocument();
    expect(screen.getByText('Size: 1.5 GB')).toBeInTheDocument();
  });
});
