export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface FeatureFlags {
  enableWebSocket: boolean;
  enableRealTimeUpdates: boolean;
  enableAdvancedSearch: boolean;
  enableBulkOperations: boolean;
  enableMetadataExtraction: boolean;
  enablePreviewGeneration: boolean;
}

export interface Environment {
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  version: string;
  buildTime?: string;
}
