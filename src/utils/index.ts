/**
 * Utilities module exports
 */

export type { ILogger } from './logger.js';
export { getLogger, setLogLevel, Logger, LogLevel } from './logger.js';

export type { ICacheManager, ICacheOptions, ICacheEntry } from './cache.js';
export { HybridCacheManager, createCacheManager } from './cache.js';

export type { 
  IFileUtils, 
  IFileSearchOptions, 
  ValidationResult 
} from './file-utils.js';
export { FileUtils, SecurityError, createFileUtils } from './file-utils.js';

export type { IConfigManager } from './config.js';
export { ConfigManager, createConfigManager } from './config.js';

export type { Result } from './errors.js';
export {
  BaseError,
  ValidationError,
  ConfigurationError,
  FileSystemError,
  FileNotFoundError,
  DirectoryNotFoundError,
  SecurityError,
  PathTraversalError,
  AccessDeniedError,
  AnalysisError,
  ParsingError,
  UnsupportedLanguageError,
  ComplexityCalculationError,
  ResourceError,
  ResourceLimitError,
  TimeoutError,
  MemoryError,
  CacheError,
  MCPError,
  ToolNotFoundError,
  ToolExecutionError,
  ErrorHandler,
  getErrorHandler,
  handleError,
  createSuccessResult,
  createErrorResult,
  safeExecute,
  safeExecuteSync
} from './errors.js';