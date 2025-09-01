import { defineConfig } from 'orval';

export default defineConfig({
  volumeviz: {
    input: {
      target: '../docs/openapi-3.0.yaml', // Using the OpenAPI 3.0 YAML file
      // Alternative: target: 'http://localhost:8080/openapi/openapi.yaml',
    },
    output: {
      mode: 'single',
      target: './src/api/orval-generated/api.ts',
      client: 'react-query',
      httpClient: 'fetch',  // Using native fetch
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/api/fetch-client.ts',
          name: 'customFetchClient',
        },
        query: {
          useQuery: true,
          useInfiniteQuery: true,
          signal: true,
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write ./src/api/orval-generated/**/*.ts',
    },
  },
});