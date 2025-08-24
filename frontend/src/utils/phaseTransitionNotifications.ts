/**
 * Phase transition notification utilities
 * Handles detection, formatting, and management of scan phase transitions
 */

import { formatDuration } from './format';

// Phase transition types
export interface PhaseTransition {
  id: string;
  scanId: string;
  volumeId: string;
  volumeName?: string;
  fromPhase: string | null;
  toPhase: string;
  transitionTime: Date;
  duration?: number; // Duration of previous phase in ms
  progress?: {
    fromProgress: number;
    toProgress: number;
  };
  metadata?: {
    filesProcessed?: number;
    bytesProcessed?: number;
    errorsEncountered?: number;
    performance?: {
      averageSpeed: number;
      peakSpeed: number;
    };
  };
}

// Phase display configuration
const PHASE_DISPLAY_CONFIG = {
  volume_scan: {
    label: 'Volume Scan',
    description: 'Calculating volume size and statistics',
    icon: '📊',
    color: 'blue',
    expectedDuration: '1-2 minutes',
  },
  filesystem_indexing: {
    label: 'Filesystem Indexing',
    description: 'Scanning and cataloging file structure',
    icon: '📁',
    color: 'purple',
    expectedDuration: '5-15 minutes',
  },
  media_enrichment: {
    label: 'Media Enrichment',
    description: 'Extracting metadata from media files',
    icon: '🎬',
    color: 'green',
    expectedDuration: '10-30 minutes',
  },
} as const;

// Transition message templates
const TRANSITION_MESSAGES = {
  started: {
    volume_scan: 'Starting volume analysis...',
    filesystem_indexing: 'Beginning filesystem scan...',
    media_enrichment: 'Starting media metadata extraction...',
  },
  completed: {
    volume_scan: 'Volume analysis completed',
    filesystem_indexing: 'Filesystem scan finished',
    media_enrichment: 'Media enrichment completed',
  },
  failed: {
    volume_scan: 'Volume analysis encountered errors',
    filesystem_indexing: 'Filesystem scan failed',
    media_enrichment: 'Media enrichment stopped due to errors',
  },
} as const;

/**
 * Create a phase transition notification
 */
export function createPhaseTransition(
  scanId: string,
  volumeId: string,
  fromPhase: string | null,
  toPhase: string,
  options: {
    volumeName?: string;
    duration?: number;
    progress?: { from: number; to: number };
    metadata?: PhaseTransition['metadata'];
  } = {}
): PhaseTransition {
  return {
    id: `transition-${scanId}-${Date.now()}`,
    scanId,
    volumeId,
    volumeName: options.volumeName,
    fromPhase,
    toPhase,
    transitionTime: new Date(),
    duration: options.duration,
    progress: options.progress ? {
      fromProgress: options.progress.from,
      toProgress: options.progress.to,
    } : undefined,
    metadata: options.metadata,
  };
}

/**
 * Format phase transition for display
 */
export function formatPhaseTransition(transition: PhaseTransition): {
  title: string;
  message: string;
  description?: string;
  icon: string;
  color: string;
  duration?: string;
  stats?: string[];
} {
  const fromConfig = transition.fromPhase ? PHASE_DISPLAY_CONFIG[transition.fromPhase as keyof typeof PHASE_DISPLAY_CONFIG] : null;
  const toConfig = PHASE_DISPLAY_CONFIG[transition.toPhase as keyof typeof PHASE_DISPLAY_CONFIG];
  
  if (!toConfig) {
    return {
      title: 'Phase Transition',
      message: `Moving to ${transition.toPhase}`,
      icon: '🔄',
      color: 'gray',
    };
  }

  let title: string;
  let message: string;
  
  if (transition.fromPhase) {
    // Transitioning between phases
    title = `${fromConfig?.label || transition.fromPhase} → ${toConfig.label}`;
    message = TRANSITION_MESSAGES.started[transition.toPhase as keyof typeof TRANSITION_MESSAGES.started];
    
    if (transition.duration) {
      const durationStr = formatDuration(transition.duration);
      message += ` (Previous phase: ${durationStr})`;
    }
  } else {
    // Starting first phase
    title = `Starting ${toConfig.label}`;
    message = TRANSITION_MESSAGES.started[transition.toPhase as keyof typeof TRANSITION_MESSAGES.started];
  }

  // Build stats array
  const stats: string[] = [];
  if (transition.metadata?.filesProcessed) {
    stats.push(`${transition.metadata.filesProcessed.toLocaleString()} files processed`);
  }
  if (transition.metadata?.bytesProcessed) {
    const gb = transition.metadata.bytesProcessed / (1024 * 1024 * 1024);
    stats.push(`${gb.toFixed(1)}GB processed`);
  }
  if (transition.metadata?.errorsEncountered) {
    stats.push(`${transition.metadata.errorsEncountered} errors`);
  }
  if (transition.metadata?.performance?.averageSpeed) {
    stats.push(`${transition.metadata.performance.averageSpeed.toFixed(1)} files/sec avg`);
  }

  return {
    title,
    message,
    description: toConfig.description,
    icon: toConfig.icon,
    color: toConfig.color,
    duration: toConfig.expectedDuration,
    stats: stats.length > 0 ? stats : undefined,
  };
}

