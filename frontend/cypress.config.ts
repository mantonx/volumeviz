import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // Base URL for the application
    baseUrl: 'http://localhost:5173',
    
    // Test files
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // Support files
    supportFile: 'cypress/support/e2e.ts',
    
    // Fixtures
    fixturesFolder: 'cypress/fixtures',
    
    // Screenshots and videos
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    
    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Test timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    // Retry configuration
    retries: {
      runMode: 2, // Retry up to 2 times in CI
      openMode: 0, // No retries in interactive mode
    },
    
    // Video and screenshot settings
    video: true,
    videoCompression: 32,
    screenshotOnRunFailure: true,
    
    // Test isolation - visit blank page between tests
    testIsolation: true,
    
    // Experiment flags
    experimentalStudio: false,
    experimentalWebKitSupport: false,
    
    // Node event listeners
    setupNodeEvents(on, config) {
      // Task definitions
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        
        // Clear console logs
        clearLogs() {
          return null;
        },
        
        // Get environment info
        getEnvInfo() {
          return {
            nodeVersion: process.version,
            platform: process.platform,
            cypressVersion: require('cypress/package.json').version,
          };
        },
      });

      // Browser launch options
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome' && browser.isHeadless) {
          // Increase memory for headless Chrome
          launchOptions.args.push('--max_old_space_size=4096');
          launchOptions.args.push('--disable-dev-shm-usage');
        }
        return launchOptions;
      });

      // Configuration based on environment
      if (config.env.coverage) {
        require('@cypress/code-coverage/task')(on, config);
      }

      return config;
    },
    
    // Environment variables
    env: {
      // API base URL for backend calls
      API_BASE_URL: 'http://localhost:8080',
      
      // WebSocket URL for real-time features
      WS_URL: 'ws://localhost:8080/api/v1/ws',
      
      // Feature flags for testing
      ENABLE_WEBSOCKET: true,
      ENABLE_DEV_PANEL: true,
      
      // Test configuration
      COMMAND_TIMEOUT: 10000,
      RESPONSE_TIMEOUT: 10000,
      
      // Coverage reporting
      coverage: false,
    },
  },

  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },
});