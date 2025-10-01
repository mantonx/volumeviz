import type { Meta, StoryObj } from '@storybook/react';
import { PreviewImage } from './PreviewImage';

const meta: Meta<typeof PreviewImage> = {
  title: 'Components/Preview/PreviewImage',
  component: PreviewImage,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'PreviewImage component displays optimized WebP thumbnails with lazy loading, blur-up placeholders, and progressive enhancement.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
    lazy: {
      control: 'boolean',
    },
    showBlurUp: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof PreviewImage>;

export const ImageThumbnail: Story = {
  args: {
    fileId: '1',
    fileName: 'vacation-photo.jpg',
    mediaType: 'image/jpeg',
    size: 'medium',
    lazy: false,
    showBlurUp: true,
  },
};

export const VideoPoster: Story = {
  args: {
    fileId: '2',
    fileName: 'movie-trailer.mp4',
    mediaType: 'video/mp4',
    size: 'medium',
    lazy: false,
    showBlurUp: true,
  },
};

export const AudioCover: Story = {
  args: {
    fileId: '3',
    fileName: 'song.mp3',
    mediaType: 'audio/mpeg',
    size: 'medium',
    lazy: false,
    showBlurUp: true,
  },
};

export const SmallSize: Story = {
  args: {
    fileId: '1',
    fileName: 'thumbnail.jpg',
    mediaType: 'image/jpeg',
    size: 'small',
    lazy: false,
    showBlurUp: false,
  },
};

export const LargeSize: Story = {
  args: {
    fileId: '1',
    fileName: 'hero-image.jpg',
    mediaType: 'image/jpeg',
    size: 'large',
    lazy: false,
    showBlurUp: true,
  },
};

export const UnsupportedFile: Story = {
  args: {
    fileId: '4',
    fileName: 'document.pdf',
    mediaType: 'application/pdf',
    size: 'medium',
    lazy: false,
    showBlurUp: false,
  },
};

export const WithLazyLoading: Story = {
  args: {
    fileId: '1',
    fileName: 'lazy-image.jpg',
    mediaType: 'image/jpeg',
    size: 'medium',
    lazy: true,
    showBlurUp: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Preview with lazy loading enabled. The image will only load when it enters the viewport.',
      },
    },
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-4 p-4">
      {[
        { id: '1', name: 'photo1.jpg', type: 'image/jpeg' },
        { id: '2', name: 'video1.mp4', type: 'video/mp4' },
        { id: '3', name: 'song1.mp3', type: 'audio/mpeg' },
        { id: '4', name: 'photo2.png', type: 'image/png' },
        { id: '5', name: 'video2.avi', type: 'video/avi' },
        { id: '6', name: 'song2.flac', type: 'audio/flac' },
        { id: '7', name: 'photo3.webp', type: 'image/webp' },
        { id: '8', name: 'video3.mov', type: 'video/quicktime' },
      ].map((file) => (
        <PreviewImage
          key={file.id}
          fileId={file.id}
          fileName={file.name}
          mediaType={file.type}
          size="medium"
          lazy={true}
          showBlurUp={true}
          className="aspect-square"
        />
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Gallery view showing multiple preview types with lazy loading and blur-up placeholders.',
      },
    },
  },
};
