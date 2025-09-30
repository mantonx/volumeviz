# GitHub Issues to Create

**Generated from**: TODO_AUDIT.md
**Date**: 2025-09-30
**Total Issues**: 10 (5 P1, 5 P2)

---

## P1 - High Priority Issues (Create First)

### Issue #1: [Backend] Implement Search API Endpoints

**Priority**: P1 - High
**Estimate**: 6 hours
**Labels**: `backend`, `api`, `P1`, `enhancement`, `search`

**Description**:
Implement backend search endpoints to enable full-text search functionality across volumes and files.

**Related TODOs**:
- `api/search.ts:7` - Placeholder types
- `api/search.ts:58` - getSuggestions endpoint
- `api/search.ts:62` - search endpoint
- `hooks/useSearch.ts:24,84` - API integration

**Requirements**:
1. POST /api/v1/search - Full-text search with filters
2. GET /api/v1/search/suggestions - Real-time suggestions
3. Support pagination, relevance scoring
4. PostgreSQL full-text search or Elasticsearch

**Acceptance Criteria**:
- [ ] Endpoints implemented and tested
- [ ] OpenAPI spec updated
- [ ] Performance tested with 10k+ files

---

### Issue #2: [Backend] Implement Analytics/Trends API Endpoints

**Priority**: P1 - High
**Estimate**: 4 hours
**Labels**: `backend`, `api`, `P1`, `enhancement`, `analytics`

**Description**:
Implement analytics endpoints to provide historical storage data and capacity forecasts for the TrendsPage.

**Related TODOs**:
- `TrendsPage.tsx:86` - Replace mock data with API calls

**Requirements**:
1. GET /api/v1/analytics/trends
   - Historical storage growth data
   - File type distribution
   - Volume growth comparisons
   - Support time range and aggregation parameters

2. GET /api/v1/analytics/forecast
   - 90-day capacity predictions
   - Confidence intervals
   - Threshold warnings

**Query Parameters**:
- `timeRange`: day|week|month|quarter|year|all
- `aggregation`: hour|day|week|month
- `volumeIds`: comma-separated volume IDs (optional)
- `dateFrom`, `dateTo`: ISO date range (optional)

**Response Schema**:
```json
{
  "growth_data": [
    {
      "timestamp": "2025-09-30T00:00:00Z",
      "total_size": 5000000000,
      "volume_count": 15,
      "file_count": 25000
    }
  ],
  "file_types": [
    {
      "type": "video",
      "count": 1250,
      "total_size": 5000000000,
      "percentage": 45
    }
  ],
  "forecast": [
    {
      "date": "2025-10-30T00:00:00Z",
      "predicted_size": 6000000000,
      "confidence_interval": {
        "lower": 5400000000,
        "upper": 6600000000
      }
    }
  ]
}
```

**Acceptance Criteria**:
- [ ] Both endpoints implemented
- [ ] Time-series data aggregation working
- [ ] Forecast algorithm implemented (linear regression minimum)
- [ ] OpenAPI spec updated
- [ ] Performance optimized for historical queries

---

### Issue #3: [Frontend] Connect Search to Backend API

**Priority**: P1 - High
**Estimate**: 3 hours
**Labels**: `frontend`, `api-integration`, `P1`, `enhancement`
**Depends on**: Issue #1

**Description**:
Connect SearchPage and search hooks to the new backend search API endpoints.

**Related TODOs**:
- `SearchPage.tsx:54` - Implement actual search API call
- `hooks/useSearch.ts:84` - Make actual API call

**Requirements**:
1. Update `useSearch` hook to call real API
2. Remove mock data and placeholder implementations
3. Add proper error handling and loading states
4. Update tests with API mocks
5. Add optimistic updates for better UX

**Files to Update**:
- `frontend/src/hooks/useSearch.ts`
- `frontend/src/pages/SearchPage/SearchPage.tsx`
- `frontend/src/api/search.ts`

**Acceptance Criteria**:
- [ ] Search functionality works with real API
- [ ] Suggestions work in real-time
- [ ] Error states handled gracefully
- [ ] Loading states shown appropriately
- [ ] Tests updated with MSW mocks

---

### Issue #4: [Frontend] Connect Trends to Backend API

**Priority**: P1 - High
**Estimate**: 4 hours
**Labels**: `frontend`, `api-integration`, `P1`, `enhancement`
**Depends on**: Issue #2

**Description**:
Replace mock data in TrendsPage with real analytics API integration.

**Related TODOs**:
- `TrendsPage.tsx:86` - Replace mock data
- `TrendsPage.tsx:178` - Implement data refresh

