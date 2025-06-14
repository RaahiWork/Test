/**
 * Centralized logging utility for VybChat
 * Provides consistent logging patterns and error tracking
 */

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

// Current environment determines default log level
const ENV = process.env.NODE_ENV || 'development';
const DEFAULT_LOG_LEVEL = ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

// Config object
const config = {
  logLevel: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : DEFAULT_LOG_LEVEL,
  enableConsole: true,
  enableFileLogging: process.env.LOG_TO_FILE === 'true',
  logFilePath: process.env.LOG_FILE_PATH || './logs/server.log',
  errorLogPath: process.env.ERROR_LOG_PATH || './logs/error.log',
  maxLogSize: 10 * 1024 * 1024, // 10MB
  enableMetadata: true
};

// Track errors by hash to avoid duplication
const errorTracker = new Map();

/**
 * Format message with timestamp and metadata
 */
function formatMessage(level, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  const prefix = getLogPrefix(level);
  
  // Convert Error objects to structured data
  if (metadata.error instanceof Error) {
    metadata.errorDetails = {
      name: metadata.error.name,
      message: metadata.error.message,
      stack: metadata.error.stack
    };
  }
  
  return {
    timestamp,
    level,
    message: `${prefix} ${message}`,
    metadata: config.enableMetadata ? {
      ...metadata,
      env: ENV,
      pid: process.pid
    } : null
  };
}

/**
 * Get emoji prefix for log level
 */
function getLogPrefix(level) {
  switch(level) {
    case LOG_LEVELS.DEBUG: return '🔍';
    case LOG_LEVELS.INFO: return '✅';
    case LOG_LEVELS.WARN: return '⚠️';
    case LOG_LEVELS.ERROR: return '❌';
    case LOG_LEVELS.FATAL: return '💥';
    default: return '📝';
  }
}

/**
 * Create error hash for tracking
 */
function createErrorHash(error) {
  if (!error) return 'unknown_error';
  
  const errorName = error.name || 'Error';
  const errorMessage = error.message || '';
  // Use first line of stack trace if available to help identify location
  const stackFirstLine = error.stack ? error.stack.split('\n')[1] || '' : '';
  
  return `${errorName}_${errorMessage}_${stackFirstLine}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 100);
}

/**
 * Log to console with color and formatting
 */
function logToConsole(logEntry) {
  if (!config.enableConsole) return;
  
  const { level, message, metadata } = logEntry;
  
  let consoleMethod;
  let style = 'color: black';
  
  switch(level) {
    case LOG_LEVELS.DEBUG:
      consoleMethod = console.debug;
      style = 'color: gray';
      break;
    case LOG_LEVELS.INFO:
      consoleMethod = console.info;
      style = 'color: green';
      break;
    case LOG_LEVELS.WARN:
      consoleMethod = console.warn;
      style = 'color: orange';
      break;
    case LOG_LEVELS.ERROR:
    case LOG_LEVELS.FATAL:
      consoleMethod = console.error;
      style = 'color: red; font-weight: bold';
      break;
    default:
      consoleMethod = console.log;
  }
  
  if (metadata && Object.keys(metadata).length > 0) {
    consoleMethod(`%c${message}`, style, metadata);
  } else {
    consoleMethod(`%c${message}`, style);
  }
  
  // Log stack trace for errors
  if (level >= LOG_LEVELS.ERROR && metadata && metadata.errorDetails && metadata.errorDetails.stack) {
    console.error(metadata.errorDetails.stack);
  }
}

/**
 * Main logger API
 */
const logger = {
  debug: (message, metadata) => {
    if (config.logLevel <= LOG_LEVELS.DEBUG) {
      const logEntry = formatMessage(LOG_LEVELS.DEBUG, message, metadata);
      logToConsole(logEntry);
    }
  },
  
  info: (message, metadata) => {
    if (config.logLevel <= LOG_LEVELS.INFO) {
      const logEntry = formatMessage(LOG_LEVELS.INFO, message, metadata);
      logToConsole(logEntry);
    }
  },
  
  warn: (message, metadata) => {
    if (config.logLevel <= LOG_LEVELS.WARN) {
      const logEntry = formatMessage(LOG_LEVELS.WARN, message, metadata);
      logToConsole(logEntry);
    }
  },
  
  error: (message, error, metadata = {}) => {
    if (config.logLevel <= LOG_LEVELS.ERROR) {
      // Add error to metadata
      const logEntry = formatMessage(LOG_LEVELS.ERROR, message, { ...metadata, error });
      logToConsole(logEntry);
      
      // Track unique errors
      if (error) {
        const errorHash = createErrorHash(error);
        if (!errorTracker.has(errorHash)) {
          errorTracker.set(errorHash, {
            count: 1,
            firstSeen: new Date(),
            lastSeen: new Date()
          });
        } else {
          const tracker = errorTracker.get(errorHash);
          tracker.count++;
          tracker.lastSeen = new Date();
          errorTracker.set(errorHash, tracker);
        }
      }
    }
  },
  
  fatal: (message, error, metadata = {}) => {
    if (config.logLevel <= LOG_LEVELS.FATAL) {
      const logEntry = formatMessage(LOG_LEVELS.FATAL, message, { ...metadata, error });
      logToConsole(logEntry);
    }
  },
  
  // Get statistics about tracked errors
  getErrorStats: () => {
    return {
      uniqueErrors: errorTracker.size,
      totalErrorCount: Array.from(errorTracker.values()).reduce((sum, entry) => sum + entry.count, 0),
      errors: Array.from(errorTracker.entries()).map(([hash, data]) => ({
        hash,
        count: data.count,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen
      }))
    };
  },
  
  // Clear error tracking stats
  clearErrorStats: () => {
    errorTracker.clear();
  },
  
  // Update configuration
  configure: (newConfig) => {
    Object.assign(config, newConfig);
  }
};

export default logger;