/**
 * Phase transition detector - tracks phase changes in scan progress
 */
export class PhaseTransitionDetector {
  private lastPhaseStates = new Map<string, { phase: string; status: string; startTime: Date }>();
  private transitionHistory = new Map<string, PhaseTransition[]>();
  private listeners = new Set<(transition: PhaseTransition) => void>();

  /**
   * Subscribe to phase transition events
   */
  onTransition(callback: (transition: PhaseTransition) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Update scan progress and detect phase transitions
   */
  updateProgress(scanId: string, volumeId: string, currentPhase: string, phaseStatus: string, metadata?: {
    volumeName?: string;
    filesProcessed?: number;
    bytesProcessed?: number;
    errorsEncountered?: number;
    performance?: {
      averageSpeed: number;
      peakSpeed: number;
    };
  }): PhaseTransition | null {
    const key = scanId;
    const lastState = this.lastPhaseStates.get(key);
    const now = new Date();

    // Check if this is a phase transition
    let transition: PhaseTransition | null = null;

    if (!lastState) {
      // First phase starting
      if (phaseStatus === 'running') {
        transition = createPhaseTransition(scanId, volumeId, null, currentPhase, {
          volumeName: metadata?.volumeName,
          metadata: {
            filesProcessed: metadata?.filesProcessed,
            bytesProcessed: metadata?.bytesProcessed,
            errorsEncountered: metadata?.errorsEncountered,
            performance: metadata?.performance,
          },
        });
      }
    } else {
      // Check for phase change
      if (lastState.phase !== currentPhase && phaseStatus === 'running') {
        const duration = now.getTime() - lastState.startTime.getTime();
        
        transition = createPhaseTransition(scanId, volumeId, lastState.phase, currentPhase, {
          volumeName: metadata?.volumeName,
          duration,
          metadata: {
            filesProcessed: metadata?.filesProcessed,
            bytesProcessed: metadata?.bytesProcessed,
            errorsEncountered: metadata?.errorsEncountered,
            performance: metadata?.performance,
          },
        });
      }
    }

    // Update state
    if (phaseStatus === 'running' && (!lastState || lastState.phase !== currentPhase)) {
      this.lastPhaseStates.set(key, {
        phase: currentPhase,
        status: phaseStatus,
        startTime: now,
      });
    }

    // Store transition and notify listeners
    if (transition) {
      const history = this.transitionHistory.get(scanId) || [];
      history.push(transition);
      this.transitionHistory.set(scanId, history);
      
      this.listeners.forEach(callback => callback(transition));
    }

    return transition;
  }

  /**
   * Get transition history for a scan
   */
  getTransitionHistory(scanId: string): PhaseTransition[] {
    return this.transitionHistory.get(scanId) || [];
  }

  /**
   * Clear transition data for a completed/failed scan
   */
  clearScanData(scanId: string): void {
    this.lastPhaseStates.delete(scanId);
    this.transitionHistory.delete(scanId);
  }

  /**
   * Get recent transitions across all scans
   */
  getRecentTransitions(limit: number = 10): PhaseTransition[] {
    const allTransitions: PhaseTransition[] = [];
    
    for (const transitions of this.transitionHistory.values()) {
      allTransitions.push(...transitions);
    }
    
    return allTransitions
      .sort((a, b) => b.transitionTime.getTime() - a.transitionTime.getTime())
      .slice(0, limit);
  }
}

/**
 * Global phase transition detector instance
 */
export const globalPhaseTransitionDetector = new PhaseTransitionDetector();

/**
 * Get user-friendly phase completion summary
 */
export function getPhaseCompletionSummary(
  phase: string,
  duration: number,
  metadata?: PhaseTransition['metadata']
): {
  title: string;
  summary: string;
  stats: string[];
  performance: 'excellent' | 'good' | 'average' | 'slow';
} {
  const config = PHASE_DISPLAY_CONFIG[phase as keyof typeof PHASE_DISPLAY_CONFIG];
  const phaseLabel = config?.label || phase;
  const durationStr = formatDuration(duration);
  
  // Determine performance rating
  let performance: 'excellent' | 'good' | 'average' | 'slow' = 'average';
  if (phase === 'volume_scan' && duration < 60000) performance = 'excellent';
  else if (phase === 'volume_scan' && duration < 120000) performance = 'good';
  else if (phase === 'filesystem_indexing' && duration < 300000) performance = 'excellent';
  else if (phase === 'filesystem_indexing' && duration < 900000) performance = 'good';
  else if (phase === 'media_enrichment' && duration < 600000) performance = 'excellent';
  else if (phase === 'media_enrichment' && duration < 1800000) performance = 'good';
  else if (duration > 3600000) performance = 'slow';

  const stats: string[] = [];
  
  if (metadata?.filesProcessed) {
    stats.push(`${metadata.filesProcessed.toLocaleString()} files processed`);
  }
  
  if (metadata?.bytesProcessed) {
    const gb = metadata.bytesProcessed / (1024 * 1024 * 1024);
    if (gb > 1) {
      stats.push(`${gb.toFixed(1)}GB processed`);
    } else {
      const mb = metadata.bytesProcessed / (1024 * 1024);
      stats.push(`${mb.toFixed(0)}MB processed`);
    }
  }
  
  if (metadata?.performance?.averageSpeed) {
    stats.push(`${metadata.performance.averageSpeed.toFixed(1)} files/sec average`);
  }
  
  if (metadata?.errorsEncountered && metadata.errorsEncountered > 0) {
    stats.push(`${metadata.errorsEncountered} errors encountered`);
  }

  const performanceDesc = {
    excellent: 'completed quickly',
    good: 'completed efficiently', 
    average: 'completed successfully',
    slow: 'took longer than expected',
  }[performance];

  return {
    title: `${phaseLabel} Complete`,
    summary: `${phaseLabel} ${performanceDesc} in ${durationStr}`,
    stats,
    performance,
  };
}

/**
 * Estimate remaining time for current phase based on progress
 */
export function estimatePhaseRemainingTime(
  phase: string,
  progress: number,
  elapsedTime: number
): {
  estimated: number;
  confidence: 'high' | 'medium' | 'low';
  range?: { min: number; max: number };
} {
  if (progress <= 0) {
    return {
      estimated: 0,
      confidence: 'low',
    };
  }

  const progressRate = progress / elapsedTime;
  const remainingProgress = 100 - progress;
  const baseEstimate = remainingProgress / progressRate;

  // Adjust confidence based on phase and progress
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  
  if (progress > 50) {
    confidence = 'high';
  } else if (progress > 20) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // For media enrichment, estimates become less reliable due to varying file sizes
  if (phase === 'media_enrichment' && progress < 30) {
    confidence = 'low';
  }

  // Calculate confidence range
  let range: { min: number; max: number } | undefined;
  if (confidence === 'high') {
    range = { min: baseEstimate * 0.9, max: baseEstimate * 1.1 };
  } else if (confidence === 'medium') {
    range = { min: baseEstimate * 0.7, max: baseEstimate * 1.5 };
  } else {
    range = { min: baseEstimate * 0.5, max: baseEstimate * 2.0 };
  }

  return {
    estimated: baseEstimate,
    confidence,
    range,
  };
}