**Requirements**:
1. Create analytics API hooks using TanStack Query
2. Replace all mock data with API calls
3. Implement refresh functionality
4. Add error handling for failed analytics queries
5. Show loading states during data fetch

**New Hooks to Create**:
```typescript
// frontend/src/hooks/api/useAnalytics.ts
export const useStorageTrends = (filters: TrendFilters) => { ... }
export const useCapacityForecast = (days: number) => { ... }
export const useFileTypeDistribution = () => { ... }
```

**Acceptance Criteria**:
- [ ] All charts show real data
- [ ] Time range filters work correctly
- [ ] Aggregation options work
- [ ] Refresh button works
- [ ] Loading/error states implemented
- [ ] Tests updated

---

### Issue #5: [Frontend] Implement Volumes Bulk Operations

**Priority**: P1 - High
**Estimate**: 5 hours
**Labels**: `frontend`, `feature`, `P1`, `enhancement`

**Description**:
Implement bulk delete and volume creation functionality in VolumesPage.

**Related TODOs**:
- `VolumesPage.tsx:58` - Bulk delete
- `VolumesPage.tsx:238` - Volume creation

**Requirements**:
1. **Bulk Delete**:
   - Confirm before deleting multiple volumes
   - Show progress during bulk operation
   - Handle partial failures gracefully
   - Refresh list after deletion

2. **Volume Creation**:
   - Form validation
   - Create Docker volume via API
   - Optimistic UI updates
   - Error handling

**API Endpoints** (verify these exist):
- POST /api/v1/volumes - Create volume
- DELETE /api/v1/volumes/bulk - Bulk delete

**Acceptance Criteria**:
- [ ] Bulk delete confirmation modal works
- [ ] Bulk delete handles errors per-volume
- [ ] Volume creation form validates input
- [ ] Both operations show loading states
- [ ] Success/error toasts displayed
- [ ] Volume list refreshes after operations
- [ ] Tests for both operations

---

## P2 - Medium Priority Issues (Create After P1)

### Issue #6: [Frontend] Implement Export Functionality

**Priority**: P2 - Medium
**Estimate**: 4 hours
**Labels**: `frontend`, `feature`, `P2`, `enhancement`

**Description**:
Implement CSV and JSON export functionality for SearchPage and TrendsPage.

**Related TODOs**:
- `SearchPage.tsx:75` - Export search results
- `TrendsPage.tsx:173` - Export trend data

**Requirements**:
1. Export search results to CSV/JSON
2. Export trends data to CSV/JSON
3. Include all visible columns/data
4. Proper filename with timestamp
5. Client-side implementation (no backend needed)

**Libraries to Use**:
- `papaparse` for CSV generation
- Native JSON.stringify for JSON

**Features**:
- Export current filtered results
- Include metadata (export date, filters applied)
- Download with descriptive filename: `volumeviz-search-2025-09-30.csv`

**Acceptance Criteria**:
- [ ] CSV export works
- [ ] JSON export works
- [ ] Files have proper structure
- [ ] Filenames include timestamp
- [ ] Export only visible/filtered data
- [ ] Tests for export functions

---

### Issue #7: [Backend] Implement Metadata API Endpoint

**Priority**: P2 - Medium
**Estimate**: 4 hours
**Labels**: `backend`, `api`, `P2`, `enhancement`

**Description**:
Implement metadata aggregation endpoint to provide filter options for the UI.

**Related TODOs**:
- `api/metadata.ts:7,20` - Metadata API placeholders

**Requirements**:
Create GET /api/v1/metadata/filters endpoint that returns:

```json
{
  "file_types": ["video", "image", "document", "audio", "archive"],
  "size_ranges": [
    { "min": 0, "max": 1048576, "label": "< 1 MB" },
    { "min": 1048576, "max": 10485760, "label": "1-10 MB" },
    { "min": 10485760, "max": 104857600, "label": "10-100 MB" },
    { "min": 104857600, "max": 1073741824, "label": "100 MB - 1 GB" },
    { "min": 1073741824, "max": null, "label": "> 1 GB" }
  ],
  "owners": ["user1", "user2", "root"],
  "locations": ["/data", "/media", "/backups"]
}
```

**Implementation**:
- Aggregate data from scanned files
- Cache results for performance
- Update cache on volume scans

**Acceptance Criteria**:
- [ ] Endpoint returns proper metadata
- [ ] Results are cached (1 hour TTL)
- [ ] Cache invalidated on new scans
- [ ] OpenAPI spec updated

---

### Issue #8: [Frontend] Implement Select All Functionality

**Priority**: P2 - Medium
**Estimate**: 2 hours
**Labels**: `frontend`, `feature`, `P2`, `enhancement`

