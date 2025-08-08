# Frontend Architecture Guide

## Overview

This guide explains the architectural decisions for the VolumeViz frontend, particularly the separation between the reusable UI component library and application-specific code.

## Key Principles

### 1. Separation of Concerns

The codebase is organized into two main layers:

- **UI Component Library** (`/src/components/`): Pure, reusable UI components
- **Application Layer** (`/src/app/`): Business logic, providers, and app-specific components

### 2. Component Library Guidelines

Components in `/src/components/` should:

- ✅ Be pure UI components with no business logic
- ✅ Accept all data through props
- ✅ Use generic interfaces that don't depend on specific APIs
- ✅ Be reusable across different applications
- ✅ Have no direct dependencies on application state or context

Components in `/src/components/` should NOT:

- ❌ Use application-specific hooks or contexts
- ❌ Import from the API layer directly
- ❌ Contain business logic or data fetching
- ❌ Depend on specific backend implementations
- ❌ Use providers that contain business logic

### 3. Application Layer

The `/src/app/` directory contains:

- **Providers**: Application-specific context providers with business logic
- **Pages**: Top-level route components
- **Components**: Application-specific components that use business logic
- **Hooks**: Custom hooks that integrate with the backend

## Example: Real-time Integration

### ❌ Wrong Approach (What NOT to do)

```tsx
// DON'T put this in the component library
// src/components/visualization/RealTimeProvider.tsx
export const RealTimeProvider = () => {
  const data = useApiHook(); // ❌ API dependency
  const businessLogic = useBusinessLogic(); // ❌ Business logic
  
  return <Context.Provider>...</Context.Provider>;
};
```

### ✅ Correct Approach

**1. Pure UI Component (Component Library)**

```tsx
// src/components/visualization/LiveVolumeChart/LiveVolumeChart.tsx
interface LiveVolumeChartProps {
  volumes: VolumeData[]; // Generic interface
  onRefresh?: () => void; // Optional callback
  variant?: 'pie' | 'donut' | 'bar';
}

export const LiveVolumeChart: React.FC<LiveVolumeChartProps> = ({
  volumes,
  onRefresh,
  variant = 'donut'
}) => {
  // Pure UI logic only
  return <Chart data={volumes} />;
};
```

**2. Real-time Status Component (Component Library)**

```tsx
// src/components/visualization/RealTimeStatusBar/RealTimeStatusBar.tsx
interface RealTimeStatus {
  isActive: boolean;
  isConnected: boolean;
  activeScans: number;
  // ... generic status interface
}

export const RealTimeStatusBar: React.FC<{ status: RealTimeStatus }> = ({
  status,
  onToggleRealTime,
  onScanAll
}) => {
  // Pure UI rendering
  return <div>...</div>;
};
```

**3. Application Provider (Application Layer)**

```tsx
// src/app/providers/RealTimeVisualizationProvider.tsx
export const RealTimeVisualizationProvider = ({ children }) => {
  // Application-specific hooks
  const realTimeScans = useRealTimeScans();
  const visualizationData = useVisualizationData();
  
  // Business logic here
  return <Context.Provider>...</Context.Provider>;
};
```

**4. Application Component (Application Layer)**

```tsx
// src/app/components/VolumeDashboard/VolumeDashboard.tsx
export const VolumeDashboard = () => {
  // Use application context
  const { data, actions } = useRealTimeVisualization();
  
  // Transform data for UI components
  const uiData = transformForUI(data);
  
  // Render pure UI components with props
  return (
    <>
      <RealTimeStatusBar status={uiData.status} />
      <LiveVolumeChart volumes={uiData.volumes} />
    </>
  );
};
```

**5. Page Component (Application Layer)**

```tsx
// src/app/pages/DashboardPage/DashboardPage.tsx
export const DashboardPage = () => {
  return (
    <RealTimeVisualizationProvider>
      <VolumeDashboard />
    </RealTimeVisualizationProvider>
  );
};
```

## Directory Structure

```
frontend/
├── src/
│   ├── components/           # UI Component Library
│   │   ├── ui/              # Basic UI components
│   │   ├── volume/          # Volume-specific UI components
│   │   └── visualization/   # Visualization UI components
│   │       ├── LiveVolumeChart/
│   │       ├── RealTimeStatusBar/
│   │       └── index.ts
│   │
│   ├── app/                 # Application Layer
│   │   ├── providers/       # App-specific providers
│   │   │   └── RealTimeVisualizationProvider.tsx
│   │   ├── components/      # App-specific components
│   │   │   └── VolumeDashboard/
│   │   └── pages/           # Route components
│   │       └── DashboardPage/
│   │
│   ├── hooks/               # Shared hooks
│   ├── api/                 # API integration
│   └── utils/               # Utilities
```

## Benefits

1. **Reusability**: UI components can be used in different applications
2. **Testability**: Pure components are easier to test
3. **Maintainability**: Clear separation of concerns
4. **Flexibility**: Easy to swap out business logic without changing UI
5. **Type Safety**: Generic interfaces ensure compatibility

## Migration Checklist

When refactoring existing components:

- [ ] Move business logic to application layer
- [ ] Convert to pure props-based components
- [ ] Remove API dependencies
- [ ] Remove context dependencies
- [ ] Create generic interfaces
- [ ] Move providers to app layer
- [ ] Update imports
- [ ] Test components in isolation