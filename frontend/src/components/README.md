# UI Component Library

This directory contains the **reusable UI component library** for VolumeViz. These components are designed to be pure, stateless, and independent of business logic.

## ✅ Component Library Principles

### 1. **Pure Components**
All components in this directory should:
- Accept all data through props
- Have no direct API dependencies
- Not use application-specific contexts
- Be testable in isolation
- Be reusable across different applications

### 2. **No Business Logic**
Components should focus solely on presentation and user interaction:
- Data transformation happens at the application layer
- No direct API calls or data fetching
- No application state management
- Props should use generic interfaces

### 3. **Flexible Interfaces**
Component props should be:
- Generic and not tied to specific backend implementations
- Well-documented with TypeScript interfaces
- Optional where appropriate for flexibility
- Designed for composition

## 📁 Directory Structure

```
components/
├── ui/                    # Basic UI building blocks
│   ├── Button/
│   ├── Card/
│   └── ...
├── volume/                # Volume-specific UI components
│   ├── VolumeCard/
│   ├── VolumeList/
│   └── ...
└── visualization/         # Data visualization components
    ├── LiveVolumeChart/
    ├── SystemOverview/
    ├── RealTimeStatusBar/
    └── ...
```

## 🎯 Usage Example

### ❌ Wrong (Don't do this)

```tsx
// Component with business logic
export const VolumeChart = () => {
  // ❌ Direct API dependency
  const { data } = useVolumeAPI();
  
  // ❌ Application context
  const { scanVolume } = useAppContext();
  
  return <Chart data={data} />;
};
```

### ✅ Correct

```tsx
// Pure presentational component
interface VolumeChartProps {
  volumes: Array<{
    id: string;
    name: string;
    size: number;
  }>;
  onVolumeClick?: (id: string) => void;
}

export const VolumeChart: React.FC<VolumeChartProps> = ({
  volumes,
  onVolumeClick
}) => {
  // Only UI logic
  return <Chart data={volumes} onClick={onVolumeClick} />;
};
```

## 🔌 Integration

These components are designed to be used by the application layer:

```tsx
// In application code (not component library)
import { VolumeChart } from '@/components/visualization';
import { useAppData } from '@/app/hooks';

const Dashboard = () => {
  const { volumes } = useAppData();
  
  return (
    <VolumeChart 
      volumes={volumes}
      onVolumeClick={(id) => navigate(`/volumes/${id}`)}
    />
  );
};
```

## 📝 Component Documentation

Each component should have:
- TypeScript interfaces for all props
- JSDoc comments explaining usage
- Storybook stories for visual documentation
- Unit tests for component behavior

## 🚀 Benefits

1. **Reusability**: Components can be used in different projects
2. **Testability**: Pure components are easier to test
3. **Maintainability**: Clear separation of concerns
4. **Type Safety**: Strong TypeScript interfaces
5. **Documentation**: Self-documenting through props

## 🎨 Styling

Components use:
- Tailwind CSS for utility classes
- CSS modules for component-specific styles
- Theme support through CSS variables
- Responsive design patterns

## 📦 Export Strategy

All components are exported through barrel exports:

```tsx
// components/visualization/index.ts
export * from './LiveVolumeChart';
export * from './SystemOverview';
// ... etc
```

This allows clean imports in application code:

```tsx
import { 
  LiveVolumeChart, 
  SystemOverview,
  RealTimeStatusBar 
} from '@/components/visualization';
```