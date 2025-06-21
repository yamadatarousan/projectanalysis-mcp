/**
 * Centralized error handling system
 */

import { getLogger, type ILogger } from './logger.js';

export abstract class BaseError extends Error {
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
  
  abstract get code(): string;
  abstract get statusCode(): number;

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
  get code(): string { return 'VALIDATION_ERROR'; }
  get statusCode(): number { return 400; }

  constructor(message: string, field?: string, value?: unknown) {
    super(message, { field, value });
  }
}

export class ConfigurationError extends BaseError {
  get code(): string { return 'CONFIGURATION_ERROR'; }
  get statusCode(): number { return 500; }

  constructor(message: string, configPath?: string) {
    super(message, { configPath });
  }
}

// File System Errors
export class FileSystemError extends BaseError {
  get code(): string { return 'FILESYSTEM_ERROR'; }
  get statusCode(): number { return 500; }

  constructor(message: string, filePath?: string, operation?: string) {
    super(message, { filePath, operation });
  }
}

export class FileNotFoundError extends FileSystemError {
  override get code(): string { return 'FILE_NOT_FOUND'; }
  override get statusCode(): number { return 404; }

  constructor(filePath: string) {
    super(`File not found: ${filePath}`, filePath, 'read');
  }
}

export class DirectoryNotFoundError extends FileSystemError {
  override get code(): string { return 'DIRECTORY_NOT_FOUND'; }
  override get statusCode(): number { return 404; }

  constructor(dirPath: string) {
    super(`Directory not found: ${dirPath}`, dirPath, 'access');
  }
}

// Security Errors
export class SecurityError extends BaseError {
  get code(): string { return 'SECURITY_ERROR'; }
  get statusCode(): number { return 403; }

  constructor(message: string, violationType?: string) {
    super(message, { violationType });
  }
}

export class PathTraversalError extends SecurityError {
  override get code(): string { return 'PATH_TRAVERSAL'; }
  override get statusCode(): number { return 403; }

  constructor(path: string) {
    super(`Path traversal detected: ${path}`, 'path_traversal');
  }
}

export class AccessDeniedError extends SecurityError {
  override get code(): string { return 'ACCESS_DENIED'; }
  override get statusCode(): number { return 403; }

  constructor(resource: string, operation?: string) {
    super(`Access denied to ${resource}${operation ? ` for operation: ${operation}` : ''}`, 'access_denied');
  }
}

// Analysis Errors
export class AnalysisError extends BaseError {
  get code(): string { return 'ANALYSIS_ERROR'; }
  get statusCode(): number { return 500; }

  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class ParsingError extends AnalysisError {
  override get code(): string { return 'PARSING_ERROR'; }
  override get statusCode(): number { return 422; }

  constructor(filePath: string, language?: string, cause?: Error) {
    super(`Failed to parse file: ${filePath}${language ? ` (${language})` : ''}`, {
      filePath,
      language,
      cause: cause?.message
    });
  }
}

export class UnsupportedLanguageError extends AnalysisError {
  override get code(): string { return 'UNSUPPORTED_LANGUAGE'; }
  override get statusCode(): number { return 422; }

  constructor(language: string, filePath?: string) {
    super(`Unsupported language: ${language}${filePath ? ` in file: ${filePath}` : ''}`, {
      language,
      filePath
    });
  }
}

export class ComplexityCalculationError extends AnalysisError {
  override get code(): string { return 'COMPLEXITY_CALCULATION_ERROR'; }
  override get statusCode(): number { return 500; }

  constructor(filePath: string, cause?: Error) {
    super(`Failed to calculate complexity for: ${filePath}`, {
      filePath,
      cause: cause?.message
    });
  }
}

// Resource Errors
export class ResourceError extends BaseError {
  get code(): string { return 'RESOURCE_ERROR'; }
  get statusCode(): number { return 500; }

  constructor(message: string, resourceType?: string) {
    super(message, { resourceType });
  }
}

export class ResourceLimitError extends ResourceError {
  override get code(): string { return 'RESOURCE_LIMIT_EXCEEDED'; }
  override get statusCode(): number { return 429; }

  constructor(limitType: string, limit: number, actual: number) {
    super(`${limitType} limit exceeded: ${actual} > ${limit}`);
    (this as any).details = { limitType, limit, actual };
  }
}

export class TimeoutError extends ResourceError {
  override get code(): string { return 'TIMEOUT'; }
  override get statusCode(): number { return 408; }

  constructor(operation: string, timeout: number) {
    super(`Operation timed out: ${operation} (${timeout}ms)`);
    (this as any).details = { operation, timeout };
  }
}

export class MemoryError extends ResourceError {
  override get code(): string { return 'MEMORY_ERROR'; }
  override get statusCode(): number { return 507; }

  constructor(operation: string, memoryUsed: number, memoryLimit: number) {
    super(`Memory limit exceeded during ${operation}: ${memoryUsed}MB > ${memoryLimit}MB`);
    (this as any).details = { operation, memoryUsed, memoryLimit };
  }
}

// Cache Errors
export class CacheError extends BaseError {
  get code(): string { return 'CACHE_ERROR'; }
  get statusCode(): number { return 500; }

  constructor(message: string, operation?: string, key?: string) {
    super(message, { operation, key });
  }
}

// MCP Errors
export class MCPError extends BaseError {
  get code(): string { return 'MCP_ERROR'; }
  get statusCode(): number { return 500; }

  constructor(message: string, method?: string, toolName?: string) {
    super(message, { method, toolName });
  }
}

export class ToolNotFoundError extends MCPError {
  override get code(): string { return 'TOOL_NOT_FOUND'; }
  override get statusCode(): number { return 404; }

  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, undefined, toolName);
  }
}

export class ToolExecutionError extends MCPError {
  override get code(): string { return 'TOOL_EXECUTION_ERROR'; }
  override get statusCode(): number { return 500; }

  constructor(toolName: string, cause?: Error) {
    super(`Tool execution failed: ${toolName}`, undefined, toolName);
    if (cause) {
      const currentDetails = this.details || {};
      (this as any).details = { ...currentDetails, cause: cause.message, stack: cause.stack };
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
    return new AnalysisError(`Unexpected error: ${message}`, details);
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