# Scan Improvements - Implementation Todo List

## 🚨 Priority 1: Critical Performance Fixes (Start Immediately)

### Backend Progress Throttling
- [ ] Create `internal/services/filesystem/progress_throttler.go`
  - [ ] Implement ProgressThrottler struct with 2-second intervals
  - [ ] Add ShouldUpdate(), QueueUpdate(), and Flush() methods
  - [ ] Write unit tests for throttler

- [ ] Update `internal/services/filesystem/filesystem_indexer.go`
  - [ ] Integrate ProgressThrottler into indexingWalker
  - [ ] Replace direct updateProgress calls with throttled updates
  - [ ] Add force flush on phase completion

- [ ] Update `internal/services/scanner/volume_scanner.go`
  - [ ] Add progress throttling to scan progress updates
  - [ ] Implement batch progress updates

### Memory Optimization for Media Enrichment
- [ ] Modify `internal/services/enrichers/manager.go`
  - [ ] Change GetUnenrichedFiles to GetUnenrichedFilesBatch
  - [ ] Implement streaming with 1000 file batches
  - [ ] Add batch progress tracking
  - [ ] Handle partial batch failures gracefully

- [ ] Update `internal/repo/files_repo.go`
  - [ ] Add GetUnenrichedFilesBatch method with limit/offset
  - [ ] Add index for efficient pagination

### WebSocket Message Optimization
- [ ] Update `internal/realtime/publish.go`
  - [ ] Increase rate limit interval from 250ms to 500ms
  - [ ] Implement message coalescing for rapid updates
  - [ ] Add priority levels for different message types

- [ ] Create `internal/realtime/message_buffer.go`
  - [ ] Implement message buffering with 100ms coalesce window
  - [ ] Add deduplication for redundant updates

## 📊 Priority 2: Database Optimization

### Add Database Indexes
- [ ] Create migration `migrations/XXX_add_scan_performance_indexes.sql`
  ```sql
  CREATE INDEX idx_scan_phases_scan_id_phase_name ON scan_phases(scan_id, phase_name);
  CREATE INDEX idx_scan_phases_status_updated_at ON scan_phases(status, updated_at) 
    WHERE status IN ('running', 'pending');
  CREATE INDEX idx_scan_progress_errors_scan_id_severity ON scan_progress_errors(scan_id, severity);
  ```

### Implement Progress Buffer
- [ ] Create migration `migrations/XXX_create_progress_buffer_table.sql`
- [ ] Implement BufferedProgressWriter service
- [ ] Add background worker to flush buffer every 2 seconds

## 🎨 Priority 3: Frontend Improvements

### Enhanced Progress Information
- [ ] Update `frontend/src/types/scan.ts`
  - [ ] Add EnhancedScanProgress interface
  - [ ] Add currentFile information
  - [ ] Add performance metrics

- [ ] Update `frontend/src/components/ui/MultiPhaseProgressBar/MultiPhaseProgressBar.tsx`
  - [ ] Display current file being processed
  - [ ] Show files remaining count
  - [ ] Add estimated time accuracy indicator

- [ ] Update `frontend/src/components/domain/ScanProgressModal/ScanProgressModal.tsx`
  - [ ] Add current file display in overview tab
  - [ ] Show large file warnings
  - [ ] Display scan impact indicators

### Improved Error Messages
- [ ] Create `frontend/src/utils/errorMessages.ts`
  - [ ] Define user-friendly error mappings
  - [ ] Add contextual suggestions
  - [ ] Implement partial success messaging

- [ ] Update `frontend/src/components/shared/ErrorSummary/ErrorSummary.tsx`
  - [ ] Use new error message utilities
  - [ ] Add retry buttons for recoverable errors
  - [ ] Show affected file lists

## 🔄 Priority 4: Phase Transition Improvements

### Backend Phase Coordination
- [ ] Update `internal/services/scanner/volume_scanner.go`
  - [ ] Add explicit phase transition checks
  - [ ] Implement phase dependency validation
  - [ ] Add transition event broadcasting

