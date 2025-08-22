# Volume Component Architecture

## Overview

This document describes the cleaned and simplified architecture for volume-related components in the VolumeViz frontend.

## Data Flow

```
API (VolumeV1) → useVolumesAndMounts → VolumeMount → VolumesList → UI
```

### 1. API Layer (`/api/generated/volumeviz-api.ts`)

- **Primary Type**: `VolumeV1` - Auto-generated from OpenAPI spec
- **Key Fields**: `filesystem_capacity`, `size_bytes`, `name`, `driver`, `labels`, etc.
- **Source**: Generated from backend Swagger documentation

### 2. Data Hook (`/hooks/useVolumesAndMounts.ts`)

- **Purpose**: Fetches and transforms volume data for the UI
- **Input**: `VolumeV1[]` from API
- **Output**: `VolumeMount[]` for UI consumption
- **Key Function**: `transformVolume()` - Preserves all API data while adding UI-specific fields

#### VolumeMount Interface

```typescript
export interface VolumeMount extends VolumeV1 {
  // Inherits ALL VolumeV1 fields including filesystem_capacity
  
  // UI-specific overrides/additions:
  id: string;                    // Unified identifier
  path: string;                  // Display path
  type: 'volume' | 'bind' | 'tmpfs';
  status: 'tracked' | 'untracked' | 'orphaned';
  containers: string[];          // Container names
  source_type: 'volume' | 'mount';
}
```

### 3. UI Components

#### VolumesList (`/pages/VolumesPage/VolumesList.tsx`)

- **Purpose**: Main volume listing page with table and card views
- **Data Source**: `useVolumesAndMounts` hook
- **Features**: 
  - Table/Card view toggle
  - Filtering, sorting, pagination
  - Bulk operations
  - Filesystem capacity display

#### Percentage Utility (`/utils/volumePercentage.ts`)

- **Purpose**: Centralized percentage calculation logic
- **Input**: `volumeSize`, `filesystemCapacity`, `maxVolumeSize`
- **Output**: `{ percentage, displayText, tooltipText }`
- **Logic**: Uses filesystem capacity when available, falls back to relative sizing

## Key Improvements Made

### ✅ Fixed Issues

1. **Broken Imports**: Fixed all imports from non-existent `types/api`
2. **Component Duplication**: Removed 2 unused VolumesList and 2 unused VolumeCard components
3. **Data Loss**: Fixed `VolumeMount` interface to preserve all `VolumeV1` fields
4. **Type Inconsistency**: Standardized on `VolumeV1` as the primary volume interface
5. **Scattered Logic**: Centralized percentage calculations in one utility

### 🧹 Removed Components

- `/components/VolumesList.tsx` (unused)
- `/components/volume/VolumeList/` (unused generic component)
- `/components/volume/VolumeCard/` (unused card component)
- `/components/volume/VolumeCardWithProgress/` (unused)

### 📊 Current Component Count

- **Volume List Components**: 1 (was 3)
- **Volume Card Components**: 0 (was 2, now inline in VolumesList)
- **Volume Interfaces**: 1 unified (`VolumeMount extends VolumeV1`)

## Usage Examples

### Displaying Volume Size with Capacity

```typescript
// In VolumesList component
const percentageData = calculateVolumePercentage(
  item.size_bytes,
  item.filesystem_capacity,  // ✅ Now available from API
  maxSize
);

// Shows: "28.9% of capacity" or "100% of max" (fallback)
<span>{percentageData.displayText}</span>
```

### Adding New Volume Fields

To add new fields from the API:

1. **Backend**: Add field to `VolumeV1` model and regenerate Swagger
2. **Frontend**: Run `npm run generate-types` to update `VolumeV1` interface
3. **Hook**: No changes needed - `VolumeMount` automatically inherits new fields
4. **UI**: Use the new field directly on `item.newField`

## Data Integrity

- ✅ **No Data Loss**: `VolumeMount extends VolumeV1` preserves all API fields
- ✅ **Type Safety**: Full TypeScript coverage with generated types
- ✅ **Single Source of Truth**: All volume data comes from `VolumeV1`
- ✅ **Consistent Interface**: Same data structure across all components

## Future Recommendations

1. **Further Simplification**: Consider removing `VolumeMount` entirely and using `VolumeV1` directly
2. **State Management**: Evaluate whether Jotai atoms are still needed vs. just using hooks
3. **Component Organization**: Move inline card implementation to separate component if reused
4. **Testing**: Update tests to reflect the simplified architecture

## Maintenance

- **Adding Fields**: Regenerate types from OpenAPI spec
- **Breaking Changes**: Monitor `VolumeV1` interface changes in API
- **Performance**: Monitor if extending `VolumeV1` causes bundle size issues