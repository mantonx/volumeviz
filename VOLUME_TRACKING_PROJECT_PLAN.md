# Volume Tracking/Untracking Feature - Project Plan

## Overview
Add ability for users to track/untrack Docker volumes, where untracked volumes have all their data removed from the database but the actual Docker volume remains intact (read-only app).

## Requirements
1. **Track/Untrack Functionality**
   - Add `is_tracked` boolean field to volumes
   - When untracked: remove all related data (scans, files, folders, statistics)
   - Docker volume itself remains untouched (read-only)

2. **UI Requirements**
   - Clear visual indication of tracked vs untracked status on `/volumes` page
   - Easy-to-use toggle mechanism (dropdown menu or button)
   - Confirmation dialog for untracking (data will be deleted)
   - Filter to show tracked/untracked/all volumes

3. **Data Management**
   - Cascade delete all volume-related data when untracked
   - Prevent scanning of untracked volumes
   - Allow re-tracking (volume will be re-discovered and scanned)

---

## Database Schema Changes

### Migration: `000016_add_volume_tracking.up.sql`

```sql
-- Add is_tracked column to volumes table
ALTER TABLE volumes
ADD COLUMN is_tracked BOOLEAN NOT NULL DEFAULT true;

-- Add index for filtering tracked volumes
CREATE INDEX idx_volumes_is_tracked ON volumes(is_tracked);

-- Add index for common query pattern (tracked + organization)
CREATE INDEX idx_volumes_tracked_org ON volumes(is_tracked, organization_id)
WHERE organization_id IS NOT NULL;

-- Comment on column
COMMENT ON COLUMN volumes.is_tracked IS
'Whether this volume is actively tracked. Untracked volumes have no data in the system but Docker volume still exists.';
```

### Migration: `000016_add_volume_tracking.down.sql`

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_volumes_tracked_org;
DROP INDEX IF EXISTS idx_volumes_is_tracked;

-- Remove column
ALTER TABLE volumes DROP COLUMN IF EXISTS is_tracked;
```

---

## Backend Changes

### 1. **Model Updates**

**File:** `internal/models/volume.go`

```go
type Volume struct {
    ID             int64             `json:"id"`
    VolumeID       string            `json:"volume_id"`
    Name           string            `json:"name"`
    Driver         string            `json:"driver"`
    Mountpoint     string            `json:"mountpoint"`
    Labels         map[string]string `json:"labels,omitempty"`
    Options        map[string]string `json:"options,omitempty"`
    Scope          string            `json:"scope"`
    Status         string            `json:"status"`
    UsageData      *VolumeUsage      `json:"usage_data,omitempty"`
    LastScanned    *time.Time        `json:"last_scanned,omitempty"`
    IsActive       bool              `json:"is_active"`
    IsTracked      bool              `json:"is_tracked"`        // NEW
    OrganizationID *int64            `json:"organization_id,omitempty"`
    CreatedAt      time.Time         `json:"created_at"`
    UpdatedAt      time.Time         `json:"updated_at"`
}
```

### 2. **Repository Layer**

**File:** `internal/repo/volumes_repo.go` (or create new file)

Add methods:
```go
// SetVolumeTracked sets the tracked status of a volume
SetVolumeTracked(ctx context.Context, volumeID string, tracked bool) error

// GetUntrackedVolumes returns all untracked volumes
GetUntrackedVolumes(ctx context.Context, orgID *int64) ([]models.Volume, error)

// DeleteVolumeData removes all data associated with a volume (when untracking)
DeleteVolumeData(ctx context.Context, volumeID string) error
```

**SQL Queries:** `internal/repo/queries-postgresql/volumes.sql`

```sql
-- name: SetVolumeTracked :exec
UPDATE volumes
SET is_tracked = $2, updated_at = NOW()
WHERE volume_id = $1;

-- name: GetUntrackedVolumes :many
SELECT * FROM volumes
WHERE is_tracked = false
AND ($1::bigint IS NULL OR organization_id = $1)
ORDER BY volume_id;

