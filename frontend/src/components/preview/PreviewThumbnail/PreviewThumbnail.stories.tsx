import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { PreviewThumbnail } from './PreviewThumbnail';
import { action } from '@/utils/storybook-utils';

const meta: Meta<typeof PreviewThumbnail> = {
  title: 'Components/Preview/PreviewThumbnail',
  component: PreviewThumbnail,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A thumbnail preview component that displays file previews with lazy loading and fallback icons.

## Features
- Lazy loading with intersection observer
- Responsive image srcset for different contexts
- Blur-up placeholder effect
- Fallback to file type icons when preview unavailable
- Multiple size and context variants
- Media type indicators for video/audio files
- Keyboard accessible
- Error handling and retry logic

## Usage
\`\`\`tsx
import { PreviewThumbnail } from '@/components/preview/PreviewThumbnail';
import { action } from '@/utils/storybook-utils';

<PreviewThumbnail
  fileId={123}
  fileName="document.pdf"
  mimeType="application/pdf"
  size="medium"
  context="grid"
  onClick={handlePreview}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    fileId: {
      control: { type: 'number' },
      description: 'Unique file identifier',
    },
    fileName: {
      control: { type: 'text' },
      description: 'File name for accessibility and fallback',
    },
    mimeType: {
      control: { type: 'text' },
      description: 'MIME type of the file',
    },
    mediaKind: {
      control: { type: 'text' },
      description: 'Media classification (image, video, document, etc.)',
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      description: 'Preview image size variant',
    },
    context: {
      control: { type: 'select' },
      options: ['grid', 'list', 'detail'],
      description: 'Display context affecting dimensions',
    },
    lazy: {
      control: { type: 'boolean' },
      description: 'Enable lazy loading',
    },
    showBlurUp: {
      control: { type: 'boolean' },
      description: 'Show blur placeholder while loading',
    },
    onClick: {
      action: 'thumbnail-clicked',
      description: 'Click handler for thumbnail interaction',
    },
  },
  args: {
    onClick: action('thumbnail-clicked'),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    fileId: 1,
    fileName: 'landscape.jpg',
    mimeType: 'image/jpeg',
    mediaKind: 'image',
    size: 'medium',
    context: 'list',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      <div className="text-center">
        <PreviewThumbnail
          fileId={1}
          fileName="sample.jpg"
          mimeType="image/jpeg"
          size="small"
          context="list"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Small</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={1}
          fileName="sample.jpg"
          mimeType="image/jpeg"
          size="medium"
          context="list"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Medium</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={1}
          fileName="sample.jpg"
          mimeType="image/jpeg"
          size="large"
          context="list"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Large</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Different size variants affecting the preview image resolution.',
      },
    },
  },
};

export const Contexts: Story = {
  render: () => (
    <div className="flex items-end gap-8">
      <div className="text-center">
        <PreviewThumbnail
          fileId={1}
          fileName="photo.jpg"
          mimeType="image/jpeg"
          context="list"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">List</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={1}
          fileName="photo.jpg"
          mimeType="image/jpeg"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Grid</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={1}
          fileName="photo.jpg"
          mimeType="image/jpeg"
          context="detail"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Detail</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Different display contexts with varying dimensions and responsive behavior.',
      },
    },
    layout: 'padded',
  },
};

export const FileTypeFallbacks: Story = {
  render: () => (
    <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
      <div className="text-center">
        <PreviewThumbnail
          fileId={0} // Non-existent to trigger fallback
          fileName="document.pdf"
          mimeType="application/pdf"
          mediaKind="document"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">PDF</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={0}
          fileName="video.mp4"
          mimeType="video/mp4"
          mediaKind="video"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Video</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={0}
          fileName="audio.mp3"
          mimeType="audio/mpeg"
          mediaKind="audio"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Audio</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={0}
          fileName="archive.zip"
          mimeType="application/zip"
          mediaKind="archive"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Archive</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={0}
          fileName="code.js"
          mimeType="text/javascript"
          mediaKind="code"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Code</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={0}
          fileName="spreadsheet.xlsx"
          mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          mediaKind="spreadsheet"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Spreadsheet</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={0}
          fileName="presentation.pptx"
          mimeType="application/vnd.openxmlformats-officedocument.presentationml.presentation"
          mediaKind="presentation"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Presentation</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={0}
          fileName="text.txt"
          mimeType="text/plain"
          mediaKind="text"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Text</p>
      </div>
      <div className="text-center">
        <PreviewThumbnail
          fileId={0}
          fileName="unknown.xyz"
          mimeType="application/octet-stream"
          context="grid"
          lazy={false}
        />
        <p className="text-xs text-gray-500 mt-2">Unknown</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Fallback icons for different file types when previews are not available.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Clickable Thumbnails</h3>
        <div className="grid grid-cols-4 gap-4">
          <PreviewThumbnail
            fileId={1}
            fileName="photo1.jpg"
            mimeType="image/jpeg"
            context="grid"
            onClick={action('photo1-clicked')}
            lazy={false}
          />
          <PreviewThumbnail
            fileId={2}
            fileName="photo2.jpg"
            mimeType="image/jpeg"
            context="grid"
            onClick={action('photo2-clicked')}
            lazy={false}
          />
          <PreviewThumbnail
            fileId={0}
            fileName="video.mp4"
            mimeType="video/mp4"
            context="grid"
            onClick={action('video-clicked')}
            lazy={false}
          />
          <PreviewThumbnail
            fileId={0}
            fileName="document.pdf"
            mimeType="application/pdf"
            context="grid"
            onClick={action('document-clicked')}
            lazy={false}
          />
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p>Click on any thumbnail to trigger the onClick handler.</p>
        <p>
          Thumbnails are keyboard accessible - try using Tab and Enter/Space.
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Interactive thumbnails with click handlers and keyboard accessibility.',
      },
    },
  },
};

export const MediaIndicators: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Media Type Indicators</h3>
        <div className="flex gap-6">
          <div className="text-center">
            <PreviewThumbnail
              fileId={1}
              fileName="movie.mp4"
              mimeType="video/mp4"
              mediaKind="video"
              context="grid"
              lazy={false}
            />
            <p className="text-xs text-gray-500 mt-2">Video (▶ indicator)</p>
          </div>
          <div className="text-center">
            <PreviewThumbnail
              fileId={1}
              fileName="song.mp3"
              mimeType="audio/mpeg"
              mediaKind="audio"
              context="grid"
              lazy={false}
            />
            <p className="text-xs text-gray-500 mt-2">Audio (♪ indicator)</p>
          </div>
          <div className="text-center">
            <PreviewThumbnail
              fileId={1}
              fileName="image.jpg"
              mimeType="image/jpeg"
              mediaKind="image"
              context="grid"
              lazy={false}
            />
            <p className="text-xs text-gray-500 mt-2">Image (no indicator)</p>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p>
          Video and audio files show small indicators in the top-right corner
          when previews are available.
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Media type indicators that appear on video and audio thumbnails.',
      },
    },
  },
};

export const LoadingStates: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Loading States</h3>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="w-32 h-32 relative overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Loading spinner</p>
          </div>
          <div className="text-center">
            <div className="w-32 h-32 relative overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
              <div className="absolute inset-0 w-full h-full object-cover filter blur-sm bg-gradient-to-br from-gray-200 to-gray-300"></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Blur placeholder</p>
          </div>
          <div className="text-center">
            <PreviewThumbnail
              fileId={0}
              fileName="fallback.jpg"
              mimeType="image/jpeg"
              context="grid"
              lazy={false}
            />
            <p className="text-xs text-gray-500 mt-2">Fallback icon</p>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p>
          Different states during the loading process: spinner → blur
          placeholder → final image or fallback icon.
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Visual representation of different loading states and transitions.',
      },
    },
  },
};

export const GridLayout: Story = {
  render: () => {
    const mockFiles = [
      { id: 1, name: 'photo1.jpg', type: 'image/jpeg', kind: 'image' },
      { id: 2, name: 'photo2.jpg', type: 'image/jpeg', kind: 'image' },
      { id: 0, name: 'video.mp4', type: 'video/mp4', kind: 'video' },
      {
        id: 0,
        name: 'document.pdf',
        type: 'application/pdf',
        kind: 'document',
      },
      { id: 0, name: 'music.mp3', type: 'audio/mpeg', kind: 'audio' },
      { id: 0, name: 'archive.zip', type: 'application/zip', kind: 'archive' },
      {
        id: 0,
        name: 'spreadsheet.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        kind: 'spreadsheet',
      },
      { id: 0, name: 'code.js', type: 'text/javascript', kind: 'code' },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">File Grid Layout</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {mockFiles.map((file, index) => (
              <div key={index} className="text-center">
                <PreviewThumbnail
                  fileId={file.id}
                  fileName={file.name}
                  mimeType={file.type}
                  mediaKind={file.kind}
                  context="grid"
                  onClick={action(`clicked-${file.name}`)}
                  lazy={false}
                />
                <p className="text-xs text-gray-500 mt-2 truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Example of thumbnails arranged in a responsive grid layout.',
      },
    },
    layout: 'padded',
  },
};
