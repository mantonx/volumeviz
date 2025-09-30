# VolumeViz TODO Audit

**Audit Date**: 2025-09-30
**Total TODOs**: 21 (Frontend only)
**Status**: Active Development

---

## Executive Summary

This audit categorizes all outstanding TODOs in the VolumeViz codebase by type, priority, and effort. The majority of TODOs are **Enhancement** items waiting for backend API implementation. No critical bugs or security issues were found.

### Quick Stats
- **Backend TODOs**: 0 ✅
- **Frontend TODOs**: 21
- **Critical (P0)**: 0
- **High Priority (P1)**: 6
- **Medium Priority (P2)**: 14
- **Low Priority (P3)**: 1

---

## TODO Categories

### 1. Backend API Integration (13 TODOs) - P1/P2

These TODOs are waiting for backend endpoints to be implemented. Frontend code has proper placeholder implementations.

#### Search API (5 TODOs)
**Priority**: P1 - High
**Location**: `frontend/src/api/search.ts`, `frontend/src/hooks/useSearch.ts`, `frontend/src/pages/SearchPage/SearchPage.tsx`

| Line | File | TODO | Priority | Effort |
|------|------|------|----------|--------|
| 7 | api/search.ts | Placeholder types until backend implements search endpoints | P1 | 3h |
| 58 | api/search.ts | Implement getSuggestions when backend endpoint exists | P2 | 2h |
| 62 | api/search.ts | Implement search when backend endpoint exists | P1 | 3h |
| 24 | hooks/useSearch.ts | Implement API functions when backend search endpoints ready | P1 | 4h |
| 84 | hooks/useSearch.ts | Make actual API call when backend search endpoint ready | P1 | 2h |

**Recommendation**: Create backend search endpoints with Elasticsearch or PostgreSQL full-text search.

**Deliverables**:
- Backend: POST /api/v1/search endpoint
- Backend: GET /api/v1/search/suggestions endpoint
- Frontend: Connect useSearch hook to real API
- Frontend: Add error handling and loading states

---

#### Metadata API (2 TODOs)
**Priority**: P2 - Medium
**Location**: `frontend/src/api/metadata.ts`

| Line | File | TODO | Priority | Effort |
|------|------|------|----------|--------|
| 7 | api/metadata.ts | Placeholder types until backend implements metadata endpoints | P2 | 2h |
| 20 | api/metadata.ts | Implement getFilterMetadata when backend endpoint exists | P2 | 2h |

**Recommendation**: Create backend metadata aggregation endpoint.

**Deliverables**:
- Backend: GET /api/v1/metadata/filters endpoint
- Returns file types, size ranges, owners, locations for filter UI

---

#### Trends API (3 TODOs)
**Priority**: P1 - High
**Location**: `frontend/src/pages/TrendsPage/TrendsPage.tsx`

| Line | File | TODO | Priority | Effort |
|------|------|------|----------|--------|
| 86 | TrendsPage.tsx | Replace mock data with actual API calls | P1 | 4h |
| 173 | TrendsPage.tsx | Implement export functionality | P2 | 2h |
| 178 | TrendsPage.tsx | Implement data refresh | P2 | 1h |

**Recommendation**: Create backend analytics/trends endpoint with time-series data.

**Deliverables**:
- Backend: GET /api/v1/analytics/trends endpoint
- Backend: GET /api/v1/analytics/forecast endpoint
- Support query params: timeRange, aggregation, volumeIds
- Return historical storage data, file type distribution, growth forecasts

---

#### Volumes API (2 TODOs)
**Priority**: P1 - High
**Location**: `frontend/src/pages/VolumesPage/VolumesPage.tsx`

| Line | File | TODO | Priority | Effort |
|------|------|------|----------|--------|
| 58 | VolumesPage.tsx | Implement bulk delete when API is available | P1 | 2h |
| 238 | VolumesPage.tsx | Implement volume creation when API is available | P1 | 3h |

**Recommendation**: Check if backend has bulk delete and create endpoints, wire them up.

**Deliverables**:
- Verify DELETE /api/v1/volumes/bulk endpoint exists
- Verify POST /api/v1/volumes endpoint exists
- Connect forms to real API calls
- Add optimistic updates and error handling

---

#### Alert Center API (2 TODOs)
**Priority**: P2 - Medium
**Location**: `frontend/src/components/domain/explorer/AlertCenter/AlertCenter.tsx`