-- name: DeleteVolumeData :exec
-- Delete all related data when untracking
DELETE FROM scan_results WHERE volume_id = $1;
DELETE FROM files WHERE volume_id = $1;
DELETE FROM folders WHERE volume_id = $1;
DELETE FROM volume_sizes WHERE volume_id = $1;
DELETE FROM volume_snapshots WHERE volume_id = $1;
DELETE FROM scan_checkpoints WHERE volume_id = $1;
-- Note: We keep the volume record itself with is_tracked=false
```

### 3. **Service Layer**

**File:** `internal/service/volume_tracking_service.go` (NEW)

```go
package service

import (
    "context"
    "fmt"
    "github.com/mantonx/volumeviz/internal/interfaces"
    "github.com/mantonx/volumeviz/internal/models"
    "github.com/mantonx/volumeviz/internal/store"
)

type VolumeTrackingService struct {
    store     store.Store
    publisher interfaces.EventPublisher
}

func NewVolumeTrackingService(store store.Store, publisher interfaces.EventPublisher) *VolumeTrackingService {
    return &VolumeTrackingService{
        store:     store,
        publisher: publisher,
    }
}

// UntrackVolume marks a volume as untracked and removes all related data
func (s *VolumeTrackingService) UntrackVolume(ctx context.Context, volumeID string) error {
    // Start transaction
    tx, err := s.store.BeginTx(ctx)
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer tx.Rollback()

    // Delete all volume data
    if err := s.store.DeleteVolumeData(ctx, volumeID); err != nil {
        return fmt.Errorf("failed to delete volume data: %w", err)
    }

    // Mark as untracked
    if err := s.store.SetVolumeTracked(ctx, volumeID, false); err != nil {
        return fmt.Errorf("failed to set volume as untracked: %w", err)
    }

    // Commit transaction
    if err := tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    // Publish event
    if s.publisher != nil {
        s.publisher.Publish("volume.untracked", map[string]interface{}{
            "volume_id": volumeID,
        })
    }

    return nil
}

// TrackVolume marks a volume as tracked (will be rescanned)
func (s *VolumeTrackingService) TrackVolume(ctx context.Context, volumeID string) error {
    if err := s.store.SetVolumeTracked(ctx, volumeID, true); err != nil {
        return fmt.Errorf("failed to set volume as tracked: %w", err)
    }

    // Publish event
    if s.publisher != nil {
        s.publisher.Publish("volume.tracked", map[string]interface{}{
            "volume_id": volumeID,
        })
    }

    return nil
}

// GetUntrackedVolumes returns all untracked volumes
func (s *VolumeTrackingService) GetUntrackedVolumes(ctx context.Context, orgID *int64) ([]models.Volume, error) {
    return s.store.GetUntrackedVolumes(ctx, orgID)
}
```

### 4. **API Handler**

**File:** `internal/api/v1/volumes/handler.go`

Add methods:
```go
// UntrackVolume handles untracking a volume
// @Summary Untrack a volume
// @Description Marks a volume as untracked and removes all related data
// @Tags volumes
// @Param name path string true "Volume name"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /volumes/{name}/untrack [post]
func (h *Handler) UntrackVolume(c *gin.Context) {
    volumeName := c.Param("name")

    // Call service
    if err := h.trackingService.UntrackVolume(c.Request.Context(), volumeName); err != nil {
        c.JSON(500, models.ErrorResponse{
            Error:   "Failed to untrack volume",
            Message: err.Error(),
        })
        return
    }

    c.JSON(200, gin.H{
        "message": "Volume untracked successfully",
        "volume_id": volumeName,
    })
}

