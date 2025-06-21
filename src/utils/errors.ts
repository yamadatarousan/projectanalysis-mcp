/**
 * Centralized error handling system
 */

import { getLogger, type ILogger } from './logger.js';

export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.details = details;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      stack: this.stack
    };
  }
}

// Validation Errors
export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, { field, value });
  }
}

export class ConfigurationError extends BaseError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, configPath?: string) {
    super(message, { configPath });
  }
}

// File System Errors
export class FileSystemError extends BaseError {
  readonly code = 'FILESYSTEM_ERROR';
  readonly statusCode = 500;

  constructor(message: string, filePath?: string, operation?: string) {
    super(message, { filePath, operation });
  }
}

export class FileNotFoundError extends FileSystemError {
  readonly code = 'FILE_NOT_FOUND';
  readonly statusCode = 404;

  constructor(filePath: string) {
    super(`File not found: ${filePath}`, filePath, 'read');
  }
}

export class DirectoryNotFoundError extends FileSystemError {
  readonly code = 'DIRECTORY_NOT_FOUND';
  readonly statusCode = 404;

  constructor(dirPath: string) {
    super(`Directory not found: ${dirPath}`, dirPath, 'access');
  }
}

// Security Errors
export class SecurityError extends BaseError {
  readonly code = 'SECURITY_ERROR';
  readonly statusCode = 403;

  constructor(message: string, violationType?: string) {
    super(message, { violationType });
  }
}

export class PathTraversalError extends SecurityError {
  readonly code = 'PATH_TRAVERSAL';
  readonly statusCode = 403;

  constructor(path: string) {
    super(`Path traversal detected: ${path}`, 'path_traversal');
  }
}

export class AccessDeniedError extends SecurityError {
  readonly code = 'ACCESS_DENIED';
  readonly statusCode = 403;

  constructor(resource: string, operation?: string) {
    super(`Access denied to ${resource}${operation ? ` for operation: ${operation}` : ''}`, 'access_denied');
  }
}

// Analysis Errors
export class AnalysisError extends BaseError {
  readonly code = 'ANALYSIS_ERROR';
  readonly statusCode = 500;

  constructor(message: string, analysisType?: string, details?: unknown) {
    super(message, { analysisType, ...details });
  }
}

export class ParsingError extends AnalysisError {
  readonly code = 'PARSING_ERROR';
  readonly statusCode = 422;

  constructor(filePath: string, language?: string, cause?: Error) {
    super(`Failed to parse file: ${filePath}${language ? ` (${language})` : ''}`, {
      filePath,
      language,
      cause: cause?.message
    });
  }
}

export class UnsupportedLanguageError extends AnalysisError {
  readonly code = 'UNSUPPORTED_LANGUAGE';
  readonly statusCode = 422;

  constructor(language: string, filePath?: string) {
    super(`Unsupported language: ${language}${filePath ? ` in file: ${filePath}` : ''}`, {
      language,
      filePath
    });
  }
}

export class ComplexityCalculationError extends AnalysisError {
  readonly code = 'COMPLEXITY_CALCULATION_ERROR';
  readonly statusCode = 500;

  constructor(filePath: string, cause?: Error) {
    super(`Failed to calculate complexity for: ${filePath}`, {
      filePath,
      cause: cause?.message
    });
  }
}

// Resource Errors
export class ResourceError extends BaseError {
  readonly code = 'RESOURCE_ERROR';
  readonly statusCode = 500;

  constructor(message: string, resourceType?: string) {
    super(message, { resourceType });
  }
}

export class ResourceLimitError extends ResourceError {
  readonly code = 'RESOURCE_LIMIT_EXCEEDED';
  readonly statusCode = 429;

  constructor(limitType: string, limit: number, actual: number) {
    super(`${limitType} limit exceeded: ${actual} > ${limit}`, {
      limitType,
      limit,
      actual
    });
  }
}

export class TimeoutError extends ResourceError {
  readonly code = 'TIMEOUT';
  readonly statusCode = 408;

  constructor(operation: string, timeout: number) {
    super(`Operation timed out: ${operation} (${timeout}ms)`, {
      operation,
      timeout
    });
  }
}

export class MemoryError extends ResourceError {
  readonly code = 'MEMORY_ERROR';
  readonly statusCode = 507;

  constructor(operation: string, memoryUsed: number, memoryLimit: number) {
    super(`Memory limit exceeded during ${operation}: ${memoryUsed}MB > ${memoryLimit}MB`, {
      operation,
      memoryUsed,
      memoryLimit
    });
  }
}

// Cache Errors
export class CacheError extends BaseError {
  readonly code = 'CACHE_ERROR';
  readonly statusCode = 500;

  constructor(message: string, operation?: string, key?: string) {
    super(message, { operation, key });
  }
}

