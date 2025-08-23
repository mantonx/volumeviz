import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/ui/Toast/ToastProvider';

export interface ScanPhase {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  progress?: number;
  startTime?: Date;
  endTime?: Date;
  details?: {
    filesProcessed?: number;
    totalFiles?: number;
    currentFile?: string;
    filesPerSecond?: number;
    bytesProcessed?: number;
    totalBytes?: number;
  };
  error?: string;
  recentErrors?: EnrichmentError[];
}

export interface EnrichmentError {
  timestamp: string;
  file_name: string;
  file_path: string;
  enricher_name: string;
  error_type: string;
  error_message: string;
  technical_details?: string;
}

export interface MultiPhaseScanProgress {
  volumeId: string;
  scanId?: string;
  phases: ScanPhase[];
  overallProgress: number;
  status: 'idle' | 'scanning' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  estimatedCompletion?: Date;
  error?: string;
}

interface UseMultiPhaseScanProgressOptions {
  pollInterval?: number;
  enableFilesystemTracking?: boolean;
}

interface ApiScanProgress {
  scan_id?: string;
  volume_id: string;
  status: string;
  phase: string;
  progress: number;
  phase_progress: number;
  files_scanned: number;
  folders_scanned: number;
  current_path?: string;
  started_at: string;
  estimated_remaining?: number;
  errors?: string[];
  errors_count?: number;
  last_error?: string;
  phases?: {
    media_enrichment?: {
      status: string;
      progress: number;
      items_processed: number;
      error?: string;
    };
  };
}

interface ApiFilesystemIndexingStatus {
  volume_id: string;
  status: string;
  folders_scanned: number;
  files_scanned: number;
  bytes_processed: number;
  current_path?: string;
  folders_per_sec?: number;
  files_per_sec?: number;
  started_at?: string;
}

