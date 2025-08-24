# VolumeViz Work Tracker

## Current Issue
Movies volume scan fails with "Scheduler restart - previous instance terminated" error. Frontend shows scan got 18% through filesystem indexing before failing.

## Root Cause
- Scheduler restarts mark running scans as "failed" instead of "paused"  
- No resumption capability - scans start from scratch each time
- Large volumes (2,116+ movie dirs) can't complete before timeout/restart

## Work Plan

### Phase 1: Fix the Immediate Issue
- [ ] **Backend**: Change watchdog to mark restarts as "paused" not "failed"
- [ ] **Backend**: Add basic checkpointing every 1000 files
- [ ] **Frontend**: Better error messages for "scheduler restart" 
- [ ] **Frontend**: Add "Resume Scan" action for paused scans

### Phase 2: Make it Robust
- [ ] **Backend**: Resume scans from checkpoints after restart
- [ ] **Backend**: Adaptive timeouts based on volume size  
- [ ] **Frontend**: Background scanning with notifications
- [ ] **Frontend**: Scan management dashboard

### Phase 3: Polish
- [ ] **Backend**: Incremental scanning (only changed files)
- [ ] **Backend**: Resource throttling 
- [ ] **Frontend**: Scan scheduling
- [ ] **Frontend**: Advanced progress visualization

## Current Sprint

**Goal**: Fix the movies volume scan issue

**Tasks This Week**:
1. Add "paused" status to database
2. Update watchdog to distinguish restarts from failures  
3. Implement basic checkpointing
4. Test with movies volume

**Success Criteria**:
- Movies scan survives scheduler restart
- Shows "paused" instead of "failed" 
- Can resume from where it left off