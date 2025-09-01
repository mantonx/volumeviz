/**
 * Production-safe logging utility
 * Only logs in development mode or when explicitly enabled
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isVerboseLogging = localStorage?.getItem('volumeviz_verbose_logging') === 'true';

export const logger = {
  debug: (...args: any[]) => {
    if (isDevelopment || isVerboseLogging) {
      console.debug(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment || isVerboseLogging) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  
  error: (...args: any[]) => {
    console.error(...args);
  },
  
  log: (...args: any[]) => {
    if (isDevelopment || isVerboseLogging) {
      console.log(...args);
    }
  }
};

// Legacy support - can be removed once all console.log are replaced
export const developmentLog = (...args: any[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};