// TrackVolume handles tracking a volume
// @Summary Track a volume
// @Description Marks a volume as tracked (will be scanned)
// @Tags volumes
// @Param name path string true "Volume name"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} models.ErrorResponse
// @Failure 404 {object} models.ErrorResponse
// @Failure 500 {object} models.ErrorResponse
// @Router /volumes/{name}/track [post]
func (h *Handler) TrackVolume(c *gin.Context) {
    volumeName := c.Param("name")

    // Call service
    if err := h.trackingService.TrackVolume(c.Request.Context(), volumeName); err != nil {
        c.JSON(500, models.ErrorResponse{
            Error:   "Failed to track volume",
            Message: err.Error(),
        })
        return
    }

    c.JSON(200, gin.H{
        "message": "Volume tracked successfully",
        "volume_id": volumeName,
    })
}
```

### 5. **Router Updates**

**File:** `internal/api/v1/volumes/router.go`

```go
func (r *Router) RegisterRoutes(group *gin.RouterGroup) {
    volumes := group.Group("/volumes")
    {
        // ... existing routes ...

        // Tracking endpoints (NEW)
        volumes.POST("/:name/track", r.handler.TrackVolume)
        volumes.POST("/:name/untrack", r.handler.UntrackVolume)
    }
}
```

### 6. **Volume Discovery/Sync Updates**

**File:** `internal/service/volume_sync_service.go` (or wherever volume discovery happens)

Update to skip untracked volumes during sync:
```go
func (s *VolumeSyncService) SyncVolumes(ctx context.Context) error {
    // ... discover volumes from Docker ...

    for _, volume := range dockerVolumes {
        existingVolume, err := s.store.GetVolume(ctx, volume.Name)
        if err == nil && !existingVolume.IsTracked {
            // Skip untracked volumes
            continue
        }

        // ... process tracked volumes ...
    }
}
```

---

## Frontend Changes

### 1. **API Client Updates**

**File:** `frontend/src/api/orval.config.ts` or manual addition

After running `orval` code generation, you should have:
```typescript
// Track a volume
export const usePostVolumesNameTrack = () => {
  return useMutation({
    mutationFn: (name: string) =>
      api.post(`/api/v1/volumes/${name}/track`),
  });
};

// Untrack a volume
export const usePostVolumesNameUntrack = () => {
  return useMutation({
    mutationFn: (name: string) =>
      api.post(`/api/v1/volumes/${name}/untrack`),
  });
};
```

### 2. **Volume Model Updates**

**File:** `frontend/src/types/volume.ts` (or wherever type is defined)

```typescript
export interface Volume {
  id: number;
  volume_id: string;
  name: string;
  driver: string;
  mountpoint: string;
  labels?: Record<string, string>;
  options?: Record<string, string>;
  scope: string;
  status: string;
  usage_data?: VolumeUsage;
  last_scanned?: string;
  is_active: boolean;
  is_tracked: boolean;  // NEW
  organization_id?: number;
  created_at: string;
  updated_at: string;
}
```

### 3. **Volume Table Updates**

**File:** `frontend/src/components/domain/volumes/VolumeTable/VolumeTable.tsx`

```typescript
// Add tracked status badge
const TrackedBadge: React.FC<{ isTracked: boolean }> = ({ isTracked }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        isTracked
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
      )}
    >
      {isTracked ? 'Tracked' : 'Untracked'}
    </span>
  );
};

// In the table row, add badge next to volume name
<td className="px-6 py-4 whitespace-nowrap">
  <div className="flex items-center">
    {/* ... expand button, icon ... */}
    <div>
      <div className="flex items-center gap-2">
        <button /* ... volume name button ... */>
          {volume.name}
        </button>
        <TrackedBadge isTracked={volume.is_tracked} />
      </div>
      {/* ... mount point ... */}
    </div>
  </div>
</td>
```

### 4. **Dropdown Menu Updates**

**File:** `frontend/src/components/domain/volumes/VolumeTable/VolumeTable.tsx`

```typescript
// Add track/untrack actions to dropdown menu
<Dropdown
  items={[
    {
      label: 'View Details',
      icon: Info,
      onClick: () => openVolumeModal(volumeId),
    },
    {
      label: 'Scan Volume',
      icon: ScanSearch,
      onClick: () => {
        // ... scan logic ...
      },
    },
    // NEW: Track/Untrack option
    {
      label: volume.is_tracked ? 'Untrack Volume' : 'Track Volume',
      icon: volume.is_tracked ? EyeOff : Eye,
      onClick: () => handleTrackingToggle(volumeId, volume.is_tracked),
      divider: true,
    },
    {
      label: 'Delete Volume',
      icon: Trash2,
      onClick: () => {
        console.log('Delete volume:', volumeId);
      },
      destructive: true,
    },
  ]}
  trigger={<MoreVertical className="w-4 h-4 text-secondary" />}
  align="right"
/>
```

### 5. **Tracking Toggle Handler**

**File:** `frontend/src/components/domain/volumes/VolumeTable/VolumeTable.tsx`

```typescript
import { usePostVolumesNameTrack, usePostVolumesNameUntrack } from '@/api/orval-generated/api';