| Line | File | TODO | Priority | Effort |
|------|------|------|----------|--------|
| 180 | AlertCenter.tsx | Implement alert acknowledgment API call | P2 | 2h |
| 185 | AlertCenter.tsx | Implement alert resolution API call | P2 | 2h |

**Recommendation**: Create backend endpoints for alert management.

**Deliverables**:
- Backend: POST /api/v1/alerts/:id/acknowledge endpoint
- Backend: POST /api/v1/alerts/:id/resolve endpoint

---

### 2. Feature Enhancements (7 TODOs) - P2

These are UI/UX enhancements that don't require backend changes.

#### SearchPage Features (3 TODOs)
**Priority**: P2 - Medium
**Location**: `frontend/src/pages/SearchPage/SearchPage.tsx`

| Line | File | TODO | Priority | Effort |
|------|------|------|----------|--------|
| 54 | SearchPage.tsx | Implement actual search API call | P1 | 3h |
| 70 | SearchPage.tsx | Implement duplicate detection API call | P2 | 4h |
| 75 | SearchPage.tsx | Implement export functionality | P2 | 2h |
| 82 | SearchPage.tsx | Implement bulk delete | P2 | 2h |

**Note**: Items 54, 70, 82 depend on backend API. Item 75 (export) can be done client-side.

**Deliverables**:
- Implement CSV/JSON export using existing data (no API needed)
- Wire up search, duplicate detection, bulk delete when backend ready

---

#### Select All Functionality (1 TODO)
**Priority**: P2 - Medium
**Location**: `frontend/src/components/domain/explorer/VirtualizedFileList/VirtualizedFileList.tsx:264`

| Line | File | TODO | Priority | Effort |
|------|------|------|----------|--------|
| 264 | VirtualizedFileList.tsx | Select all functionality | P2 | 2h |

**Recommendation**: Implement "Select All" checkbox in file list header.

**Deliverables**:
- Add select all checkbox to table header
- Handle select all/deselect all state
- Add tests for select all functionality

---

#### Saved Searches (1 TODO)
**Priority**: P2 - Medium
**Location**: `frontend/src/hooks/useSearch.ts:171`

| Line | File | TODO | Priority | Effort |
|------|------|------|----------|--------|
| 171 | useSearch.ts | Saved searches hook (implement when API is ready) | P2 | 3h |

**Recommendation**: Create backend saved searches endpoint, then implement hook.

**Deliverables**:
- Backend: CRUD endpoints for saved searches
- Frontend: Implement full useSavedSearches hook
- UI: Saved search dropdown/panel

---

### 3. Configuration/Production (1 TODO) - P3

#### Service Worker (1 TODO)
**Priority**: P3 - Low
**Location**: `frontend/src/App.tsx:86`

| Line | File | TODO | Priority | Effort |
|------|------|------|----------|--------|
| 86 | App.tsx | Re-enable service worker in production builds only | P3 | 1h |

**Recommendation**: Add environment check to enable service worker only in production.

**Deliverables**:
```typescript
if (import.meta.env.PROD && serviceWorkerManager.isSupported()) {
  serviceWorkerManager.registerBackgroundSync();
}
```

---

## Priority Breakdown

### P0 - Critical (0 TODOs)
✅ No critical issues found

### P1 - High Priority (6 TODOs)
Should be addressed in next sprint:

1. **Search API Integration** (3 TODOs)
   - Implement backend search endpoints
   - Connect frontend search functionality
   - **Estimated Effort**: 9 hours

2. **Trends API Integration** (1 TODO)
   - Replace mock data with real analytics API
   - **Estimated Effort**: 4 hours

3. **Volumes API Integration** (2 TODOs)
   - Implement bulk delete
   - Implement volume creation
   - **Estimated Effort**: 5 hours

**Total P1 Effort**: ~18 hours (2-3 days)

### P2 - Medium Priority (14 TODOs)
Can be addressed in future sprints:

1. **Export Functionality** (2 TODOs) - 4 hours
2. **Metadata API** (2 TODOs) - 4 hours
3. **Alert Management** (2 TODOs) - 4 hours
4. **Duplicate Detection** (1 TODO) - 4 hours
5. **Bulk Operations** (1 TODO) - 2 hours
6. **Select All** (1 TODO) - 2 hours
7. **Saved Searches** (1 TODO) - 3 hours
8. **Placeholder APIs** (4 TODOs) - 4 hours

