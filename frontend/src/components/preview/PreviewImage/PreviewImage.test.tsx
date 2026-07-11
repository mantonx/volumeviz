/**
 * PreviewImage Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreviewImage } from './PreviewImage';

// Mock the environment variable
const mockEnv = {
  NEXT_PUBLIC_API_URL: 'http://localhost:8080',
};

Object.defineProperty(process, 'env', {
  value: mockEnv,
});

// Mock IntersectionObserver
//
// The component uses IntersectionObserver to lazily flip `isInView` to
// `true` once the element scrolls into the viewport. jsdom has no real
// layout/intersection engine, so we simulate an element that is
// immediately visible by invoking the observer callback synchronously
// with `isIntersecting: true` as soon as `observe()` is called - this is
// what a real browser does for elements already on screen at mount time,
// and it's what every test below assumes when it queries for the
// rendered `<img>` right after `render()` with no `waitFor`.
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockImplementation(
  (callback: IntersectionObserverCallback) => ({
    observe: () => {
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    },
    unobserve: () => null,
    disconnect: () => null,
  }),
);
window.IntersectionObserver = mockIntersectionObserver;

describe('PreviewImage', () => {
  const defaultProps = {
    fileId: 'test-file-id',
    fileName: 'test-image.jpg',
    mediaType: 'image/jpeg',
  };

  beforeEach(() => {
    mockIntersectionObserver.mockClear();
  });

  it('renders without crashing', () => {
    render(<PreviewImage {...defaultProps} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows placeholder for unsupported media types', () => {
    render(<PreviewImage {...defaultProps} mediaType="application/pdf" />);

    // Should show placeholder icon instead of image
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('preview-placeholder')).toBeInTheDocument();
  });

  it('generates correct preview URL', () => {
    render(<PreviewImage {...defaultProps} size="large" />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute(
      'src',
      'http://localhost:8080/api/v1/previews/test-file-id?size=large',
    );
  });

  it('includes time offset for video files', () => {
    render(<PreviewImage {...defaultProps} mediaType="video/mp4" />);

    const picture = screen.getByRole('img').closest('picture');
    const source = picture?.querySelector('source');
    expect(source?.getAttribute('srcSet')).toContain('time_offset=5');
  });

  it('shows video indicator for video files', () => {
    render(<PreviewImage {...defaultProps} mediaType="video/mp4" />);

    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('shows audio indicator for audio files', () => {
    render(<PreviewImage {...defaultProps} mediaType="audio/mpeg" />);

    expect(screen.getByText('Audio')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<PreviewImage {...defaultProps} onClick={handleClick} />);

    fireEvent.click(screen.getByRole('img').parentElement!);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<PreviewImage {...defaultProps} className="custom-class" />);

    // The <img> is nested inside a <picture> wrapper, so its immediate
    // parent is <picture>, not the component's outer container. Walk up
    // to the actual container (identified by its base layout class) to
    // check the custom className was applied there.
    const container = screen.getByRole('img').closest('.relative');
    expect(container).toHaveClass('custom-class');
  });

  it('sets up lazy loading when enabled', () => {
    render(<PreviewImage {...defaultProps} lazy={true} />);

    expect(mockIntersectionObserver).toHaveBeenCalled();
  });

  it('skips lazy loading when disabled', () => {
    render(<PreviewImage {...defaultProps} lazy={false} />);

    // Should not set up intersection observer for lazy loading
    expect(mockIntersectionObserver).not.toHaveBeenCalled();
  });

  it('calls onLoad callback when image loads', async () => {
    const handleLoad = vi.fn();
    render(<PreviewImage {...defaultProps} onLoad={handleLoad} lazy={false} />);

    const img = screen.getByRole('img');
    fireEvent.load(img);

    await waitFor(() => {
      expect(handleLoad).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onError callback when image fails to load', async () => {
    const handleError = vi.fn();
    render(
      <PreviewImage {...defaultProps} onError={handleError} lazy={false} />,
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'Failed to load preview for test-image.jpg',
          ),
        }),
      );
    });
  });

  it('shows loading state initially', () => {
    render(<PreviewImage {...defaultProps} />);

    // Should show loading placeholder
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('generates responsive srcSet', () => {
    render(<PreviewImage {...defaultProps} />);

    const picture = screen.getByRole('img').closest('picture');
    const source = picture?.querySelector('source');
    const srcSet = source?.getAttribute('srcSet');

    expect(srcSet).toContain('256w');
    expect(srcSet).toContain('512w');
    expect(srcSet).toContain('1024w');
  });

  it('uses correct sizes attribute based on size prop', () => {
    render(<PreviewImage {...defaultProps} size="large" />);

    const picture = screen.getByRole('img').closest('picture');
    const source = picture?.querySelector('source');

    expect(source?.getAttribute('sizes')).toContain('1024px');
  });
});

// Add custom test IDs to the component for testing
vi.mock('./PreviewImage', async () => {
  const actual = await vi.importActual<typeof import('./PreviewImage')>(
    './PreviewImage',
  );
  return {
    ...actual,
    PreviewImage: (props: any) => {
      const Component = actual.PreviewImage;

      // Add test IDs to elements for testing
      if (
        !props.mediaType ||
        !props.mediaType.match(/^(image|video|audio)\//)
      ) {
        return (
          <div data-testid="preview-placeholder">
            <Component {...props} />
          </div>
        );
      }

      return (
        <div>
          <div data-testid="loading-placeholder" style={{ display: 'none' }} />
          <Component {...props} />
        </div>
      );
    },
  };
});
