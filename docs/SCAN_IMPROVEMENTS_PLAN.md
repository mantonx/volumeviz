# VolumeViz Scan Functionality Improvement Plan

## Executive Summary
This document outlines critical improvements needed for the VolumeViz scanning functionality, particularly for handling large media volumes (TV shows, movies). The analysis covers backend performance, frontend UX, and real-time communication layers.

## Current State Analysis

### ✅ Strengths
- **Architecture**: Well-structured 3-phase scanning (Volume → Filesystem → Media)
- **Database**: Comprehensive progress tracking with `scan_phases` table
- **UI Components**: Rich progress visualization components
- **WebSocket**: Real-time updates with reconnection support
- **Batch Processing**: Configurable batch sizes for database operations

### 🔴 Critical Issues
1. **Progress Update Frequency**: Excessive database writes (every file)
2. **Memory Management**: Loading 10,000 files at once for enrichment
3. **User Feedback**: Generic error messages without context
4. **WebSocket Flooding**: Unthrottled updates overwhelming the channel
5. **Phase Transitions**: Unclear handoffs between scan phases

---

## Implementation Roadmap

### Phase 1: Critical Performance Fixes (Week 1-2)
**Goal**: Prevent system overload on large volumes

#### 1.1 Backend Progress Throttling
- [ ] Implement progress update throttling (2-second intervals)
- [ ] Add batch buffering for database writes
- [ ] Configure rate limiting per scan phase

#### 1.2 Memory Optimization
- [ ] Implement streaming for media enrichment (1000 files/batch)
- [ ] Add progressive file discovery for massive volumes
- [ ] Optimize bulk insert batch sizes

#### 1.3 WebSocket Message Optimization
- [ ] Align backend/frontend throttling rates
- [ ] Implement message coalescing
- [ ] Add WebSocket message priority levels

### Phase 2: Enhanced User Experience (Week 3-4)
**Goal**: Provide clear, actionable feedback during scans

#### 2.1 Contextual Progress Information
- [ ] Show current file being processed
- [ ] Display remaining file count
- [ ] Add estimated time with accuracy indicator
- [ ] Implement large file warnings

#### 2.2 Improved Error Handling
- [ ] Add user-friendly error messages
- [ ] Provide actionable suggestions
- [ ] Show partial success results
- [ ] Implement file-level retry mechanism

#### 2.3 Phase Transition Visibility
- [ ] Add transition notifications
- [ ] Show phase preparation steps
- [ ] Display phase dependencies
- [ ] Implement smooth progress handoffs

### Phase 3: Advanced Features (Week 5-6)
**Goal**: Enterprise-ready scanning capabilities

#### 3.1 Scan Management
- [ ] Implement pause/resume functionality
- [ ] Add scan scheduling for off-peak hours
- [ ] Create scan templates for different volume types
- [ ] Add scan priority queue

#### 3.2 Historical Analysis
- [ ] Build scan history view
- [ ] Add scan comparison/delta view
- [ ] Implement trend analysis
- [ ] Create performance benchmarking

#### 3.3 Performance Warnings
- [ ] Add pre-scan volume analysis
- [ ] Implement system impact warnings
- [ ] Create background scan option
- [ ] Add resource usage monitoring

---

## Technical Implementation Details

### Backend Changes

#### Progress Update Throttling
```go
// internal/services/filesystem/progress_throttler.go
type ProgressThrottler struct {
    lastUpdate     time.Time
    updateInterval time.Duration
    pendingUpdate  *models.UpdateScanPhaseParams
    mu            sync.Mutex
}

func (pt *ProgressThrottler) ShouldUpdate(force bool) bool {
    pt.mu.Lock()
    defer pt.mu.Unlock()
    
    if force {
        return true
    }
    
    return time.Since(pt.lastUpdate) >= pt.updateInterval
}

func (pt *ProgressThrottler) QueueUpdate(update *models.UpdateScanPhaseParams) {
    pt.mu.Lock()
    defer pt.mu.Unlock()
    pt.pendingUpdate = update
}

func (pt *ProgressThrottler) Flush() *models.UpdateScanPhaseParams {
    pt.mu.Lock()
    defer pt.mu.Unlock()
    
    update := pt.pendingUpdate
    pt.pendingUpdate = nil
    pt.lastUpdate = time.Now()
    return update
}
```

