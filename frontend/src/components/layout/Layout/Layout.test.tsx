import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Provider } from 'jotai';
import { Layout } from './Layout';

// Mock the Header and Sidebar components
vi.mock('../Header', () => ({
  Header: ({ sidebarOpen, setSidebarOpen }: any) => (
    <div data-testid="header">
      <button onClick={() => setSidebarOpen(!sidebarOpen)}>
        Toggle Sidebar
      </button>
      <span>Sidebar Open: {sidebarOpen ? 'true' : 'false'}</span>
    </div>
  ),
}));

vi.mock('../Sidebar', () => ({
  Sidebar: ({ open, onClose }: any) => (
    <div data-testid="sidebar">
      <span>Sidebar Visible: {open ? 'true' : 'false'}</span>
      <button onClick={onClose}>Close Sidebar</button>
    </div>
  ),
}));

describe('Layout', () => {
  beforeEach(() => {
    // Reset document classes before each test
    document.documentElement.className = '';
  });

  it('renders children content correctly', () => {
    render(
      <Provider>
        <Layout>
          <div>Test Page Content</div>
        </Layout>
      </Provider>,
    );

    expect(screen.getByText('Test Page Content')).toBeInTheDocument();
  });

  it('renders header and sidebar components', () => {
    render(
      <Provider>
        <Layout>Content</Layout>
      </Provider>,
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('manages sidebar open/close state correctly', () => {
    render(
      <Provider>
        <Layout>Content</Layout>
      </Provider>,
    );

    // Initially sidebar should be closed
    expect(screen.getByText('Sidebar Open: false')).toBeInTheDocument();
    expect(screen.getByText('Sidebar Visible: false')).toBeInTheDocument();

    // Toggle sidebar open
    fireEvent.click(screen.getByText('Toggle Sidebar'));
    expect(screen.getByText('Sidebar Open: true')).toBeInTheDocument();
    expect(screen.getByText('Sidebar Visible: true')).toBeInTheDocument();

    // Close sidebar
    fireEvent.click(screen.getByText('Close Sidebar'));
    expect(screen.getByText('Sidebar Visible: false')).toBeInTheDocument();
  });

  it('applies custom className to main content area', () => {
    render(
      <Provider>
        <Layout className="custom-spacing">
          <div>Content</div>
        </Layout>
      </Provider>,
    );

    const mainElement = screen.getByRole('main');
    expect(mainElement).toHaveClass('custom-spacing');
  });

  it('applies base layout structure classes', () => {
    render(
      <Provider>
        <Layout>Content</Layout>
      </Provider>,
    );

    // Check for main layout container
    const layoutContainer = screen
      .getByText('Content')
      .closest('.min-h-screen');
    expect(layoutContainer).toHaveClass(
      'min-h-screen',
      'bg-gray-50',
      'dark:bg-gray-900',
    );

    // Check for content area with sidebar margin
    const contentArea = screen.getByText('Content').closest('.lg\\:pl-72');
    expect(contentArea).toHaveClass('lg:pl-72');

    // Check for main content padding
    const mainElement = screen.getByRole('main');
    expect(mainElement).toHaveClass('py-6');

    const contentContainer = screen.getByText('Content').parentElement;
    expect(contentContainer).toHaveClass('px-4', 'sm:px-6', 'lg:px-8');
  });
});