// Inside component
const trackMutation = usePostVolumesNameTrack();
const untrackMutation = usePostVolumesNameUntrack();
const [confirmUntrackOpen, setConfirmUntrackOpen] = useState(false);
const [volumeToUntrack, setVolumeToUntrack] = useState<string | null>(null);

const handleTrackingToggle = (volumeId: string, currentlyTracked: boolean) => {
  if (currentlyTracked) {
    // Show confirmation dialog for untracking
    setVolumeToUntrack(volumeId);
    setConfirmUntrackOpen(true);
  } else {
    // Track immediately
    trackMutation.mutate(volumeId, {
      onSuccess: () => {
        // Refetch volumes or show success message
        queryClient.invalidateQueries(['volumes']);
      },
    });
  }
};

const handleConfirmUntrack = () => {
  if (!volumeToUntrack) return;

  untrackMutation.mutate(volumeToUntrack, {
    onSuccess: () => {
      setConfirmUntrackOpen(false);
      setVolumeToUntrack(null);
      // Refetch volumes
      queryClient.invalidateQueries(['volumes']);
    },
  });
};
```

### 6. **Confirmation Modal**

**File:** `frontend/src/components/domain/volumes/VolumeTable/UntrackConfirmationModal.tsx` (NEW)

```typescript
import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