#### Memory-Efficient Media Enrichment
```go
// internal/services/enrichers/streaming.go
func (m *Manager) EnrichVolumeStreaming(ctx context.Context, volumeID, scanID string) error {
    const batchSize = 1000
    offset := 0
    
    for {
        // Get next batch
        files, err := m.repository.GetUnenrichedFilesBatch(ctx, volumeID, batchSize, offset)
        if err != nil {
            return fmt.Errorf("failed to get files batch: %w", err)
        }
        
        if len(files) == 0 {
            break // No more files
        }
        
        // Process batch
        if err := m.processBatch(ctx, files, scanID); err != nil {
            log.Printf("Batch processing error at offset %d: %v", offset, err)
            // Continue with next batch instead of failing entirely
        }
        
        offset += batchSize
        
        // Update progress
        m.updateBatchProgress(scanID, offset)
    }
    
    return nil
}
```

#### Weighted Progress Calculation
```go
// internal/services/scanner/progress.go
var PhaseWeights = map[string]float64{
    "volume_scan":         0.10,  // Quick
    "filesystem_indexing": 0.60,  // Bulk of work
    "media_enrichment":    0.30,  // Selective files
}

func CalculateOverallProgress(phases map[string]*interfaces.PhaseInfo) float64 {
    var weightedProgress float64
    var totalWeight float64
    
    for phaseName, phase := range phases {
        weight := PhaseWeights[phaseName]
        weightedProgress += phase.Progress * weight
        totalWeight += weight
    }
    
    if totalWeight == 0 {
        return 0
    }
    
    return weightedProgress / totalWeight
}
```

### Frontend Changes

#### Enhanced Progress Context
```typescript
// frontend/src/types/scan.ts
interface EnhancedScanProgress {
  // Basic progress
  overallProgress: number;
  currentPhase: string;
  phaseProgress: number;
  
  // Contextual information
  currentFile: {
    path: string;
    name: string;
    size: number;
    type: string;
  };
  
  // Statistics
  stats: {
    filesProcessed: number;
    filesTotal: number;
    filesRemaining: number;
    bytesProcessed: number;
    bytesTotal: number;
    filesPerSecond: number;
    estimatedTimeRemaining: number;
    estimatedAccuracy: 'high' | 'medium' | 'low';
  };
  
  // Performance
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    diskIO: number;
    isHighLoad: boolean;
  };
  
  // Errors
  errors: {
    count: number;
    recent: ErrorDetail[];
    byCategory: Record<string, number>;
  };
}
```

#### User-Friendly Error Messages
```typescript
// frontend/src/utils/errorMessages.ts
const ERROR_MESSAGES: Record<string, UserFriendlyError> = {
  'permission_denied': {
    title: 'Permission Issue',
    message: 'Unable to access some files',
    suggestion: 'Check that Docker has permission to read these files',
    icon: 'lock',
    canRetry: true,
  },
  'ffprobe_failed': {
    title: 'Media Analysis Failed',
    message: 'Could not extract metadata from some media files',
    suggestion: 'These files may be corrupted or in an unsupported format',
    icon: 'film',
    canRetry: false,
  },
  'timeout': {
    title: 'Operation Timed Out',
    message: 'File processing took too long',
    suggestion: 'Large files may need more time. Try scanning fewer files at once',
    icon: 'clock',
    canRetry: true,
  },
};

export function getUserFriendlyError(errorCode: string, context: any): UserFriendlyError {
  const template = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.default;
  return {
    ...template,
    affectedFiles: context.files || [],
    partialSuccess: context.successCount > 0,
    successRate: context.successCount / (context.successCount + context.errorCount),
  };
}
```

#### Pre-Scan Warnings
```typescript
// frontend/src/components/scan/PreScanWarning.tsx
export const PreScanWarning: React.FC<{ volume: Volume; onProceed: (mode: ScanMode) => void }> = ({
  volume,
  onProceed,
}) => {
  const estimatedFiles = volume.estimatedFileCount || 0;
  const estimatedSize = volume.estimatedSize || 0;
  const estimatedDuration = calculateEstimatedDuration(estimatedFiles, estimatedSize);
  
  if (estimatedFiles < 10000) {
    // Small volume, proceed without warning
    onProceed('immediate');
    return null;
  }
  
  const isLargeVolume = estimatedFiles > 100000 || estimatedSize > 500 * 1024 * 1024 * 1024; // 500GB
  
  return (
    <Dialog open={true}>
      <DialogHeader>
        <AlertTriangle className="text-yellow-500" />
        <h2>{isLargeVolume ? 'Large Volume Detected' : 'Volume Scan Confirmation'}</h2>
      </DialogHeader>
      
      <DialogBody>
        <div className="space-y-4">
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm">
              This volume contains approximately:
            </p>
            <ul className="mt-2 space-y-1">
              <li>• {estimatedFiles.toLocaleString()} files</li>
              <li>• {formatBytes(estimatedSize)} of data</li>
              <li>• Estimated scan time: {formatDuration(estimatedDuration)}</li>
            </ul>
          </div>
          
          {isLargeVolume && (
            <Alert type="warning">
              Scanning this volume may impact system performance. Consider scanning during off-peak hours.
            </Alert>
          )}
        </div>
      </DialogBody>
      
      <DialogFooter>
        <Button variant="secondary" onClick={() => onProceed('cancel')}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => onProceed('schedule')}>
          Schedule for Later
        </Button>
        <Button variant="secondary" onClick={() => onProceed('background')}>
          Scan in Background
        </Button>
        <Button variant="primary" onClick={() => onProceed('immediate')}>
          Scan Now
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
```

