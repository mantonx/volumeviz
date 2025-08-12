# VolumeViz E2E Testing

Comprehensive end-to-end testing suite for VolumeViz using Cypress 13+.

## Overview

This test suite covers:
- **Dashboard functionality** - Loading states, status pills, WebSocket integration
- **Search & Filters** - Debounced search, filtering, sorting, URL state management  
- **Volume Details** - Modal interactions, data display, empty states
- **Scan Operations** - Real-time progress tracking, error handling, bulk operations
- **WebSocket Integration** - Real-time events, connection states, reconnection

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Go 1.21+ 
- PostgreSQL running locally
- Backend and frontend servers built

### Running Tests

**Option 1: Use the convenience script (recommended)**
```bash
# Run all E2E tests
./scripts/run-e2e-tests.sh

# Open Cypress Test Runner GUI
./scripts/run-e2e-tests.sh open

# Run tests in headless mode
./scripts/run-e2e-tests.sh headless
```

**Option 2: Manual setup**
```bash
# 1. Start backend server
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/volumeviz_dev?sslmode=disable"
go run cmd/server/main.go

# 2. Start frontend dev server  
cd frontend
export VITE_API_BASE_URL="http://localhost:8080"
export VITE_WS_URL="ws://localhost:8080/api/v1/ws" 
export VITE_ENABLE_WEBSOCKET=true
npm run dev

# 3. Run Cypress tests
npm run cypress:run
# or npm run cypress:open
```

### Environment Variables

Configure test behavior with these environment variables:

```bash
# Cypress Configuration
CYPRESS_baseUrl=http://localhost:5173
CYPRESS_API_BASE_URL=http://localhost:8080
CYPRESS_WS_URL=ws://localhost:8080/api/v1/ws
CYPRESS_ENABLE_WEBSOCKET=true

# Server Configuration
BACKEND_PORT=8080
FRONTEND_PORT=5173
DATABASE_URL=postgres://user:pass@localhost:5432/volumeviz_dev?sslmode=disable
```

## Test Architecture

### WebSocket Test Shim

Tests use a sophisticated WebSocket shim (`window.__TEST_WS__`) that provides:

- **Deterministic testing** - Controllable WebSocket behavior
- **Event simulation** - Emit scan_progress, scan_complete, volume_update events
- **Connection states** - Simulate connecting, connected, disconnected, error states
- **Latency simulation** - Test with artificial network delays
- **Error simulation** - Test error handling and recovery

Example usage in tests:
```typescript
// Set up WebSocket shim
cy.setupWebSocketShim({ autoConnect: true, latency: 100 });

// Wait for connection
cy.waitForWebSocketConnection();

// Emit test events
cy.emitWebSocketEvent('scan_progress', {
  volume_id: 'test-volume',
  progress: 50,
  current_size: 1024000
});

// Simulate connection issues
cy.simulateWebSocketReconnection();
```

### Custom Commands

The test suite includes custom Cypress commands:

- `cy.setupCommonInterceptors()` - Mock common API endpoints
- `cy.mockVolumeData(volumes)` - Mock volume list data
- `cy.mockScanOperation(volumeId, options)` - Mock scan with progress events
- `cy.waitForAppLoad()` - Wait for React app initialization
- `cy.visitPage(url)` - Visit page with proper setup
- `cy.getByTestId(testId)` - Find elements by data-testid
- `cy.checkStatusPill(state)` - Verify status pill state
- `cy.testSearch(term, expectedResults)` - Test search with debouncing

### Test Data & Fixtures

Test data is organized in `/cypress/fixtures/`:

- `volumes.json` - Sample volume data for different scenarios
- `api-responses.json` - Mock API response templates

Use fixtures in tests:
```typescript
cy.fixture('volumes.json').then((volumes) => {
  cy.mockVolumeData(volumes.multipleVolumes);
});
```

### Page Object Pattern

Tests use data-testid selectors for reliable element targeting:

```typescript
// Required data-testid attributes in components:
cy.getByTestId('app-root')           // Main app container
cy.getByTestId('status-pill')        // Connection status pill  
cy.getByTestId('volume-list')        // Volume list container
cy.getByTestId('volume-item')        // Individual volume items
cy.getByTestId('search-input')       // Search input field
cy.getByTestId('scan-button')        // Scan trigger buttons
cy.getByTestId('scan-progress-bar')  // Progress visualization
```

## Test Scenarios

### Dashboard Tests (`dashboard.cy.ts`)

- ✅ Page loading with API-only and WebSocket modes
- ✅ Status pill state transitions
- ✅ WebSocket connection/disconnection/reconnection
- ✅ Dev panel keyboard shortcut (Ctrl+Shift+W)
- ✅ Real-time event reception
- ✅ Error handling and graceful degradation
- ✅ Responsive design (mobile/tablet)

### Search & Filter Tests (`search-filters.cy.ts`)