// MCP Errors
export class MCPError extends BaseError {
  readonly code = 'MCP_ERROR';
  readonly statusCode = 500;

  constructor(message: string, method?: string, toolName?: string) {
    super(message, { method, toolName });
  }
}

export class ToolNotFoundError extends MCPError {
  readonly code = 'TOOL_NOT_FOUND';
  readonly statusCode = 404;

  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, undefined, toolName);
  }
}

export class ToolExecutionError extends MCPError {
  readonly code = 'TOOL_EXECUTION_ERROR';
  readonly statusCode = 500;

  constructor(toolName: string, cause?: Error) {
    super(`Tool execution failed: ${toolName}`, undefined, toolName);
    if (cause) {
      this.details = { ...this.details, cause: cause.message, stack: cause.stack };
    }
  }
}

// Error Handler Class
export class ErrorHandler {
  private readonly logger: ILogger;

  constructor() {
    this.logger = getLogger('error-handler');
  }

  handle(error: Error, context?: Record<string, unknown>): BaseError {
    // If it's already a BaseError, just log and return
    if (error instanceof BaseError) {
      this.logError(error, context);
      return error;
    }

    // Convert native errors to appropriate BaseError types
    const convertedError = this.convertError(error, context);
    this.logError(convertedError, context);
    return convertedError;
  }

  private convertError(error: Error, context?: Record<string, unknown>): BaseError {
    const message = error.message;
    const details = { originalError: error.name, context };

    // File system errors
    if (error.name === 'ENOENT' || message.includes('no such file')) {
      const filePath = this.extractFilePathFromError(error);
      return filePath ? new FileNotFoundError(filePath) : new FileSystemError(message);
    }

    if (error.name === 'EACCES' || message.includes('permission denied')) {
      return new AccessDeniedError('File system access', 'read/write');
    }

    if (error.name === 'EISDIR' || message.includes('is a directory')) {
      return new FileSystemError(message, undefined, 'file_operation');
    }

    // Parsing errors
    if (message.includes('parse') || message.includes('syntax')) {
      return new ParsingError('Unknown file', 'unknown', error);
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || message.includes('timeout')) {
      return new TimeoutError('Unknown operation', 30000);
    }

    // Memory errors
    if (message.includes('out of memory') || message.includes('heap')) {
      return new MemoryError('Unknown operation', 0, 0);
    }

    // Generic analysis error for unknown errors
    return new AnalysisError(`Unexpected error: ${message}`, 'unknown', details);
  }

  private extractFilePathFromError(error: Error): string | undefined {
    // Try to extract file path from common error message formats
    const pathMatch = error.message.match(/(?:open|read|access) '([^']+)'/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Try ENOENT format
    const enoentMatch = error.message.match(/ENOENT: no such file or directory, (?:open|stat) '([^']+)'/);
    if (enoentMatch) {
      return enoentMatch[1];
    }

    return undefined;
  }

  private logError(error: BaseError, context?: Record<string, unknown>): void {
    const logContext = {
      errorCode: error.code,
      statusCode: error.statusCode,
      timestamp: error.timestamp,
      details: error.details,
      context
    };

    if (error.statusCode >= 500) {
      this.logger.error(error.message, error, logContext);
    } else if (error.statusCode >= 400) {
      this.logger.warn(error.message, logContext);
    } else {
      this.logger.info(error.message, logContext);
    }
  }
}

// Singleton error handler
let errorHandler: ErrorHandler;

export function getErrorHandler(): ErrorHandler {
  if (!errorHandler) {
    errorHandler = new ErrorHandler();
  }
  return errorHandler;
}

// Utility function for error handling
export function handleError(error: Error, context?: Record<string, unknown>): BaseError {
  return getErrorHandler().handle(error, context);
}

// Result type for operations that might fail
export type Result<T, E = BaseError> = 
  | { success: true; data: T }
  | { success: false; error: E };

export function createSuccessResult<T>(data: T): Result<T> {
  return { success: true, data };
}

export function createErrorResult<T>(error: BaseError): Result<T, BaseError> {
  return { success: false, error };
}

// Async wrapper for safe execution
export async function safeExecute<T>(
  operation: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<Result<T>> {
  try {
    const data = await operation();
    return createSuccessResult(data);
  } catch (error) {
    const handledError = handleError(error as Error, context);
    return createErrorResult(handledError);
  }
}

// Sync wrapper for safe execution
export function safeExecuteSync<T>(
  operation: () => T,
  context?: Record<string, unknown>
): Result<T> {
  try {
    const data = operation();
    return createSuccessResult(data);
  } catch (error) {
    const handledError = handleError(error as Error, context);
    return createErrorResult(handledError);
  }
}