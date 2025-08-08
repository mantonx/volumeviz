/**
 * Chart export utilities for historical data visualization components.
 * Supports CSV, JSON, PNG, and SVG export formats.
 */

export interface ExportData {
  timestamp: string;
  [key: string]: any;
}

export interface ExportOptions {
  filename?: string;
  includeHeaders?: boolean;
  dateFormat?: 'iso' | 'short' | 'long';
  volumeNames?: Record<string, string>; // volumeId -> volumeName mapping
}

/**
 * Export chart data to CSV format
 */
export const exportToCSV = (
  data: ExportData[],
  options: ExportOptions = {},
) => {
  const {
    filename = 'chart-data.csv',
    includeHeaders = true,
    dateFormat = 'iso',
    volumeNames = {},
  } = options;

  if (!data.length) {
    console.warn('No data to export');
    return;
  }

  // Get all unique keys (columns)
  const allKeys = new Set<string>();
  data.forEach((row) => {
    Object.keys(row).forEach((key) => allKeys.add(key));
  });

  const columns = Array.from(allKeys);
  const csvContent: string[] = [];

  // Add headers if requested
  if (includeHeaders) {
    const headers = columns.map((col) => {
      // Clean up column names for better readability
      if (col === 'timestamp') return 'Date';
      if (col.includes('_size')) {
        const volumeId = col.replace('_size', '');
        return `${volumeNames[volumeId] || volumeId} Size (bytes)`;
      }
      if (col.includes('_rate')) {
        const volumeId = col.replace('_rate', '');
        return `${volumeNames[volumeId] || volumeId} Growth Rate (bytes/day)`;
      }
      if (col.includes('_percentage')) {
        const volumeId = col.replace('_percentage', '');
        return `${volumeNames[volumeId] || volumeId} Growth (%)`;
      }
      return col;
    });
    csvContent.push(headers.map((h) => `"${h}"`).join(','));
  }

  // Add data rows
  data.forEach((row) => {
    const values = columns.map((col) => {
      const value = row[col];

      if (col === 'timestamp') {
        // Format timestamp based on dateFormat option
        const date = new Date(value);
        switch (dateFormat) {
          case 'short':
            return `"${date.toLocaleDateString()}"`;
          case 'long':
            return `"${date.toLocaleString()}"`;
          default:
            return `"${value}"`;
        }
      }

      if (typeof value === 'number') {
        return value.toString();
      }

      if (value === undefined || value === null) {
        return '';
      }

      return `"${value}"`;
    });

    csvContent.push(values.join(','));
  });

  // Download the CSV
  const csvBlob = new Blob([csvContent.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlob(csvBlob, filename);
};

/**
 * Export chart data to JSON format
 */
export const exportToJSON = (
  data: ExportData[],
  options: ExportOptions = {},
) => {
  const { filename = 'chart-data.json', volumeNames = {} } = options;

  if (!data.length) {
    console.warn('No data to export');
    return;
  }

  // Clean up and format the data
  const formattedData = data.map((row) => {
    const cleanRow: any = {};

    Object.entries(row).forEach(([key, value]) => {
      if (key === 'timestamp') {
        cleanRow.date = value;
        cleanRow.timestamp = new Date(value).toISOString();
      } else if (key.includes('_size')) {
        const volumeId = key.replace('_size', '');
        const volumeName = volumeNames[volumeId] || volumeId;
        cleanRow[`${volumeName}_size_bytes`] = value;
      } else if (key.includes('_rate')) {
        const volumeId = key.replace('_rate', '');
        const volumeName = volumeNames[volumeId] || volumeId;
        cleanRow[`${volumeName}_growth_rate_bytes_per_day`] = value;
      } else if (key.includes('_percentage')) {
        const volumeId = key.replace('_percentage', '');
        const volumeName = volumeNames[volumeId] || volumeId;
        cleanRow[`${volumeName}_growth_percentage`] = value;
      } else {
        cleanRow[key] = value;
      }
    });

    return cleanRow;
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    dataPoints: formattedData.length,
    timeRange: {
      start: data[0]?.timestamp,
      end: data[data.length - 1]?.timestamp,
    },
    data: formattedData,
  };

  const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(jsonBlob, filename);
};

/**
 * Export chart as PNG image
 * Note: This requires the chart to be rendered in a canvas or SVG
 */
export const exportToPNG = (
  chartElement: HTMLElement,
  options: ExportOptions = {},
) => {
  const { filename = 'chart.png' } = options;

  // Find SVG element within the chart
  const svgElement = chartElement.querySelector('svg');
  if (!svgElement) {
    console.error('No SVG element found in chart');
    return;
  }

  // Convert SVG to PNG using canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get canvas context');
    return;
  }

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const img = new Image();

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, filename);
      }
    }, 'image/png');
  };

  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  img.src = url;
};

/**
 * Export chart as SVG
 */
export const exportToSVG = (
  chartElement: HTMLElement,
  options: ExportOptions = {},
) => {
  const { filename = 'chart.svg' } = options;

  const svgElement = chartElement.querySelector('svg');
  if (!svgElement) {
    console.error('No SVG element found in chart');
    return;
  }

  // Clone the SVG and ensure it has proper styling
  const clonedSvg = svgElement.cloneNode(true) as SVGElement;

  // Add inline styles for better compatibility
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const svgData = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });

  downloadBlob(svgBlob, filename);
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
 * Export options for different chart types
 */
export const getDefaultExportOptions = (chartType: string): ExportOptions => {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return {
    filename: `${chartType}-${timestamp}`,
    includeHeaders: true,
    dateFormat: 'iso',
  };
};

/**
 * Batch export multiple formats
 */
export const exportMultipleFormats = (
  data: ExportData[],
  chartElement: HTMLElement,
  formats: ('csv' | 'json' | 'png' | 'svg')[],
  options: ExportOptions = {},
) => {
  formats.forEach((format) => {
    const formatOptions = {
      ...options,
      filename: options.filename
        ? `${options.filename}.${format}`
        : `chart-export-${Date.now()}.${format}`,
    };

    switch (format) {
      case 'csv':
        exportToCSV(data, formatOptions);
        break;
      case 'json':
        exportToJSON(data, formatOptions);
        break;
      case 'png':
        exportToPNG(chartElement, formatOptions);
        break;
      case 'svg':
        exportToSVG(chartElement, formatOptions);
        break;
    }
  });
};
