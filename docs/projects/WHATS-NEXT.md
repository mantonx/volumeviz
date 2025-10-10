# What's Next: Scan Progress Improvements

**Last Updated**: 2025-10-10
**Current Status**: MVP fixes completed, awaiting deployment and testing

---

## 🎯 Immediate Next Steps (Do First)

### 1. Deploy & Test MVP Fixes
**Priority**: 🔴 CRITICAL
**Effort**: 15 minutes

**Actions**:
- [ ] Restart backend to apply phase timing fix
- [ ] Refresh frontend in browser (clear cache)
- [ ] Trigger a fresh scan on a test volume
- [ ] Verify timing data appears in database
- [ ] Check if progress is stable (no oscillating)
- [ ] Confirm completed phases are hidden

**Success Criteria**:
- `phase_started_at` is NOT NULL in database
- Progress bars don't jump backwards
- Filesystem indexing disappears when 100% done

**If this works** → Continue to Phase 1
**If this fails** → Debug issues, don't proceed

---

## 📊 Phase 1: Critical Data Quality Fixes

### 1.1 Fix Enrichment Manager Throughput Calculation
**Priority**: 🔴 CRITICAL
**Effort**: 1-2 hours
**Impact**: Restores user trust in all metrics

**Problem**: Shows 6,304 items/sec (impossible)
**Expected**: 5-50 items/sec (realistic)

**Files to Check**:
- `internal/services/enrichers/manager.go`
- Look for throughput calculation
- Ensure it uses `items / elapsed_time_since_phase_start`
- Add validation to reject values > 1000 items/sec

**Success Criteria**:
- Throughput shows 5-100 items/sec
- No spikes to thousands
- Matches actual scan performance

---

### 1.2 Verify Hybrid Progress Calculation is Working
**Priority**: 🔴 CRITICAL
**Effort**: 30 minutes
**Impact**: Accurate overall progress percentage

**Problem**: Shows 89% when should be 80%

**Tasks**:
- [ ] Verify backend was rebuilt with new `calculateOverallProgress` function
- [ ] Check calculation in running scan
- [ ] Test with different volume sizes
- [ ] Document complexity weights (filesystem: 1.0, media: 2.0)

**Success Criteria**:
- Overall progress matches intuition
- Progress = weighted items processed / weighted items total
- 80% really means 80% of weighted work done

---

### 1.3 Fix Phase Progress Field in Database
**Priority**: 🟡 HIGH
**Effort**: 1 hour
**Impact**: Phase summaries show correct percentages

**Problem**: Database has stale `progress_percent` (70%) vs actual (100%)

**Options**:
1. **Calculate on-the-fly** - Always use `items_processed / items_total`
2. **Update database field** - Fix when updating phase progress
3. **Use view calculation** - Frontend uses `phase_progress_percent` from view

**Recommended**: Option 2 - Update `progress_percent` field when updating phase

```sql
UPDATE scan_phases SET
    progress_percent = CASE
        WHEN items_total > 0 THEN (items_processed::float / items_total::float) * 100
        ELSE progress_percent
    END
```

**Success Criteria**:
- `progress_percent` matches `phase_progress_percent`
- PhaseIndicator shows correct values
- No more 70% when actually 100%

---

## 🎨 Phase 2: UI Polish & User Experience

### 2.1 Add Visual Progress Bars to PhaseIndicator
**Priority**: 🟡 HIGH
**Effort**: 30 minutes
**Impact**: Better visual feedback

**Current**: `🔵 Filesystem Indexing 75%` (text only)
**Desired**: `🔵 Filesystem Indexing ████████░░ 75%`

**Implementation**:
```tsx
<div className="flex items-center gap-2">
  {getIcon()}
  <span>{formatPhaseName(phase.phase_name)}</span>
  <div className="flex-1 h-1 bg-gray-200 rounded-full">
    <div className="h-full bg-blue-500 rounded-full transition-all"
         style={{ width: `${phase.progress}%` }} />
  </div>
  <span className="font-medium">{Math.round(phase.progress)}%</span>
</div>
```

---

### 2.2 Improve File Path Truncation
**Priority**: 🟢 MEDIUM
**Effort**: 30 minutes

**Current**: `.../Tom Jones (1963)/Tom Jones (1963) [imdbid-tt0057590] - [Remux-1080p][FLAC 1.0][AVC]-EPSiLON.mkv`
**Better**: `.../EPSiLON.mkv` or `.../Tom Jones (1963)/...EPSiLON.mkv`

**Logic**:
```typescript
function truncateFilePath(path: string): string {
  // If path > 80 chars, show just filename
  if (path.length > 80) {
    const parts = path.split('/');
    return `.../${parts[parts.length - 1]}`;
  }
  // Otherwise existing logic
  return path;
}
```

---

### 2.3 Remove Duplicate "Remaining" Time
**Priority**: 🟢 MEDIUM
**Effort**: 15 minutes

**Current**:
- Top stats: "Remaining: 1m 45s"
- Phase detail: "1m 45s remaining"

**Solution**: Show only in top stats, remove from phase detail

---

### 2.4 Redesign Phase Summary with Status Icons
**Priority**: 🟢 MEDIUM
**Effort**: 1 hour

**Current**:
```
Filesystem Indexing - 70%
Media Enrichment - 98%
```

**Better**:
```
✅ Volume Scan - Complete (31,793 items)
✅ Filesystem Indexing - Complete (14,433 files)
⚙️  Media Enrichment - 98% (9,000 / 9,152 files)
```

