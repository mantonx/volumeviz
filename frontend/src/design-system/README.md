# VolumeViz Design System

A comprehensive, scalable design system for the VolumeViz application built with React and TypeScript.

## 🏗️ **Architecture**

### Component Organization
```
/components
├── ui/              # 30+ foundational UI components
├── application/     # App-specific functionality  
├── layout/          # Navigation and layout
├── domain/          # Business logic by feature
├── shared/          # Cross-cutting concerns
├── preview/         # File preview system
└── organizations/   # Multi-tenancy support
```

### Design System Foundation  
```
/design-system
├── tokens/          # Design tokens (colors, spacing, typography)
├── types/           # Standardized component interfaces
└── docs/            # Guidelines and documentation
```

## ✨ **Key Features**

### 🎨 **Design Tokens**
Centralized design tokens for consistent theming:
- **Colors**: Brand, semantic, and neutral color scales
- **Spacing**: Consistent spacing scale with semantic aliases  
- **Typography**: Font scales, weights, and semantic text styles

```typescript
import { colors, spacing, typography } from '@/design-system/tokens';

// Use design tokens instead of hard-coded values
const styles = {
  color: colors.brand.primary[500],
  padding: spacing[4], 
  fontSize: typography.fontSize.lg,
};
```

### 🧩 **Compound Components**
Complex components broken into composable parts:

```typescript
<Modal isOpen={isOpen} onClose={handleClose}>
  <Modal.Header title="Volume Details" showCloseButton />
  <Modal.Body scrollable>
    <p>Modal content here</p>
  </Modal.Body>
  <Modal.Footer align="right">
    <Button variant="secondary" onClick={handleClose}>Cancel</Button>
    <Button variant="primary" onClick={handleSave}>Save</Button>
  </Modal.Footer>
</Modal>
```

### 🔄 **Polymorphic Components**  
Flexible components that can render as different elements:

```typescript
<Button as="a" href="/link">Link Button</Button>
<Button as="div" role="button">Div Button</Button>
```

### 📋 **Standardized Props**
Consistent prop interfaces across all components:

```typescript
interface ComponentProps extends BaseComponentProps {
  // Every component includes:
  // - className?: string
  // - size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'  
  // - variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  // - loading?: boolean
  // - disabled?: boolean
  // - id?: string
  // - data-testid?: string
}
```

## 📚 **Component Categories**

### **Foundation Components** (18 components)
Essential building blocks:
- **Forms**: Button, Input, Select, Checkbox, FormField
- **Layout**: Card, Modal, Toast, EmptyState, ErrorState  
- **Data**: Badge, StatusBadge, ProgressBar, DataGrid
- **Navigation**: Pagination, ViewToggle, SortSelector
- **Feedback**: Skeleton, PhaseIndicator

### **Specialized Components** (12+ components)
Domain-specific functionality:
- **Visualization**: MetricCard, SizeVisualization, GrowthIndicator
- **VolumeViz-specific**: ContainerStatus, FreshnessIndicator, ScanErrorState  

## 🧪 **Testing Strategy**

### Comprehensive Test Coverage
Every component includes:
- **Unit Tests**: Component logic and rendering
- **Integration Tests**: Component interactions  
- **Accessibility Tests**: ARIA compliance and keyboard navigation
- **Visual Tests**: Storybook visual regression testing

### Example Test Structure
```typescript
describe('ComponentName', () => {
  describe('Basic Rendering', () => {
    // Rendering tests
  });
  describe('Props Behavior', () => {
    // Props validation  
  });
  describe('User Interactions', () => {
    // Event handling
  });
  describe('Accessibility', () => {
    // A11y compliance
  });
});
```

## ♿ **Accessibility First**

### WCAG 2.1 AA Compliance
- Semantic HTML elements
- Proper ARIA attributes  
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance
- Dark mode support

### Focus Management
- Logical tab order
- Focus visible indicators
- Focus trapping in modals
- Escape key handling

## 🚀 **Performance Optimized**

### Bundle Optimization
- Tree-shaking support for all components
- Lazy loading for complex components  
- Minimal external dependencies
- Efficient component splitting

### Runtime Performance  
- Memoization for expensive calculations
- Virtualization for large data sets
- Debounced input handling
- Optimized re-rendering

## 📖 **Documentation**

### Storybook Integration
Interactive component documentation with:
- Live component examples
- Props controls and knobs
- Design token usage examples  
- Accessibility testing integration

### TypeScript Support
Full type definitions with:
- Comprehensive prop interfaces
- Generic type support for polymorphic components
- Strict typing for design tokens
- IntelliSense support

## 🔧 **Development Workflow**

### Quality Gates
Before component release:
- [ ] 100% test coverage
- [ ] Storybook documentation complete
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met
- [ ] Design review approved  
- [ ] Code review completed

### Tools & Automation
- **TypeScript** for type safety
- **Vitest** for unit testing  
- **Testing Library** for component testing
- **Storybook** for documentation
- **ESLint/Prettier** for code quality

## 🎯 **Usage Examples**

### Form with Validation
```typescript
<FormField 
  label="Volume Name" 
  required 
  error={errors.name}
  helpText="Choose a descriptive name for your volume"
>
  <Input
    placeholder="Enter volume name"
    value={volumeName}
    onChange={handleNameChange}
  />
</FormField>
```

### Data Display
```typescript
<Card>
  <MetricCard
    title="Storage Usage"
    value="2.4 TB"
    trend={{ direction: 'up', percentage: 12 }}
    variant="success"
    size="lg"
  />
</Card>
```

### Interactive Lists
```typescript
<DataGrid
  data={volumes}
  columns={volumeColumns}
  selectionMode="multiple"
  sortable
  loading={isLoading}
  emptyState={<EmptyState message="No volumes found" />}
  onSelectionChange={handleSelectionChange}
/>
```

## 📈 **Metrics & Impact**

### Bundle Size Optimization
- **Before**: 3.21 MB total bundle
- **After**: 2.35 MB total bundle (**26% reduction**)
- Proper code splitting across 29 chunks
- Tree-shaking enabled for all components

### Developer Experience  
- **30+ reusable components** with consistent APIs
- **100% TypeScript coverage** with comprehensive types
- **Comprehensive testing** with >95% coverage
- **Storybook documentation** for all components
- **Design token system** for consistent styling

### Maintainability Improvements
- **Clear architectural boundaries** between component types
- **Standardized prop interfaces** across all components  
- **Compound component patterns** for complex UI
- **Polymorphic support** for flexible usage
- **Comprehensive documentation** and guidelines

## 🚀 **Getting Started**

1. **Import components**:
```typescript
import { Button, Card, FormField } from '@/components/ui';
```

2. **Use design tokens**:
```typescript
import { colors, spacing } from '@/design-system/tokens';
```

3. **Follow guidelines**:
See `docs/COMPONENT_GUIDELINES.md` for detailed standards and patterns.

4. **Explore examples**:
Run Storybook to see interactive component examples and documentation.

---

**The VolumeViz Design System provides a solid foundation for building consistent, accessible, and maintainable user interfaces at scale.**