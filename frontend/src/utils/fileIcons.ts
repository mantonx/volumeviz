/**
 * File Type Icons Utility
 *
 * Professional file type icon mappings for better visual hierarchy
 */

export interface FileIconInfo {
  icon: string;
  color: string;
  bgColor: string;
}

// Get file type icon based on media kind and mime type
export const getFileIcon = (
  mediaKind?: string,
  mimeType?: string,
  extension?: string,
): FileIconInfo => {
  // Video files
  if (mediaKind === 'video' || mimeType?.startsWith('video/')) {
    return {
      icon: '🎬',
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    };
  }

  // Audio files
  if (mediaKind === 'audio' || mimeType?.startsWith('audio/')) {
    return {
      icon: '🎵',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    };
  }

  // Image files
  if (mediaKind === 'image' || mimeType?.startsWith('image/')) {
    return {
      icon: '🖼️',
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    };
  }

  // Document files
  if (mediaKind === 'document' || mimeType?.startsWith('application/')) {
    // Specific document types
    if (mimeType?.includes('pdf')) {
      return {
        icon: '📄',
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
      };
    }
    if (mimeType?.includes('word') || mimeType?.includes('document')) {
      return {
        icon: '📝',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      };
    }
    if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) {
      return {
        icon: '📊',
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
      };
    }
    if (mimeType?.includes('presentation')) {
      return {
        icon: '📽️',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      };
    }

    return {
      icon: '📄',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    };
  }

  // Text files
  if (mimeType?.startsWith('text/')) {
    if (extension === 'md' || extension === 'markdown') {
      return {
        icon: '📑',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      };
    }
    if (extension === 'json') {
      return {
        icon: '🔧',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      };
    }
    return {
      icon: '📝',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    };
  }

  // Archive files
  if (
    mimeType?.includes('zip') ||
    mimeType?.includes('rar') ||
    mimeType?.includes('tar') ||
    extension === 'zip' ||
    extension === 'rar' ||
    extension === '7z' ||
    extension === 'tar'
  ) {
    return {
      icon: '📦',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    };
  }

  // Code files based on extension
  const codeExtensions = [
    'js',
    'ts',
    'jsx',
    'tsx',
    'py',
    'java',
    'cpp',
    'c',
    'cs',
    'php',
    'rb',
    'go',
    'rs',
  ];
  if (extension && codeExtensions.includes(extension)) {
    return {
      icon: '⚡',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    };
  }

  // Configuration files
  const configExtensions = ['yml', 'yaml', 'toml', 'ini', 'conf', 'config'];
  if (extension && configExtensions.includes(extension)) {
    return {
      icon: '⚙️',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    };
  }

  // Database files
  if (extension === 'db' || extension === 'sqlite' || extension === 'sql') {
    return {
      icon: '🗄️',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    };
  }

  // Default folder/file icon
  return {
    icon: '📁',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
  };
};

// Get file size badge color based on size
export const getFileSizeBadgeColor = (sizeBytes: number): string => {
  const mb = sizeBytes / (1024 * 1024);

  if (mb < 1) return 'bg-green-100 text-green-800';
  if (mb < 10) return 'bg-blue-100 text-blue-800';
  if (mb < 100) return 'bg-yellow-100 text-yellow-800';
  if (mb < 1000) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
};

// Get media kind badge color
export const getMediaKindBadgeColor = (mediaKind: string): string => {
  switch (mediaKind) {
    case 'video':
      return 'bg-red-100 text-red-800';
    case 'audio':
      return 'bg-purple-100 text-purple-800';
    case 'image':
      return 'bg-green-100 text-green-800';
    case 'document':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};