---

## Database Schema Updates

### New Indexes for Performance
```sql
-- Optimize scan progress queries
CREATE INDEX idx_scan_phases_scan_id_phase_name 
ON scan_phases(scan_id, phase_name);

CREATE INDEX idx_scan_phases_status_updated_at 
ON scan_phases(status, updated_at) 
WHERE status IN ('running', 'pending');

-- Optimize error lookups
CREATE INDEX idx_scan_progress_errors_scan_id_severity 
ON scan_progress_errors(scan_id, severity);
```

### Progress Buffer Table
```sql
-- Buffer for batched progress updates
CREATE TABLE scan_progress_buffer (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    phase_name TEXT NOT NULL,
    update_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_progress_buffer_unprocessed 
ON scan_progress_buffer(scan_id, processed) 
WHERE processed = FALSE;
```

---

## Testing Strategy

### Performance Tests
1. **Large Volume Test**: 500,000+ files
2. **Deep Hierarchy Test**: 20+ directory levels
3. **Large File Test**: Files > 10GB
4. **Mixed Media Test**: Various file types
5. **Concurrent Scan Test**: Multiple volumes

### User Experience Tests
1. **Progress Accuracy**: Compare estimated vs actual times
2. **Error Recovery**: Test retry mechanisms
3. **WebSocket Reliability**: Connection loss scenarios
4. **Memory Usage**: Monitor during large scans
5. **UI Responsiveness**: During heavy operations

### Benchmarks
- Target: 10,000 files/minute for filesystem indexing
- Target: 100 media files/minute for enrichment
- Target: < 500MB memory usage for 1M file scan
- Target: < 5% CPU overhead during background scans

---

## Monitoring & Metrics

### Key Performance Indicators
- Average scan duration by volume size
- Error rate by scan phase
- WebSocket message throughput
- Database write frequency
- Memory usage patterns
- User engagement with progress UI

### Alerts
- Scan duration > 2x estimated
- Error rate > 5%
- WebSocket disconnection > 30 seconds
- Memory usage > 1GB
- Database write queue > 1000 items

---

## Rollout Plan

### Week 1-2: Performance Critical
1. Deploy progress throttling
2. Implement streaming enrichment
3. Add WebSocket optimization
4. Monitor impact on large volumes

### Week 3-4: User Experience
1. Release enhanced progress UI
2. Deploy error improvements
3. Add phase transitions
4. Gather user feedback

### Week 5-6: Advanced Features
1. Beta test pause/resume
2. Release scan history
3. Deploy scheduling system
4. Performance optimization

---

## Success Criteria

### Performance
- ✅ Large volume scans (1M+ files) complete without OOM
- ✅ Progress updates arrive smoothly (no UI freezing)
- ✅ Database writes reduced by 90%
- ✅ WebSocket message rate < 10/second

### User Experience
- ✅ Users understand scan progress at all times
- ✅ Error messages provide actionable next steps
- ✅ Phase transitions are clear and smooth
- ✅ Scan completion time estimates within 20% accuracy

### Reliability
- ✅ No data loss during scan interruption
- ✅ Graceful handling of connection loss
- ✅ Successful retry of transient errors
- ✅ Consistent scan results across runs

---

## Appendix

### Configuration Recommendations
```yaml
# Recommended settings for large media volumes
scanning:
  progress_update_interval: 2s
  batch_size: 1000
  max_concurrent_reads: 5
  enable_streaming: true
  
filesystem_indexing:
  batch_size: 5000
  max_depth: 20
  skip_hidden: true
  enable_progress_buffer: true
  
media_enrichment:
  batch_size: 100
  worker_count: 4
  timeout_per_file: 30s
  retry_attempts: 2
  
websocket:
  message_rate_limit: 10/s
  coalesce_interval: 100ms
  buffer_size: 1000
```

### Related Documentation
- [WebSocket Protocol Specification](./WEBSOCKET_PROTOCOL.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [API Documentation](./API.md)
- [Performance Tuning Guide](./PERFORMANCE.md)

---

*Document Version: 1.0*  
*Last Updated: August 2025*  
*Author: VolumeViz Development Team*