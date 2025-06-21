/**
 * Structured logging utility using Winston
 */

import winston from 'winston';
import debug from 'debug';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface ILogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly metadata?: {
    readonly projectPath?: string;
    readonly fileName?: string;
    readonly analysisType?: string;
    readonly duration?: number;
    readonly error?: Error;
    readonly [key: string]: unknown;
  };
}

export interface ILogger {
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
  trace(message: string, metadata?: Record<string, unknown>): void;
  child(namespace: string): ILogger;
}

class Logger implements ILogger {
  private readonly winston: winston.Logger;
  private readonly debugLogger: debug.Debugger;

  constructor(namespace: string = 'projectanalysis-mcp', level: LogLevel = LogLevel.INFO) {
    this.debugLogger = debug(namespace);
    
    this.winston = winston.createLogger({
      level: this.getWinstonLevel(level),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            ...metadata
          });
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, ...metadata }) => {
              const metaStr = Object.keys(metadata).length > 0 
                ? ` ${JSON.stringify(metadata)}` 
                : '';
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          )
        })
      ]
    });
  }

  error(message: string, error?: Error, metadata: Record<string, unknown> = {}): void {
    const logMetadata = {
      ...metadata,
      ...(error && { 
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })
    };
    
    this.winston.error(message, logMetadata);
    this.debugLogger(`ERROR: ${message}`, logMetadata);
  }

  warn(message: string, metadata: Record<string, unknown> = {}): void {
    this.winston.warn(message, metadata);
    this.debugLogger(`WARN: ${message}`, metadata);
  }

  info(message: string, metadata: Record<string, unknown> = {}): void {
    this.winston.info(message, metadata);
    this.debugLogger(`INFO: ${message}`, metadata);
  }

  debug(message: string, metadata: Record<string, unknown> = {}): void {
    this.winston.debug(message, metadata);
    this.debugLogger(`DEBUG: ${message}`, metadata);
  }

  trace(message: string, metadata: Record<string, unknown> = {}): void {
    this.winston.silly(message, metadata);
    this.debugLogger(`TRACE: ${message}`, metadata);
  }

  child(namespace: string): ILogger {
    return new Logger(`${this.debugLogger.namespace}:${namespace}`, LogLevel.INFO);
  }

  private getWinstonLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return 'error';
      case LogLevel.WARN: return 'warn';
      case LogLevel.INFO: return 'info';
      case LogLevel.DEBUG: return 'debug';
      case LogLevel.TRACE: return 'silly';
      default: return 'info';
    }
  }
}

// Singleton logger instance
let defaultLogger: ILogger;

export function getLogger(namespace?: string): ILogger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  
  return namespace ? defaultLogger.child(namespace) : defaultLogger;
}

export function setLogLevel(level: LogLevel): void {
  defaultLogger = new Logger('projectanalysis-mcp', level);
}

export { Logger };