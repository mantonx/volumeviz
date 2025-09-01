# VolumeViz Component Library Guidelines

## Architecture Overview

The VolumeViz component library is organized into a scalable, maintainable design system with clear architectural boundaries:

```
src/components/
├── ui/              # Foundational UI components
├── application/     # App-specific components
├── layout/          # Layout and navigation
├── domain/          # Business logic components
├── shared/          # Cross-cutting concerns
├── preview/         # File preview functionality
└── organizations/   # Multi-tenancy features
```

## Design System Structure

```
src/design-system/
├── tokens/          # Design tokens (colors, spacing, typography)
├── types/           # Common component interfaces
└── docs/            # Documentation and guidelines
```

## Component Standards

### 1. **Component Structure**
Every component should follow this structure:

```
ComponentName/
├── ComponentName.tsx          # Main component
├── ComponentName.types.ts     # TypeScript interfaces
├── ComponentName.test.tsx     # Unit tests
├── ComponentName.stories.tsx  # Storybook stories
└── index.ts                   # Barrel export
```

### 2. **Standard Props Interface**
All components should implement `BaseComponentProps`:

```typescript
interface ComponentProps extends BaseComponentProps {
  // Component-specific props
}

// BaseComponentProps includes:
// - className?: string
// - size?: StandardSize  
// - variant?: StandardVariant
// - loading?: boolean
// - disabled?: boolean
// - id?: string
// - data-testid?: string
```

### 3. **Design Tokens Usage**
Use design tokens instead of hard-coded values:

```typescript
// ❌ Avoid
className="text-blue-500 p-4"

// ✅ Prefer
className="text-brand-primary-500 p-semanticSpacing-md"

// Or use token functions
const styles = {
  color: colors.brand.primary[500],
  padding: spacing[4],
}
```

## Component Categories

### **UI Components** (`/components/ui`)
Foundational, reusable components that form the building blocks:
- **Form controls**: Button, Input, Select, Checkbox, FormField
- **Data display**: Card, Badge, DataGrid, Table
- **Feedback**: Toast, Modal, Alert, ErrorState
- **Navigation**: Pagination, ViewToggle, SortSelector

**Standards:**
- Must be framework-agnostic in logic
- Should support all standard props (size, variant, disabled, etc.)
- Must include comprehensive tests
- Should have Storybook documentation

### **Application Components** (`/components/application`)
App-specific functionality:
- ApiHealthChecker
- Error boundaries
- App-level modals

### **Domain Components** (`/components/domain`)
Business logic organized by feature:
- `volumes/` - Volume management
- `search/` - Search functionality
- `alerts/` - Alert system
- `visualization/` - Data visualization

## Component Patterns

### 1. **Compound Components**
For complex components, use compound patterns:

```typescript
// ✅ Good
<Modal isOpen={isOpen} onClose={handleClose}>
  <Modal.Header title="Volume Details" />
  <Modal.Body>
    Content here
  </Modal.Body>
  <Modal.Footer align="right">
    <Button onClick={handleClose}>Close</Button>
  </Modal.Footer>
</Modal>
```

### 2. **Polymorphic Components**
Support flexible rendering with the `as` prop:

```typescript
interface ButtonProps extends PolymorphicComponentProps<'button'> {
  variant?: ButtonVariant;
}

// Usage
<Button as="a" href="/link">Link Button</Button>
<Button as="div" role="button">Div Button</Button>
```

### 3. **Controlled vs Uncontrolled**
Support both patterns where appropriate:

```typescript
// Controlled
<Input value={value} onChange={handleChange} />

// Uncontrolled
<Input defaultValue="initial" />
```

## Testing Standards

### 1. **Test Categories**
Each component should have:
- **Unit tests**: Component logic and rendering
- **Integration tests**: Component interactions
- **Accessibility tests**: ARIA attributes, keyboard navigation
- **Visual regression tests**: Storybook visual testing

### 2. **Test Structure**
```typescript
describe('ComponentName', () => {
  describe('Basic Rendering', () => {
    // Basic functionality tests
  });

  describe('Props', () => {
    // Props validation and behavior
  });

  describe('Interactions', () => {
    // User interactions and events
  });

  describe('Accessibility', () => {
    // A11y compliance tests
  });
});
```

### 3. **Required Test Coverage**
- All prop combinations
- Error states
- Loading states
- Keyboard navigation
- Screen reader support

## Accessibility Requirements

### 1. **ARIA Compliance**
- Proper ARIA attributes
- Semantic HTML elements
- Focus management
- Screen reader support

### 2. **Keyboard Navigation**
- Tab order
- Enter/Space activation
- Escape key handling
- Arrow key navigation (where appropriate)

### 3. **Color and Contrast**
- WCAG AA compliance
- Dark mode support
- High contrast considerations

## Performance Guidelines

### 1. **Bundle Optimization**
- Proper tree-shaking support
- Lazy loading for complex components
- Minimal dependencies

### 2. **Runtime Performance**
- Memoization for expensive calculations
- Virtualization for large lists
- Debounced inputs

### 3. **Size Limits**
- Individual components: < 50KB
- Component bundles: < 200KB
- Total design system: < 500KB

## Documentation Requirements

### 1. **Component Documentation**
Each component must have:
- Purpose and use cases
- Props API documentation
- Usage examples
- Accessibility notes
- Design guidelines

### 2. **Storybook Stories**
- Default story
- All prop variations
- Interactive examples
- Design tokens usage

### 3. **README Files**
- Getting started guide
- API reference
- Migration guides
- Troubleshooting

## Migration and Breaking Changes

### 1. **Versioning**
Follow semantic versioning:
- Major: Breaking changes
- Minor: New features, backward compatible
- Patch: Bug fixes

### 2. **Deprecation Process**
1. Mark as deprecated with console warning
2. Update documentation
3. Provide migration guide
4. Remove in next major version

### 3. **Changelog Maintenance**
Document all changes:
- New components
- API changes
- Bug fixes
- Performance improvements

## Quality Gates

Before releasing components:
- [ ] All tests passing (100% coverage)
- [ ] Storybook documentation complete
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met
- [ ] Design review approved
- [ ] Code review completed

## Tools and Automation

### 1. **Development**
- TypeScript for type safety
- ESLint/Prettier for code quality
- Husky for pre-commit hooks

### 2. **Testing**
- Vitest for unit testing
- Testing Library for component testing
- Chromatic for visual regression

### 3. **Documentation**
- Storybook for component documentation
- TypeDoc for API documentation
- MDX for rich documentation