interface UntrackConfirmationModalProps {
  isOpen: boolean;
  volumeId: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const UntrackConfirmationModal: React.FC<UntrackConfirmationModalProps> = ({
  isOpen,
  volumeId,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Untrack Volume">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <p className="text-sm text-secondary">
              Are you sure you want to untrack <strong>{volumeId}</strong>?
            </p>
            <ul className="mt-2 text-sm text-secondary list-disc list-inside space-y-1">
              <li>All scan data will be permanently deleted</li>
              <li>File and folder information will be removed</li>
              <li>Statistics and snapshots will be deleted</li>
              <li>The Docker volume itself will remain intact</li>
            </ul>
            <p className="mt-3 text-sm font-medium text-primary">
              You can track this volume again later, but it will need to be rescanned.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-line">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            loading={isLoading}
          >
            Untrack Volume
          </Button>
        </div>
      </div>
    </Modal>
  );
};
```

### 7. **Filter Updates**

**File:** `frontend/src/components/domain/volumes/VolumesList/VolumesList.tsx`

Add filter for tracked status:
```typescript
const [trackingFilter, setTrackingFilter] = useState<'all' | 'tracked' | 'untracked'>('all');

// In filter UI
<select
  value={trackingFilter}
  onChange={(e) => setTrackingFilter(e.target.value as any)}
  className="..."
>
  <option value="all">All Volumes</option>
  <option value="tracked">Tracked Only</option>
  <option value="untracked">Untracked Only</option>
</select>

// Filter volumes
const filteredVolumes = volumes?.filter(volume => {
  if (trackingFilter === 'tracked') return volume.is_tracked;
  if (trackingFilter === 'untracked') return !volume.is_tracked;
  return true;
});
```

### 8. **Visual Updates for Untracked Volumes**

Make untracked volumes visually distinct:
```typescript
// In table row
<tr
  className={cn(
    'border-b border-line hover:bg-surface-hover cursor-pointer transition-colors',
    !volume.is_tracked && 'opacity-60 bg-gray-50 dark:bg-gray-900/50'
  )}
>
```

---

## Implementation Phases

### Phase 0: Delete Functionality Removal (1-2 days)
**Must be completed first to reinforce read-only nature**

1. **Backend Cleanup**
   - Remove `BulkDeleteVolumes` handler method
   - Remove delete endpoint from router
   - Remove delete models (BulkDeleteVolumesRequest, BulkDeleteVolumesResponse)
   - Update OpenAPI spec
   - Run `swag init` to regenerate swagger docs

2. **Frontend Cleanup**
   - Remove Trash2 icon and delete menu item from VolumeTable
   - Remove bulk delete modal and handler from VolumesPage
   - Remove delete-related imports (Trash2 icon)
   - Update Storybook documentation
   - Remove delete from mock handlers

3. **API Client Regeneration**
   - Run `npm run generate:api` to regenerate without delete endpoints

4. **Documentation Updates**
   - Add "Read-Only Design" section to README
   - Update user guide to clarify no delete capability
   - Remove delete references from all docs

5. **Verification**
   - Run grep commands to find remaining delete references
   - Test that UI no longer shows delete options
   - Verify API returns 404 for delete endpoints

### Phase 1: Backend Foundation (2-3 days)
1. Create database migration
2. Update models
3. Implement repository methods
4. Create volume tracking service
5. Add API endpoints
6. Write unit tests

### Phase 2: API Integration (1 day)
1. Update OpenAPI spec (add track/untrack endpoints)
2. Generate frontend API client
3. Test endpoints

### Phase 3: Frontend UI (2-3 days)
1. Update volume type definitions
2. Add tracked badge to volume table
3. Implement track/untrack dropdown menu items
4. Create confirmation modal
5. Add tracking filter
6. Style untracked volumes differently
7. Add loading states and error handling

### Phase 4: Testing & Polish (1-2 days)
1. End-to-end testing
2. Error handling edge cases
3. UI/UX refinements
4. Documentation updates

---

## Testing Checklist

### Backend Tests
- [ ] Volume can be untracked
- [ ] All related data is deleted when untracked
- [ ] Volume record remains with is_tracked=false
- [ ] Volume can be re-tracked
- [ ] Untracked volumes are excluded from sync
- [ ] Untracked volumes cannot be scanned
- [ ] Transaction rollback works correctly

### Frontend Tests
- [ ] Tracked badge displays correctly
- [ ] Track/untrack menu items work
- [ ] Confirmation modal appears for untrack
- [ ] Confirmation modal can be cancelled
- [ ] Untrack action removes data
- [ ] Track action enables volume
- [ ] Filters work correctly
- [ ] Visual styling for untracked volumes
- [ ] Loading states during operations
- [ ] Error messages display properly

---

## Delete Functionality Removal

Since this is a **read-only application**, all delete functionality for Docker volumes must be removed. Untracking provides a safe alternative that removes data from the database without touching actual Docker volumes.

### Backend Files to Modify

#### 1. **Remove Bulk Delete Endpoint**

**File:** `internal/api/v1/volumes/handler.go`
- **Remove:** `BulkDeleteVolumes` method (lines ~1617-1694)
- **Remove:** Related request/response models

**File:** `internal/api/v1/volumes/router.go`
- **Remove:** Line 51: `volumes.POST("/bulk-delete", r.handler.BulkDeleteVolumes)`

#### 2. **Remove Delete Models**

**File:** `internal/api/models/volume_responses.go`
- **Remove:** `BulkDeleteVolumesRequest` struct
- **Remove:** `BulkDeleteVolumesResponse` struct
- **Remove:** Any `DeleteVolumeResult` or related types

**File:** `internal/models/volume.go`
- Verify no delete-related models exist

#### 3. **Update OpenAPI Spec**

**File:** `docs/openapi.yaml` (or wherever Swagger spec is)
- **Remove:** `/volumes/bulk-delete` endpoint definition
- **Remove:** Related schemas for delete operations

### Frontend Files to Modify

#### 1. **Remove Delete from Volume Table**

**File:** `frontend/src/components/domain/volumes/VolumeTable/VolumeTable.tsx`

Remove:
```typescript
// Line 21: Remove Trash2 import
import { Trash2 } from 'lucide-react'; // REMOVE

// Lines 368-376: Remove delete menu item from dropdown
{
  id: 'delete',
  label: 'Delete Volume',
  icon: Trash2,
  onClick: () => {
    // TODO: Add delete confirmation modal
    console.log('Delete volume:', volumeId);
  },
  destructive: true,
},
```

#### 2. **Remove Bulk Delete from Volumes Page**

**File:** `frontend/src/pages/VolumesPage/VolumesPage.tsx`

Remove:
```typescript
// Line 30: Remove delete confirmation modal state
const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

// Lines 87-116: Remove handleBulkDelete function entirely
const handleBulkDelete = async () => { /* ... */ };

// Lines 223-251: Remove delete confirmation modal JSX
{isDeleteConfirmOpen && (
  <Modal
    isOpen={isDeleteConfirmOpen}
    onClose={() => setIsDeleteConfirmOpen(false)}
    title="Confirm Bulk Delete"
  >
    {/* ... modal content ... */}
  </Modal>
)}
```

#### 3. **Remove Delete from API Client**

**File:** `frontend/src/api/orval-generated/api.ts`
- This file is auto-generated, so after removing the backend endpoint and updating OpenAPI spec, regenerate with:
  ```bash
  npm run generate:api
  ```
- This will remove `usePostVolumesBulkDelete` and related functions

#### 4. **Remove Delete from Hooks**

**File:** `frontend/src/hooks/volumes/useVolumeBulkActions.ts`
- **Remove:** Any delete-related hooks or methods
- Keep only scan and other read-only operations

#### 5. **Update Mock Handlers**

**File:** `frontend/src/mocks/handlers.ts`
- **Remove:** Mock handler for `/api/v1/volumes/bulk-delete`

#### 6. **Update Storybook Documentation**

**File:** `frontend/src/pages/VolumesPage/VolumesPage.stories.tsx`
- **Remove:** Line 25: "- **Bulk Operations**: Scan multiple volumes, bulk delete"
- **Update to:** "- **Bulk Operations**: Scan multiple volumes"

#### 7. **Remove from Other Components**

Check and remove delete functionality from:
- `frontend/src/components/domain/volumes/VolumesList/*`
- `frontend/src/components/domain/volumes/VolumeCard/*` (if exists)
- Any admin pages that might have delete buttons

### Documentation Updates

#### Files to Update:
1. **README.md** - Remove any mention of delete functionality
2. **docs/USER_GUIDE.md** - Update to clarify read-only nature
3. **docs/API_DOCUMENTATION.md** - Remove delete endpoint docs
4. **docs/FEATURES.md** - Remove delete from feature list

#### Add Clarification:
```markdown
## Read-Only Design

VolumeViz is designed as a **read-only monitoring and analysis tool**. It does not:
- Delete Docker volumes
- Modify Docker volumes
- Create new Docker volumes

To manage data within VolumeViz:
- **Track volumes** to monitor and scan them
- **Untrack volumes** to remove their data from VolumeViz database (Docker volume remains intact)
```

### Testing Cleanup

Remove test files related to delete:
- `internal/api/v1/volumes/handler_delete_test.go` (if exists)
- Frontend tests that test delete functionality

### Search for Remaining References

Run these commands to find any remaining delete references:

```bash
# Backend
grep -r "BulkDelete\|bulk-delete\|DeleteVolume" internal/ --exclude-dir=vendor

# Frontend
grep -r "bulk.*delete\|Delete.*Volume\|handleDelete" frontend/src/ --exclude-dir=node_modules

# Look for Trash icon usage (might indicate delete buttons)
grep -r "Trash2\|Trash" frontend/src/ --exclude-dir=node_modules
```

---

## Security Considerations

1. **Authorization**: Ensure users can only track/untrack volumes in their organization
2. **Audit Logging**: Log all track/untrack operations
3. **Confirmation**: Always require confirmation for untracking (data deletion)
4. **Rate Limiting**: Apply rate limits to prevent abuse

---

## Documentation Updates

1. Add section to user guide explaining tracking/untracking
2. Update API documentation
3. Add migration instructions
4. Update troubleshooting guide

---

## Future Enhancements

1. **Bulk Track/Untrack**: Allow selecting multiple volumes
2. **Auto-untrack**: Automatically untrack volumes that haven't been scanned in X days
3. **Track History**: Keep a log of when volumes were tracked/untracked
4. **Soft Delete**: Option to soft-delete instead of hard-delete (keep data but mark as deleted)
5. **Scheduled Tracking**: Allow scheduling when volumes should be tracked/untracked

---

## Rollback Plan

If issues arise:
1. Run down migration: `000016_add_volume_tracking.down.sql`
2. Revert code changes
3. All volumes will remain in current state (tracked or untracked status will be lost)

---

## Estimated Time: 7-11 days

- **Phase 0** (Delete Removal): 1-2 days
- **Phase 1** (Backend): 2-3 days
- **Phase 2** (API Integration): 1 day
- **Phase 3** (Frontend): 2-3 days
- **Phase 4** (Testing & Polish): 1-2 days

**Critical Path:** Phase 0 must be completed before starting Phase 1 to ensure consistency in the read-only design philosophy.
