import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Zap, AlertCircle, CheckCircle, Database, Filter } from 'lucide-react';
import { useAggregationWorker } from '@/hooks/useWebWorker';
import { cn } from '@/utils/class-names/cn';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  modified: string;
  extension?: string;
  mimeType?: string;
  parent?: string;
  children?: FileItem[];
}

export interface ProcessingResult {
  totalSize: number;
  totalCount: number;
  fileCount: number;
  dirCount: number;
  largestFile: FileItem | null;
  extensionStats: Record<string, { count: number; totalSize: number }>;
  sizeDistribution: { range: string; count: number; size: number }[];
  duplicates: FileItem[][];
  processingTime: number;
}

export interface DataProcessorProps {
  className?: string;
  data: FileItem[];
  onProcessingComplete?: (result: ProcessingResult) => void;
  onError?: (error: string) => void;
  autoProcess?: boolean;
  showProgress?: boolean;
  showMetrics?: boolean;
}

export const DataProcessor: React.FC<DataProcessorProps> = ({
  className,
  data,
  onProcessingComplete,
  onError,
  autoProcess = false,
  showProgress = true,
  showMetrics = true,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);

  // Web Worker for data aggregation
  const aggregationWorker = useAggregationWorker({
    onMessage: (response) => {
      const processingTime = performance.now() - processingStartTime;

      switch (response.type) {
        case 'DATA_AGGREGATED':
          const aggregationResult: ProcessingResult = {
            ...response.payload,
            processingTime,
          };
          setResult(aggregationResult);
          setIsProcessing(false);
          setProgress(100);
          setCurrentTask('Complete');
          
          if (onProcessingComplete) {
            onProcessingComplete(aggregationResult);
          }
          break;

        case 'DUPLICATES_FOUND':
          setProgress(80);
          setCurrentTask('Finding duplicates...');
          // Continue with next processing step
          break;

        default:
          console.warn('Unknown response type:', response.type);
      }
    },
    onError: (err) => {
      setError(err);
      setIsProcessing(false);
      setCurrentTask('');
      if (onError) {
        onError(err);
      }
    },
    timeout: 30000, // 30 second timeout for large datasets
  });

  const processData = useCallback(async () => {
    if (data.length === 0) {
      setError('No data to process');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setCurrentTask('Initializing...');
    setError(null);
    setResult(null);
    setProcessingStartTime(performance.now());

    try {
      // Simulate progressive updates for better UX
      setProgress(10);
      setCurrentTask('Analyzing file structure...');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setProgress(30);
      setCurrentTask('Calculating aggregations...');

      // Send data to Web Worker for processing
      if (aggregationWorker.isSupported) {
        aggregationWorker.postMessage({
          type: 'AGGREGATE_DATA',
          payload: { files: data },
        });
        
        setProgress(50);
        setCurrentTask('Processing in background...');
      } else {
        // Fallback to synchronous processing
        throw new Error('Web Workers not supported - falling back to synchronous processing');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Processing failed';
      setError(errorMessage);
      setIsProcessing(false);
      setCurrentTask('');
      
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [data, aggregationWorker, onProcessingComplete, onError, processingStartTime]);

  // Auto-process when data changes
  useEffect(() => {
    if (autoProcess && data.length > 0) {
      processData();
    }
  }, [autoProcess, data, processData]);

  // Format numbers for display
  const formatNumber = useCallback((num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }, []);

  const formatBytes = useCallback((bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Processing Controls */}
      <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-gray-900">Data Processing</h3>
            <p className="text-sm text-gray-600">
              {formatNumber(data.length)} items ready for analysis
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {showMetrics && aggregationWorker.isSupported && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Zap className="h-3 w-3" />
              Web Worker
            </div>
          )}
          
          <button
            onClick={processData}
            disabled={isProcessing || data.length === 0}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-colors",
              isProcessing || data.length === 0
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Filter className="h-4 w-4 inline mr-2" />
                Process Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Display */}
      {showProgress && isProcessing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">{currentTask}</span>
            <span className="text-sm text-blue-700">{progress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-900">Processing Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && !isProcessing && (
        <div className="space-y-4">
          {/* Success Header */}
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <h4 className="font-medium text-green-900">Processing Complete</h4>
              <p className="text-sm text-green-700">
                Analyzed {formatNumber(result.totalCount)} items in {result.processingTime.toFixed(0)}ms
              </p>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white border rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {formatBytes(result.totalSize)}
              </div>
              <div className="text-sm text-gray-600">Total Size</div>
            </div>

            <div className="p-4 bg-white border rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(result.fileCount)}
              </div>
              <div className="text-sm text-gray-600">Files</div>
            </div>

            <div className="p-4 bg-white border rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(result.dirCount)}
              </div>
              <div className="text-sm text-gray-600">Directories</div>
            </div>

            <div className="p-4 bg-white border rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {result.duplicates.length}
              </div>
              <div className="text-sm text-gray-600">Duplicate Groups</div>
            </div>
          </div>

          {/* Top Extensions */}
          {Object.keys(result.extensionStats).length > 0 && (
            <div className="p-4 bg-white border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Top File Types</h4>
              <div className="space-y-2">
                {Object.entries(result.extensionStats)
                  .sort(([,a], [,b]) => b.totalSize - a.totalSize)
                  .slice(0, 5)
                  .map(([ext, stats]) => (
                    <div key={ext} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {ext.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatNumber(stats.count)} files
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {formatBytes(stats.totalSize)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Size Distribution */}
          {result.sizeDistribution.length > 0 && (
            <div className="p-4 bg-white border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Size Distribution</h4>
              <div className="space-y-2">
                {result.sizeDistribution
                  .filter(dist => dist.count > 0)
                  .map((dist) => (
                    <div key={dist.range} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{dist.range}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900">
                          {formatNumber(dist.count)} files
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatBytes(dist.size)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Largest File */}
          {result.largestFile && (
            <div className="p-4 bg-white border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Largest File</h4>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{result.largestFile.name}</div>
                  <div className="text-sm text-gray-600">{result.largestFile.path}</div>
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {formatBytes(result.largestFile.size)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isProcessing && !result && !error && data.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <h3 className="font-medium mb-2">No Data Available</h3>
          <p className="text-sm">Load some data to begin processing</p>
        </div>
      )}
    </div>
  );
};