- [ ] Update `internal/services/filesystem/filesystem_indexer.go`
  - [ ] Add completion confirmation before next phase
  - [ ] Implement graceful transition with progress handoff

### Frontend Phase Notifications
- [ ] Create `frontend/src/components/scan/PhaseTransitionNotification.tsx`
  - [ ] Show transition animations
  - [ ] Display phase preparation steps
  - [ ] Add phase description tooltips

## 🧪 Priority 5: Testing

### Performance Tests
- [ ] Create `internal/services/scanner/volume_scanner_bench_test.go`
  - [ ] Benchmark 100k file scan
  - [ ] Benchmark 1M file scan
  - [ ] Test memory usage patterns

- [ ] Create `frontend/src/components/ui/MultiPhaseProgressBar/__tests__/performance.test.tsx`
  - [ ] Test with rapid WebSocket updates
  - [ ] Verify UI doesn't freeze
  - [ ] Check memory leaks

### Integration Tests
- [ ] Create `test/integration/large_volume_scan_test.go`
  - [ ] Test complete scan flow with 100k+ files
  - [ ] Verify progress accuracy
  - [ ] Test error recovery

## 📝 Priority 6: Documentation

- [ ] Update `docs/API.md`
  - [ ] Document new progress response format
  - [ ] Add WebSocket event specifications

- [ ] Create `docs/SCAN_PERFORMANCE_GUIDE.md`
  - [ ] Best practices for large volumes
  - [ ] Configuration recommendations
  - [ ] Troubleshooting guide

## 🚀 Implementation Schedule

### Week 1 (Start Monday)
**Goal: Stop the bleeding - fix critical performance issues**

#### Monday-Tuesday
- [ ] Implement backend progress throttling
- [ ] Deploy to staging for testing

#### Wednesday-Thursday  
- [ ] Implement memory optimization for enrichment
- [ ] Add database indexes
- [ ] Test with large media library

#### Friday
- [ ] WebSocket message optimization
- [ ] Initial performance testing
- [ ] Deploy fixes to production

### Week 2
**Goal: Improve user experience**

#### Monday-Tuesday
- [ ] Frontend progress enhancements
- [ ] Error message improvements

#### Wednesday-Thursday
- [ ] Phase transition improvements
- [ ] Add contextual information

#### Friday
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Production deployment

## 🎯 Success Metrics

### Must Have (Week 1)
- [ ] Database writes reduced by 90%
- [ ] Memory usage stable for 1M file scans
- [ ] WebSocket messages < 10/second

### Should Have (Week 2)  
- [ ] Current file visible during scan
- [ ] Clear error messages with suggestions
- [ ] Smooth phase transitions

### Nice to Have (Future)
- [ ] Pause/resume functionality
- [ ] Scan scheduling
- [ ] Historical comparison

## 🐛 Known Issues to Address

1. **CRITICAL**: Progress updates flooding database
   - File: `internal/services/filesystem/filesystem_indexer.go:307`
   - Fix: Implement throttling

2. **HIGH**: Memory spike during enrichment
   - File: `internal/services/enrichers/manager.go:175`
   - Fix: Implement streaming

3. **HIGH**: WebSocket channel overflow
   - File: `internal/realtime/publish.go:93`
   - Fix: Increase rate limiting

4. **MEDIUM**: Generic error messages
   - File: `frontend/src/hooks/useScanMonitoring.ts:147`
   - Fix: Add context mapping

5. **MEDIUM**: Phase progress jumps
   - File: `internal/services/scanner/volume_scanner.go:485`
   - Fix: Implement weighted progress

## 📞 Team Coordination

### Daily Standup Topics
- Progress throttling implementation status
- Performance test results
- Blocker identification
- User feedback from staging

### Review Checkpoints
- [ ] Code review after throttling implementation
- [ ] Performance review after Week 1
- [ ] UX review after Week 2
- [ ] Full system review before production

---

**Start Date**: Monday (next week)  
**Target Completion**: 2 weeks  
**Priority**: CRITICAL - System stability at risk for large volumes  

**Note**: Begin with Priority 1 items immediately. These are blocking issues that affect system stability.