/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_ENABLE_WEBSOCKET?: string;
  readonly VITE_ENABLE_POLLING?: string;
  readonly VITE_POLLING_INTERVAL?: string;
  readonly VITE_MAX_CONCURRENT_SCANS?: string;
  readonly VITE_ENABLE_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