export function useMultiPhaseScanProgress(
  volumeId: string,
  options: UseMultiPhaseScanProgressOptions = {}
) {
  const { pollInterval = 2000, enableFilesystemTracking = true } = options;
  const { error: showError } = useToast();
  
  const [progress, setProgress] = useState<MultiPhaseScanProgress>({
    volumeId,
    phases: [
      {
        id: 'volume_scan',
        label: 'Volume Scan',
        description: 'Calculating volume size and basic statistics',
        status: 'pending',
      },
      {
        id: 'filesystem_indexing',
        label: 'Filesystem Indexing',
        description: 'Analyzing file structure and metadata',
        status: 'pending',
      },
      {
        id: 'media_enrichment',
        label: 'Media Enrichment',
        description: 'Extracting metadata from images, videos, and audio files',
        status: 'pending',
      },
    ],
    overallProgress: 0,
    status: 'idle',
  });

  const pollIntervalRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Fetch scan progress from API
  const fetchScanProgress = useCallback(async () => {
    if (!abortControllerRef.current) return;

    try {
      const baseUrl = import.meta.env?.VITE_API_URL || 'http://localhost:8080';
      
      console.log(`[useMultiPhaseScanProgress] Fetching progress for volume: ${volumeId}`);
      
      const scanUrl = `${baseUrl}/volumes/${volumeId}/scan/status`;
      const filesystemUrl = `${baseUrl}/volumes/${volumeId}/filesystem/status`;
      console.log(`[useMultiPhaseScanProgress] Scan URL: ${scanUrl}`);
      console.log(`[useMultiPhaseScanProgress] Filesystem URL: ${filesystemUrl}`);
      
      // Fetch volume scan progress
      const scanResponse = await fetch(scanUrl, {
        signal: abortControllerRef.current.signal,
      });

      let scanData: ApiScanProgress | null = null;
      if (scanResponse.ok) {
        scanData = await scanResponse.json();
        console.log(`[useMultiPhaseScanProgress] Volume scan data:`, scanData);
      } else if (scanResponse.status === 404) {
        // 404 means no active scan - this is normal when no scan is running
        console.log(`[useMultiPhaseScanProgress] No active volume scan found (404 - normal when not scanning)`);
      } else {
        console.log(`[useMultiPhaseScanProgress] Volume scan API error:`, scanResponse.status, scanResponse.statusText);
      }

      // Fetch filesystem indexing progress if enabled
      let filesystemData: ApiFilesystemIndexingStatus | null = null;
      if (enableFilesystemTracking) {
        const filesystemResponse = await fetch(filesystemUrl, {
          signal: abortControllerRef.current.signal,
        });

        if (filesystemResponse.ok) {
          filesystemData = await filesystemResponse.json();
          console.log(`[useMultiPhaseScanProgress] Filesystem indexing data:`, filesystemData);
          console.log(`[useMultiPhaseScanProgress] Filesystem data details:`, {
            files_scanned: filesystemData?.files_scanned,
            bytes_processed: filesystemData?.bytes_processed,
            files_per_sec: filesystemData?.files_per_sec,
            status: filesystemData?.status
          });
        } else {
          console.log(`[useMultiPhaseScanProgress] Filesystem indexing API error:`, filesystemResponse.status, filesystemResponse.statusText);
        }
      }

      setProgress(prev => {
        const newPhases = [...prev.phases];
        let overallProgress = 0;
        let status = prev.status;

        // Update volume scan phase
        const volumeScanPhase = newPhases.find(p => p.id === 'volume_scan');
        if (volumeScanPhase) {
          if (scanData) {
            const isActive = scanData.phase === 'volume_scan' && scanData.status === 'running';
            const isCompleted = scanData.status === 'completed' || 
                               (scanData.phase !== 'volume_scan' && scanData.status === 'running');
            
            volumeScanPhase.status = isActive ? 'active' : isCompleted ? 'completed' : 'pending';
            volumeScanPhase.progress = isActive ? scanData.phase_progress : isCompleted ? 100 : 0;
            
            if (isActive || isCompleted) {
              volumeScanPhase.details = {
                filesProcessed: scanData.files_scanned,
                currentFile: scanData.current_path,
              };
            }

            if (isCompleted) overallProgress += 10; // Volume scan is 10% of total
            else if (isActive) overallProgress += (scanData.phase_progress / 100) * 10;
          } else {
            // No scan data (404) - check if filesystem is running to determine if volume scan completed
            const isFilesystemRunning = filesystemData?.status === 'running';
            if (isFilesystemRunning) {
              // If filesystem is running, assume volume scan completed
              volumeScanPhase.status = 'completed';
              volumeScanPhase.progress = 100;
              overallProgress += 10;
            } else {
              // No active scans - reset to pending state
              volumeScanPhase.status = 'pending';
              volumeScanPhase.progress = 0;
            }
          }
        }

        // Update filesystem indexing phase
        const filesystemPhase = newPhases.find(p => p.id === 'filesystem_indexing');
        if (filesystemPhase && enableFilesystemTracking) {
          const isActive = filesystemData?.status === 'running';
          const isCompleted = filesystemData?.status === 'completed';
          const isFailed = filesystemData?.status === 'failed';

          if (isActive) {
            filesystemPhase.status = 'active';
            // Calculate progress based on files processed (rough estimate)
            const estimatedTotal = Math.max(filesystemData.files_scanned * 1.5, 1000);
            filesystemPhase.progress = Math.min((filesystemData.files_scanned / estimatedTotal) * 100, 95);
            
            // Always update details when active
            filesystemPhase.details = {
              filesProcessed: filesystemData.files_scanned || 0,
              currentFile: filesystemData.current_path || '',
              filesPerSecond: filesystemData.files_per_sec || 0,
              bytesProcessed: filesystemData.bytes_processed || 0,
            };
            
            console.log(`[useMultiPhaseScanProgress] Filesystem phase details:`, filesystemPhase.details);
          } else if (isCompleted) {
            filesystemPhase.status = 'completed';
            filesystemPhase.progress = 100;
            
            // Update details for completed state
            if (filesystemData) {
              filesystemPhase.details = {
                filesProcessed: filesystemData.files_scanned || 0,
                currentFile: filesystemData.current_path || '',
                filesPerSecond: filesystemData.files_per_sec || 0,
                bytesProcessed: filesystemData.bytes_processed || 0,
              };
            }
          } else if (isFailed) {
            filesystemPhase.status = 'failed';
          }

          if (isCompleted) overallProgress += 80; // Filesystem indexing is 80% of total
          else if (isActive && filesystemPhase.progress) overallProgress += (filesystemPhase.progress / 100) * 80;
        }

        // Update media enrichment phase
        const mediaEnrichmentPhase = newPhases.find(p => p.id === 'media_enrichment');
        if (mediaEnrichmentPhase) {
          // Check if media enrichment phase exists in scan data phases
          const enrichmentPhaseData = scanData?.phases?.media_enrichment;
          if (enrichmentPhaseData) {
            const isActive = enrichmentPhaseData.status === 'running';
            const isCompleted = enrichmentPhaseData.status === 'completed';
            const isFailed = enrichmentPhaseData.status === 'failed';
            
            if (isActive) {
              mediaEnrichmentPhase.status = 'active';
              mediaEnrichmentPhase.progress = enrichmentPhaseData.progress * 100;
              mediaEnrichmentPhase.details = {
                filesProcessed: enrichmentPhaseData.items_processed || 0,
                currentFile: 'Enriching media files...',
              };
            } else if (isCompleted) {
              mediaEnrichmentPhase.status = 'completed';
              mediaEnrichmentPhase.progress = 100;
            } else if (isFailed) {
              mediaEnrichmentPhase.status = 'failed';
              mediaEnrichmentPhase.progress = 0;
              if (enrichmentPhaseData.error) {
                mediaEnrichmentPhase.error = enrichmentPhaseData.error;
              }
            }
            
            // Add error information if available from scan data
            if (scanData?.errors && scanData.errors.length > 0) {
              // Parse enrichment errors from the formatted error messages
              const enrichmentErrors: EnrichmentError[] = [];
              for (const errorMsg of scanData.errors) {
                // Try to parse the formatted error message
                // Format: "enricher_name: error_type (file_name) - error_message [technical_details]"
                const match = errorMsg.match(/^(\w+): (\w+) \(([^)]+)\) - ([^\[]+)(?:\s*\[([^\]]+)\])?/);
                if (match) {
                  enrichmentErrors.push({
                    timestamp: new Date().toISOString(), // API doesn't provide timestamp yet
                    enricher_name: match[1],
                    error_type: match[2],
                    file_name: match[3],
                    error_message: match[4].trim(),
                    technical_details: match[5] || '',
                    file_path: match[3], // Use filename as path for now
                  });
                }
              }
              if (enrichmentErrors.length > 0) {
                mediaEnrichmentPhase.recentErrors = enrichmentErrors;
              }
            }

            if (isCompleted) overallProgress += 10; // Media enrichment is 10% of total
            else if (isActive && mediaEnrichmentPhase.progress) overallProgress += (mediaEnrichmentPhase.progress / 100) * 10;
          } else {
            // No enrichment data available - check if it should be pending or completed based on other phases
            const volumeScanComplete = volumeScanPhase?.status === 'completed';
            const filesystemComplete = filesystemPhase?.status === 'completed';
            
            if (volumeScanComplete && filesystemComplete) {
              // Previous phases completed, enrichment should be pending/active
              mediaEnrichmentPhase.status = 'pending';
            }
          }
        }

        // Determine overall status (updated for 3 phases)
        if (scanData?.status === 'failed' || filesystemData?.status === 'failed') {
          status = 'failed';
        } else if (scanData?.status === 'running' || filesystemData?.status === 'running' || 
                  scanData?.phases?.media_enrichment?.status === 'running') {
          status = 'scanning';
        } else if (scanData?.status === 'completed' && 
                  (!enableFilesystemTracking || filesystemData?.status === 'completed') &&
                  (!scanData?.phases?.media_enrichment || scanData?.phases?.media_enrichment?.status === 'completed')) {
          status = 'completed';
          overallProgress = 100;
        } else if (!scanData && !filesystemData) {
          // No scan data available - keep current status (idle or completed)
          status = prev.status;
        } else if (!scanData && filesystemData?.status === 'running') {
          // Volume scan not active but filesystem indexing is running
          status = 'scanning';
        }

        const newProgress = {
          ...prev,
          scanId: scanData?.scan_id,
          phases: newPhases,
          overallProgress: Math.round(overallProgress),
          status,
          startTime: scanData?.started_at ? new Date(scanData.started_at) : prev.startTime,
        };
        
        console.log(`[useMultiPhaseScanProgress] Updated progress state:`, {
          status,
          overallProgress: Math.round(overallProgress),
          phases: newPhases.map(p => ({
            id: p.id,
            status: p.status,
            progress: p.progress,
          })),
          scanData: scanData ? { phase: scanData.phase, status: scanData.status } : null,
          filesystemData: filesystemData ? { status: filesystemData.status } : null,
        });
        
        return newProgress;
      });

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to fetch scan progress:', err);
        setProgress(prev => ({ ...prev, status: 'failed', error: err.message }));
      }
    }
  }, [volumeId, enableFilesystemTracking]);

  // Start polling for progress
  const startPolling = useCallback(() => {
    console.log(`[useMultiPhaseScanProgress] Starting polling for volume: ${volumeId}`);
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    abortControllerRef.current = new AbortController();
    
    // Initial fetch
    fetchScanProgress();
    
    // Set up polling
    pollIntervalRef.current = setInterval(fetchScanProgress, pollInterval);
    console.log(`[useMultiPhaseScanProgress] Polling started with ${pollInterval}ms interval`);
  }, [fetchScanProgress, pollInterval, volumeId]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = undefined;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = undefined;
    }
  }, []);

  // Reset progress
  const resetProgress = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      phases: prev.phases.map(phase => ({
        ...phase,
        status: 'pending',
        progress: 0,
        details: undefined,
      })),
      overallProgress: 0,
      status: 'idle',
      scanId: undefined,
      startTime: undefined,
      estimatedCompletion: undefined,
      error: undefined,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Auto-stop polling when scan is complete
  useEffect(() => {
    if (progress.status === 'completed' || progress.status === 'failed') {
      // Stop polling after a short delay to ensure we get final state
      const timeout = setTimeout(stopPolling, 3000);
      return () => clearTimeout(timeout);
    }
  }, [progress.status, stopPolling]);

  return {
    progress,
    isScanning: progress.status === 'scanning',
    isComplete: progress.status === 'completed',
    isFailed: progress.status === 'failed',
    currentPhase: progress.phases.find(p => p.status === 'active'),
    startPolling,
    stopPolling,
    resetProgress,
  };
}