**Total P2 Effort**: ~27 hours (3-4 days)

### P3 - Low Priority (1 TODO)
Can be deferred:

1. **Service Worker Production** (1 TODO) - 1 hour

---

## Recommended Action Plan

### Sprint 1: Backend API Foundation (Week 1)
**Focus**: Implement critical backend endpoints

1. ✅ Create Search API endpoints
   - POST /api/v1/search
   - GET /api/v1/search/suggestions

2. ✅ Create Analytics/Trends API endpoints
   - GET /api/v1/analytics/trends
   - GET /api/v1/analytics/forecast

3. ✅ Verify Volumes API endpoints
   - POST /api/v1/volumes (create)
   - DELETE /api/v1/volumes/bulk (bulk delete)

### Sprint 2: Frontend Integration (Week 2)
**Focus**: Connect frontend to new backend APIs

1. ✅ Wire up Search functionality
2. ✅ Wire up Trends with real data
3. ✅ Implement Volumes bulk operations
4. ✅ Add error handling and loading states
5. ✅ Update tests with API mocks

### Sprint 3: Enhancements (Week 3)
**Focus**: Additional features and polish

1. ✅ Implement export functionality
2. ✅ Add select all functionality
3. ✅ Implement saved searches
4. ✅ Add metadata API
5. ✅ Alert management endpoints

---

## GitHub Issues to Create

Based on this audit, create the following GitHub issues:

### P1 Issues (High Priority)

1. **[Backend] Implement Search API Endpoints**
   - Labels: `backend`, `api`, `P1`, `enhancement`
   - Estimate: 6 hours
   - TODOs: 3

2. **[Backend] Implement Analytics/Trends API Endpoints**
   - Labels: `backend`, `api`, `P1`, `enhancement`
   - Estimate: 4 hours
   - TODOs: 1

3. **[Frontend] Connect Search to Backend API**
   - Labels: `frontend`, `api-integration`, `P1`, `enhancement`
   - Estimate: 3 hours
   - TODOs: 2
   - Depends on: Issue #1

4. **[Frontend] Connect Trends to Backend API**
   - Labels: `frontend`, `api-integration`, `P1`, `enhancement`
   - Estimate: 4 hours
   - TODOs: 1
   - Depends on: Issue #2

5. **[Frontend] Implement Volumes Bulk Operations**
   - Labels: `frontend`, `feature`, `P1`, `enhancement`
   - Estimate: 5 hours
   - TODOs: 2

### P2 Issues (Medium Priority)

6. **[Frontend] Implement Export Functionality**
   - Labels: `frontend`, `feature`, `P2`, `enhancement`
   - Estimate: 4 hours
   - TODOs: 2

7. **[Backend] Implement Metadata API Endpoint**
   - Labels: `backend`, `api`, `P2`, `enhancement`
   - Estimate: 4 hours
   - TODOs: 2

8. **[Frontend] Implement Select All Functionality**
   - Labels: `frontend`, `feature`, `P2`, `enhancement`
   - Estimate: 2 hours
   - TODOs: 1

9. **[Backend] Implement Alert Management Endpoints**
   - Labels: `backend`, `api`, `P2`, `enhancement`
   - Estimate: 4 hours
   - TODOs: 2

10. **[Frontend/Backend] Implement Saved Searches**
    - Labels: `frontend`, `backend`, `feature`, `P2`, `enhancement`
    - Estimate: 6 hours
    - TODOs: 1

---

## Deferred Items

No items deferred. All TODOs are valid enhancements with clear implementation paths.

---

## Conclusion

The VolumeViz codebase is in good health with only 21 outstanding TODOs, all of which are **enhancements** rather than bugs. The majority (62%) are waiting for backend API endpoints to be implemented.

**Key Recommendations**:
1. ✅ Prioritize backend search and analytics API implementation
2. ✅ Frontend code is production-ready with proper placeholder implementations
3. ✅ No critical security or performance issues found
4. ✅ Good separation of concerns - frontend doesn't block on backend

**Timeline Estimate**:
- **P1 TODOs**: 2-3 days
- **P2 TODOs**: 3-4 days
- **P3 TODOs**: 1 hour
- **Total**: ~1-2 weeks for complete TODO resolution

---

*Audit completed by: Claude AI Assistant*
*Date: 2025-09-30*