- ✅ Debounced search input (300-500ms delay)
- ✅ Search across names and labels
- ✅ Filter by orphaned/system status
- ✅ Combined search + filter operations
- ✅ Sorting by name/size/date
- ✅ URL state management
- ✅ Large dataset performance
- ✅ Keyboard navigation and accessibility

### Volume Details Tests (`volume-details.cy.ts`)

- ✅ Modal open/close interactions
- ✅ Volume information display
- ✅ Empty states (no containers, no labels, no scan data)
- ✅ Container attachment details
- ✅ Label management
- ✅ Scan initiation from modal
- ✅ Volume action confirmations
- ✅ Mobile responsiveness
- ✅ Focus management and accessibility

### Scan Operations Tests (`scan-operations.cy.ts`)

- ✅ Scan initiation from list and modal
- ✅ Real-time progress updates via WebSocket
- ✅ Progress rate limiting (≤4 events/second)
- ✅ Multiple concurrent scans
- ✅ Error handling and retry functionality
- ✅ Network disconnection recovery
- ✅ Scan history and detailed results
- ✅ Bulk scan operations
- ✅ Scan cancellation
- ✅ Large volume handling (TB+ sizes)

## CI/CD Integration

### GitHub Actions

The `.github/workflows/e2e-tests.yml` workflow:

- **Triggers**: Push to main/develop, PRs to main
- **Services**: PostgreSQL 15 test database
- **Matrix**: Chrome (always) + Firefox (main branch only)
- **Artifacts**: Screenshots, videos, test results
- **Parallelization**: Component tests run separately

### Local Development

For faster feedback during development:

```bash
# Run specific test file
npm run cypress:run -- --spec "cypress/e2e/dashboard.cy.ts"

# Run tests with specific tag
npm run cypress:run -- --env tags="@smoke"

# Debug mode with browser open
npm run cypress:open
```

## Debugging Tests

### Screenshots and Videos

Cypress automatically captures:
- **Screenshots** on test failures (saved to `cypress/screenshots/`)
- **Videos** for all test runs (saved to `cypress/videos/`)
- **Test artifacts** uploaded to CI

### WebSocket Debugging

Enable WebSocket debugging:
```typescript
// In test file
beforeEach(() => {
  cy.window().then((win) => {
    win.__DEBUG_WS__ = true;
  });
});
```

### Console Logs

Access test logs:
```bash
# View backend logs during test run
tail -f backend.log

# View frontend logs
tail -f frontend.log
```

### Dev Panel

Use the WebSocket dev panel in tests:
```typescript  
// Open dev panel during test
cy.get('body').type('{ctrl+shift+w}');

// Send test messages
cy.getByTestId('send-ping-button').click();

// Monitor connection state
cy.getByTestId('connection-status').should('contain', 'Connected');
```

## Best Practices

### Test Organization

- **One feature per file** - Keep related tests together
- **Descriptive names** - Test names should clearly indicate what's being tested
- **Setup/teardown** - Use beforeEach/afterEach for consistent state
- **Independent tests** - Each test should be runnable in isolation

### Assertions

- **Wait for elements** - Always wait for elements to be visible before assertions
- **Meaningful assertions** - Assert on actual functionality, not implementation details  
- **Multiple assertions** - Group related assertions together for better failure messages

### Performance

- **Mock external services** - Don't make real API calls to external services
- **Parallel execution** - Use Cypress parallelization for faster CI runs
- **Selective testing** - Run only affected tests during development

### Accessibility

- **Keyboard navigation** - Test tab order and keyboard interactions
- **Screen readers** - Verify ARIA labels and live regions
- **Focus management** - Ensure focus moves logically through the interface

## Troubleshooting

### Common Issues

**Tests timing out**
- Increase timeout values in `cypress.config.ts`
- Ensure servers are properly started before tests
- Check for network connectivity issues

**WebSocket tests failing**  
- Verify WebSocket shim is properly initialized
- Check that `VITE_ENABLE_WEBSOCKET=true`
- Ensure backend WebSocket endpoint is working

**Element not found errors**
- Verify `data-testid` attributes are present on components
- Check for dynamic content loading
- Use `cy.get('[data-testid="..."]').should('exist')` to debug

**CI tests passing locally but failing in CI**
- Check environment variable differences
- Verify database migrations are running
- Look at uploaded artifacts (screenshots/videos)

### Getting Help

- **Cypress Documentation**: [docs.cypress.io](https://docs.cypress.io)
- **GitHub Issues**: Report bugs and feature requests
- **Development Team**: Check with frontend team for component-specific issues
- **WebSocket Issues**: Consult backend team for WebSocket endpoint problems

## Contributing

When adding new tests:

1. **Follow naming conventions** - Use descriptive file and test names
2. **Add data-testid selectors** - Ensure testable elements have proper IDs
3. **Update fixtures** - Add any new test data to fixture files
4. **Document new commands** - Update README for any custom commands
5. **Test across browsers** - Verify compatibility with Chrome and Firefox
6. **Consider accessibility** - Include accessibility testing where relevant