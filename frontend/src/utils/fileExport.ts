/**
 * File export utilities for file listings and search results.
 * Supports CSV and JSON export formats with customizable options.
 */

export interface FileExportData {
  id?: number | string;
  name: string;
  path: string;
  size?: number;
  is_directory?: boolean;
  modified_time?: string;
  extension?: string;
  media_type?: string;
  [key: string]: any; // Allow additional properties
}

export interface FileExportOptions {
  filename?: string;
  includeHeaders?: boolean;
  columns?: string[]; // Specific columns to export
  customHeaders?: Record<string, string>; // Custom header names
  includeMetadata?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Format file size to human-readable string
 */
const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined || bytes === null) return 'N/A';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Format date to readable string
 */
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

/**
 * Escape CSV value (handle commas, quotes, newlines)
 */
const escapeCSVValue = (value: any): string => {
  if (value === undefined || value === null) return '';

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

/**
 * Export file listing to CSV format
 */
export const exportFilesToCSV = (
  files: FileExportData[],
  options: FileExportOptions = {},
) => {
  const {
    filename = `files-export-${Date.now()}.csv`,
    includeHeaders = true,
    columns,
    customHeaders = {},
    includeMetadata = false,
    metadata = {},
  } = options;

  if (!files.length) {
    console.warn('No files to export');
    return;
  }

  // Default columns if not specified
  const defaultColumns = ['name', 'path', 'size', 'type', 'modified_time'];
  const exportColumns = columns || defaultColumns;

  const csvContent: string[] = [];

  // Add headers
  if (includeHeaders) {
    const headers = exportColumns.map((col) => {
      // Use custom header if provided, otherwise format the column name
      if (customHeaders[col]) return customHeaders[col];

      switch (col) {
        case 'name': return 'Name';
        case 'path': return 'Path';
        case 'size': return 'Size';
        case 'is_directory': return 'Type';
        case 'modified_time': return 'Modified';
        case 'extension': return 'Extension';
        case 'media_type': return 'Media Type';
        default: return col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, ' ');
      }
    });
    csvContent.push(headers.map(escapeCSVValue).join(','));
  }

  // Add data rows
  files.forEach((file) => {
    const values = exportColumns.map((col) => {
      switch (col) {
        case 'size':
          return formatFileSize(file.size);
        case 'is_directory':
        case 'type':
          return file.is_directory ? 'Folder' : (file.extension || 'File');
        case 'modified_time':
          return formatDate(file.modified_time);
        default:
          return file[col];
      }
    });
    csvContent.push(values.map(escapeCSVValue).join(','));
  });

  // Add metadata as comments if requested
  if (includeMetadata && Object.keys(metadata).length > 0) {
    csvContent.push('');
    csvContent.push('# Metadata');
    Object.entries(metadata).forEach(([key, value]) => {
      csvContent.push(`# ${key}: ${value}`);
    });
  }

  // Download the file
  const blob = new Blob([csvContent.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
};

/**
 * Export file listing to JSON format
 */
export const exportFilesToJSON = (
  files: FileExportData[],
  options: FileExportOptions = {},
) => {
  const {
    filename = `files-export-${Date.now()}.json`,
    columns,
    includeMetadata = false,
    metadata = {},
  } = options;

  if (!files.length) {
    console.warn('No files to export');
    return;
  }

  // Filter to specific columns if requested
  let exportData = files;
  if (columns) {
    exportData = files.map((file) => {
      const filtered: any = {};
      columns.forEach((col) => {
        if (col in file) {
          filtered[col] = file[col];
        }
      });
      return filtered;
    });
  }

  const output: any = {
    exportedAt: new Date().toISOString(),
    count: files.length,
    files: exportData,
  };

  if (includeMetadata) {
    output.metadata = metadata;
  }

  const jsonBlob = new Blob([JSON.stringify(output, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(jsonBlob, filename.endsWith('.json') ? filename : `${filename}.json`);
};

/**
 * Utility function to trigger file download
 */
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export files in multiple formats
 */
export const exportFilesMultipleFormats = (
  files: FileExportData[],
  formats: ('csv' | 'json')[],
  options: FileExportOptions = {},
) => {
  formats.forEach((format) => {
    const formatOptions = {
      ...options,
      filename: options.filename
        ? `${options.filename}.${format}`
        : `files-export-${Date.now()}.${format}`,
    };

    switch (format) {
      case 'csv':
        exportFilesToCSV(files, formatOptions);
        break;
      case 'json':
        exportFilesToJSON(files, formatOptions);
        break;
    }
  });
};

/**
 * Get default export options for different contexts
 */
export const getDefaultFileExportOptions = (
  context: 'explorer' | 'search' | 'volume',
): FileExportOptions => {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  switch (context) {
    case 'explorer':
      return {
        filename: `explorer-files-${timestamp}`,
        includeHeaders: true,
        columns: ['name', 'path', 'size', 'is_directory', 'modified_time'],
      };
    case 'search':
      return {
        filename: `search-results-${timestamp}`,
        includeHeaders: true,
        columns: ['name', 'path', 'size', 'is_directory', 'modified_time', 'extension'],
      };
    case 'volume':
      return {
        filename: `volume-files-${timestamp}`,
        includeHeaders: true,
        columns: ['name', 'path', 'size', 'is_directory', 'modified_time', 'media_type'],
      };
    default:
      return {
        filename: `files-${timestamp}`,
        includeHeaders: true,
      };
  }
};