---

## 🔒 Phase 3: Validation & Safety

### 3.1 Add Throughput Validation
**Priority**: 🟢 MEDIUM
**Effort**: 30 minutes

```go
func validateThroughput(itemsPerSec float64) float64 {
    if itemsPerSec > 1000 {
        log.Warnf("Suspicious throughput: %.2f items/sec - capping at 1000", itemsPerSec)
        return 1000
    }
    if itemsPerSec < 0 {
        return 0
    }
    return itemsPerSec
}
```

---

### 3.2 Add Progress Bounds Checking
**Priority**: 🟢 MEDIUM
**Effort**: 30 minutes

**Backend validation**:
- Progress never > 100%
- Progress never < 0%
- Progress never decreases (unless new scan)

---

### 3.3 Add Database Constraints
**Priority**: 🔵 LOW
**Effort**: 1 hour

```sql
ALTER TABLE scan_phases
ADD CONSTRAINT progress_percent_range
CHECK (progress_percent >= 0 AND progress_percent <= 100);

ALTER TABLE scan_phases
ADD CONSTRAINT throughput_reasonable
CHECK (throughput_items_per_sec IS NULL OR
       (throughput_items_per_sec >= 0 AND throughput_items_per_sec <= 10000));
```

---

## 🚀 Phase 4: Enhanced Features (Future)

### 4.1 Add Cancel/Pause Buttons
**Priority**: 🔵 LOW
**Effort**: 2-3 hours

**User Stories**:
- As a user, I want to cancel a long-running scan
- As a user, I want to pause and resume scans

---

### 4.2 Add Error Log Viewer
**Priority**: 🔵 LOW
**Effort**: 3-4 hours

**Show**:
- Failed files count
- Recent errors (last 10)
- Error type distribution
- Retry functionality

---

### 4.3 Browser Notifications
**Priority**: 🔵 LOW
**Effort**: 1-2 hours

**Notify when**:
- Scan completes
- Scan fails
- Scan takes > 10 minutes

---

### 4.4 Mobile/Responsive Improvements
**Priority**: 🔵 LOW
**Effort**: 2-3 hours

**Optimize**:
- Progress bars on small screens
- File paths on mobile
- Touch-friendly controls

---

## 📋 Suggested Order of Execution

### Week 1: Get Data Quality Right
1. ✅ Deploy MVP fixes (15 min)
2. ✅ Test MVP fixes (30 min)
3. 🔴 Fix enrichment throughput (2 hours)
4. 🔴 Verify hybrid progress (30 min)
5. 🟡 Fix database progress_percent (1 hour)

**Goal**: All numbers are accurate and trustworthy

---

### Week 2: Polish the UI
6. 🟡 Add progress bars to phase summary (30 min)
7. 🟡 Better file path truncation (30 min)
8. 🟡 Remove duplicate times (15 min)
9. 🟡 Redesign phase summary (1 hour)

**Goal**: UI is clean, professional, easy to understand

---

### Week 3: Add Safety & Validation
10. 🟢 Add throughput validation (30 min)
11. 🟢 Add progress bounds checking (30 min)
12. 🟢 Add database constraints (1 hour)
13. 🟢 Add comprehensive tests (2 hours)

**Goal**: System is robust and catches errors

---

### Future: Enhanced Features
14. 🔵 Cancel/pause buttons
15. 🔵 Error log viewer
16. 🔵 Browser notifications
17. 🔵 Mobile optimization

**Goal**: Production-ready feature set

---

## 🎯 Quick Wins (Do Next!)

If you only have 2-3 hours, do these for maximum impact:

1. **Test MVP fixes** (30 min) - Verify our work!
2. **Fix enrichment throughput** (2 hours) - Biggest trust issue
3. **Add progress bars to phase summary** (30 min) - Quick visual win

These 3 tasks will give you:
- ✅ Stable progress bars
- ✅ Accurate throughput (30 items/sec not 6000!)
- ✅ Better visual feedback
- ✅ Hidden completed phases

---

## 🤔 Decision Points

### Should we fix current scan or wait for next one?

**Option A: Fix current scan** (Complex)
- Update database manually
- Set `phase_started_at` retroactively
- Recalculate throughput
- **Risk**: May cause inconsistencies

**Option B: Wait for next scan** (Simple) ✅ RECOMMENDED
- Our fixes apply automatically
- Clean slate, no manual intervention
- Easier to verify
- **Downside**: Can't test immediately

**Recommendation**: Wait for next scan OR trigger a fresh test scan

---

## 📊 Success Metrics

### Data Quality:
- [ ] Throughput: 5-100 items/sec (not 6000!)
- [ ] Progress: Stable, monotonic
- [ ] Timing: All phases have started_at

### User Experience:
- [ ] No oscillating progress bars
- [ ] Completed phases hidden
- [ ] Clear visual feedback
- [ ] Accurate time estimates

### Code Quality:
- [ ] Validation in place
- [ ] Tests added
- [ ] Documentation complete
- [ ] Edge cases handled

---

## 🆘 If Something Goes Wrong

### Progress bars still jumping?
- Check browser console for monotonic warnings
- Verify atom logic is executing
- Test with browser DevTools Performance tab

### Throughput still wrong?
- Check `phase_started_at` in database
- Verify enrichment manager is using it
- Add debug logging to calculation

### Overall progress wrong?
- Verify backend rebuilt
- Check `calculateOverallProgress` code
- Test calculation manually

---

**Ready to proceed? Start with deploying and testing the MVP fixes!** 🚀
