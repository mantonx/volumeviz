import { ExportOptions } from '../../../components/domain/explorer/ExportDialog';

export interface ExportContext {
  element: HTMLElement | SVGElement;
  data?: any;
  metadata?: Record<string, any>;
}

export class ExportService {
  async exportVisualization(
    options: ExportOptions,
    context: ExportContext,
  ): Promise<void> {
    switch (options.format) {
      case 'png':
        return this.exportToPNG(options, context);
      case 'pdf':
        return this.exportToPDF(options, context);
      case 'svg':
        return this.exportToSVG(options, context);
      case 'csv':
        return this.exportToCSV(options, context);
      case 'json':
        return this.exportToJSON(options, context);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private async exportToPNG(
    options: ExportOptions,
    context: ExportContext,
  ): Promise<void> {
    const { default: html2canvas } = await import('html2canvas');

    const canvas = await html2canvas(context.element as HTMLElement, {
      backgroundColor: options.transparent ? null : options.backgroundColor,
      width: options.width,
      height: options.height,
      scale: this.getScaleFromQuality(options.quality),
      useCORS: true,
    });

    const blob = await this.canvasToBlob(canvas, 'image/png');
    this.downloadBlob(blob, 'export.png');
  }

  private async exportToPDF(
    options: ExportOptions,
    context: ExportContext,
  ): Promise<void> {
    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(context.element as HTMLElement, {
      backgroundColor: options.backgroundColor || '#ffffff',
      width: options.width,
      height: options.height,
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

    if (options.includeMetadata && context.metadata) {
      pdf.setFontSize(10);
      pdf.text(
        `Generated: ${new Date().toISOString()}`,
        10,
        canvas.height - 20,
      );
    }

    pdf.save('export.pdf');
  }

  private async exportToSVG(
    options: ExportOptions,
    context: ExportContext,
  ): Promise<void> {
    let svgElement: SVGElement;

    if (context.element instanceof SVGElement) {
      svgElement = context.element.cloneNode(true) as SVGElement;
    } else {
      // Convert HTML to SVG using foreignObject
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const foreignObject = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'foreignObject',
      );

      svg.setAttribute('width', String(options.width || 1200));
      svg.setAttribute('height', String(options.height || 900));
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      foreignObject.setAttribute('width', '100%');
      foreignObject.setAttribute('height', '100%');
      foreignObject.appendChild(context.element.cloneNode(true));

      svg.appendChild(foreignObject);
      svgElement = svg;
    }

    // Add background if not transparent
    if (!options.transparent && options.backgroundColor) {
      const rect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect',
      );
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', options.backgroundColor);
      svgElement.insertBefore(rect, svgElement.firstChild);
    }

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    this.downloadBlob(blob, 'export.svg');
  }

  private async exportToCSV(
    options: ExportOptions,
    context: ExportContext,
  ): Promise<void> {
    if (!context.data) {
      throw new Error('No data available for CSV export');
    }

    let csvContent = '';

    if (Array.isArray(context.data)) {
      if (context.data.length > 0) {
        // Extract headers from first object
        const headers = Object.keys(context.data[0]);
        csvContent += headers.join(',') + '\n';

        // Add data rows
        context.data.forEach((row) => {
          const values = headers.map((header) => {
            const value = row[header];
            // Escape commas and quotes
            if (
              typeof value === 'string' &&
              (value.includes(',') || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          });
          csvContent += values.join(',') + '\n';
        });
      }
    } else {
      // Handle object data
      csvContent = 'Key,Value\n';
      Object.entries(context.data).forEach(([key, value]) => {
        csvContent += `${key},${value}\n`;
      });
    }

    if (options.includeMetadata && context.metadata) {
      csvContent += '\n# Metadata\n';
      Object.entries(context.metadata).forEach(([key, value]) => {
        csvContent += `# ${key}: ${value}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    this.downloadBlob(blob, 'export.csv');
  }

  private async exportToJSON(
    options: ExportOptions,
    context: ExportContext,
  ): Promise<void> {
    const exportData: any = {};

    if (context.data) {
      exportData.data = context.data;
    }

    if (options.includeMetadata && context.metadata) {
      exportData.metadata = {
        ...context.metadata,
        exportedAt: new Date().toISOString(),
        exportOptions: {
          format: options.format,
          includeData: options.includeData,
          includeMetadata: options.includeMetadata,
        },
      };
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    this.downloadBlob(blob, 'export.json');
  }

  private getScaleFromQuality(quality?: string): number {
    switch (quality) {
      case 'low':
        return 1;
      case 'medium':
        return 1.5;
      case 'high':
        return 2;
      default:
        return 1.5;
    }
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, type);
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