**Description**:
Add "Select All" checkbox to VirtualizedFileList component.

**Related TODOs**:
- `VirtualizedFileList.tsx:264` - Select all functionality

**Requirements**:
1. Add checkbox to table header
2. Select/deselect all visible files
3. Update selected count
4. Enable bulk actions when items selected
5. Handle virtual scrolling edge cases

**Acceptance Criteria**:
- [ ] Select all checkbox in header
- [ ] Selects all files in current view
- [ ] Works with pagination
- [ ] Indeterminate state for partial selection
- [ ] Tests for select all scenarios

---

### Issue #9: [Backend] Implement Alert Management Endpoints

**Priority**: P2 - Medium
**Estimate**: 4 hours
**Labels**: `backend`, `api`, `P2`, `enhancement`, `alerts`

**Description**:
Implement alert acknowledgment and resolution endpoints for the AlertCenter.

**Related TODOs**:
- `AlertCenter.tsx:180` - Alert acknowledgment
- `AlertCenter.tsx:185` - Alert resolution

**Requirements**:
1. POST /api/v1/alerts/:id/acknowledge
   - Mark alert as acknowledged by user
   - Record timestamp and user

2. POST /api/v1/alerts/:id/resolve
   - Mark alert as resolved
   - Record resolution notes (optional)
   - Timestamp and user

**Response Schema**:
```json
{
  "id": "alert-123",
  "status": "acknowledged",
  "acknowledged_at": "2025-09-30T12:00:00Z",
  "acknowledged_by": "user@example.com"
}
```

**Acceptance Criteria**:
- [ ] Both endpoints implemented
- [ ] Alert status updated in database
- [ ] Audit log entries created
- [ ] OpenAPI spec updated
- [ ] Tests added

---

### Issue #10: [Frontend/Backend] Implement Saved Searches

**Priority**: P2 - Medium
**Estimate**: 6 hours
**Labels**: `frontend`, `backend`, `feature`, `P2`, `enhancement`

**Description**:
Implement saved searches functionality allowing users to save and reuse common search queries.

**Related TODOs**:
- `useSearch.ts:171` - Saved searches hook

**Backend Requirements**:
Create CRUD endpoints for saved searches:
- GET /api/v1/search/saved
- POST /api/v1/search/saved
- PUT /api/v1/search/saved/:id
- DELETE /api/v1/search/saved/:id

**Database Schema**:
```sql
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  query TEXT NOT NULL,
  filters JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Frontend Requirements**:
1. Implement full useSavedSearches hook
2. Add "Save Search" button to SearchPage
3. Add saved searches dropdown/panel
4. Quick load saved search
5. Edit/delete saved searches

**Acceptance Criteria**:
- [ ] Backend CRUD endpoints working
- [ ] Frontend hook implemented
- [ ] UI for managing saved searches
- [ ] Tests for backend and frontend
- [ ] OpenAPI spec updated

---

## Summary

**Total Issues**: 10
**P1 Issues**: 5 (estimated 22 hours)
**P2 Issues**: 5 (estimated 20 hours)
**Total Effort**: ~42 hours (5-6 days)

### Implementation Order

**Week 1 - P1 Backend Foundation**:
1. Issue #1: Search API (6h)
2. Issue #2: Analytics API (4h)

**Week 2 - P1 Frontend Integration**:
3. Issue #5: Volumes Bulk Ops (5h)
4. Issue #3: Connect Search (3h)
5. Issue #4: Connect Trends (4h)

**Week 3 - P2 Enhancements**:
6. Issue #6: Export (4h)
7. Issue #8: Select All (2h)
8. Issue #7: Metadata API (4h)
9. Issue #9: Alert Management (4h)
10. Issue #10: Saved Searches (6h)

---

## Instructions for Creating Issues

To create these issues in GitHub, either:

1. **Manual Creation**: Copy each issue section and create manually
2. **GitHub CLI**: Use `gh issue create` with the content
3. **GitHub API**: Script the creation using GitHub's REST API

### GitHub CLI Example:
```bash
gh issue create \
  --title "[Backend] Implement Search API Endpoints" \
  --body "$(cat issue-1.md)" \
  --label "backend,api,P1,enhancement,search"
```

Make sure to create labels first if they don't exist:
```bash
gh label create "P1" --color "d73a4a" --description "High priority"
gh label create "P2" --color "fbca04" --description "Medium priority"
gh label create "backend" --color "0052cc" --description "Backend changes"
gh label create "frontend" --color "1d76db" --description "Frontend changes"
```

---

*Generated from TODO_AUDIT.md on 2025-09-30*
