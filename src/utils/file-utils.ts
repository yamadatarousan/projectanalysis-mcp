/**
 * Secure file system utilities
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'fast-glob';
import ignore from 'ignore';
import { getLogger, type ILogger } from './logger.js';
import type { IFileInfo, IDirectoryInfo } from '@/types/project.js';

export interface IFileUtils {
  getAllFiles(directoryPath: string, options?: IFileSearchOptions): Promise<string[]>;
  getFileInfo(filePath: string): Promise<IFileInfo>;
  getDirectoryInfo(dirPath: string): Promise<IDirectoryInfo>;
  readFile(filePath: string): Promise<string>;
  exists(filePath: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  isFile(path: string): Promise<boolean>;
  validatePath(inputPath: string): Promise<ValidationResult>;
  createIgnoreFilter(patterns: string[]): (filePath: string) => boolean;
}

export interface IFileSearchOptions {
  readonly includePatterns?: string[];
  readonly excludePatterns?: string[];
  readonly maxFileSize?: number;
  readonly maxDepth?: number;
  readonly followSymlinks?: boolean;
  readonly extensions?: string[];
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly normalizedPath?: string;
  readonly error?: string;
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class FileUtils implements IFileUtils {
  private readonly logger: ILogger;
  private readonly allowedBasePaths: string[];
  private readonly maxTraversalDepth: number;

  constructor(options: {
    allowedBasePaths?: string[];
    maxTraversalDepth?: number;
  } = {}) {
    this.logger = getLogger('file-utils');
    this.allowedBasePaths = options.allowedBasePaths ?? [process.cwd()];
    this.maxTraversalDepth = options.maxTraversalDepth ?? 10;
  }

  async getAllFiles(
    directoryPath: string, 
    options: IFileSearchOptions = {}
  ): Promise<string[]> {
    const validation = await this.validatePath(directoryPath);
    if (!validation.isValid) {
      throw new SecurityError(validation.error ?? 'Invalid path');
    }

    const normalizedPath = validation.normalizedPath!;

    const {
      includePatterns = ['**/*'],
      excludePatterns = [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '.cache/**',
        'coverage/**',
        '.nyc_output/**'
      ],
      maxFileSize = 10 * 1024 * 1024, // 10MB
      maxDepth = this.maxTraversalDepth,
      followSymlinks = false,
      extensions
    } = options;

    try {
      const globPatterns = includePatterns.map(pattern => 
        path.posix.join(normalizedPath.replace(/\\/g, '/'), pattern)
      );

      const files = await glob(globPatterns, {
        ignore: excludePatterns,
        dot: false,
        absolute: true,
        followSymbolicLinks: followSymlinks,
        deep: maxDepth,
        onlyFiles: true,
        markDirectories: false
      });

      // Filter by extensions if specified
      let filteredFiles = extensions 
        ? files.filter(file => extensions.includes(path.extname(file)))
        : files;

      // Filter by file size
      filteredFiles = await this.filterByFileSize(filteredFiles, maxFileSize);

      this.logger.debug('Files found', {
        directory: normalizedPath,
        totalFiles: filteredFiles.length,
        patterns: includePatterns,
        excludePatterns
      });

      return filteredFiles;
    } catch (error) {
      this.logger.error('Failed to get files', error as Error, {
        directory: normalizedPath
      });
      throw error;
    }
  }

  async getFileInfo(filePath: string): Promise<IFileInfo> {
    const validation = await this.validatePath(filePath);
    if (!validation.isValid) {
      throw new SecurityError(validation.error ?? 'Invalid file path');
    }

    const normalizedPath = validation.normalizedPath!;

    try {
      const stats = await fs.stat(normalizedPath);
      
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${normalizedPath}`);
      }

      const relativePath = path.relative(process.cwd(), normalizedPath);
      const name = path.basename(normalizedPath);
      const extension = path.extname(normalizedPath);

      const fileInfo: IFileInfo = {
        path: normalizedPath,
        relativePath,
        name,
        extension,
        size: stats.size,
        encoding: 'utf-8', // Default assumption
        lastModified: stats.mtime,
        permissions: stats.mode.toString(8),
        isSymlink: stats.isSymbolicLink()
      };
      
      const detectedLanguage = this.detectLanguage(extension);
      
      if (detectedLanguage) {
        return {
          ...fileInfo,
          language: detectedLanguage
        };
      } else {
        return fileInfo;
      }
    } catch (error) {
      this.logger.error('Failed to get file info', error as Error, {
        filePath: normalizedPath
      });
      throw error;
    }
  }

  async getDirectoryInfo(dirPath: string): Promise<IDirectoryInfo> {
    const validation = await this.validatePath(dirPath);
    if (!validation.isValid) {
      throw new SecurityError(validation.error ?? 'Invalid directory path');
    }

    const normalizedPath = validation.normalizedPath!;

    try {
      const stats = await fs.stat(normalizedPath);
      
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${normalizedPath}`);
      }

      const entries = await fs.readdir(normalizedPath, { withFileTypes: true });
      
      let fileCount = 0;
      let directoryCount = 0;
      let totalSize = 0;

      for (const entry of entries) {
        if (entry.isFile()) {
          fileCount++;
          const entryPath = path.join(normalizedPath, entry.name);
          const entryStats = await fs.stat(entryPath);
          totalSize += entryStats.size;
        } else if (entry.isDirectory()) {
          directoryCount++;
        }
      }

      const relativePath = path.relative(process.cwd(), normalizedPath);
      const name = path.basename(normalizedPath);

      return {
        path: normalizedPath,
        relativePath,
        name,
        fileCount,
        directoryCount,
        totalSize,
        lastModified: stats.mtime,
        permissions: stats.mode.toString(8)
      };
    } catch (error) {
      this.logger.error('Failed to get directory info', error as Error, {
        dirPath: normalizedPath
      });
      throw error;
    }
  }

  async readFile(filePath: string): Promise<string> {
    const validation = await this.validatePath(filePath);
    if (!validation.isValid) {
      throw new SecurityError(validation.error ?? 'Invalid file path');
    }

    const normalizedPath = validation.normalizedPath!;

    try {
      const content = await fs.readFile(normalizedPath, 'utf-8');
      this.logger.trace('File read', { 
        filePath: normalizedPath, 
        size: content.length 
      });
      return content;
    } catch (error) {
      this.logger.error('Failed to read file', error as Error, {
        filePath: normalizedPath
      });
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async isDirectory(inputPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(inputPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async isFile(inputPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(inputPath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  async validatePath(inputPath: string): Promise<ValidationResult> {
    if (!inputPath || typeof inputPath !== 'string') {
      return { isValid: false, error: 'Path must be a non-empty string' };
    }

    // Check for path traversal
    if (inputPath.includes('..') || inputPath.includes('\0')) {
      return { isValid: false, error: 'Path traversal detected' };
    }

    try {
      const normalizedPath = path.resolve(inputPath);
      
      // Check if path is within allowed directories
      const isAllowed = this.allowedBasePaths.some(basePath => {
        const normalizedBase = path.resolve(basePath);
        return normalizedPath.startsWith(normalizedBase);
      });

      if (!isAllowed) {
        return { 
          isValid: false, 
          error: `Access denied: path outside allowed directories` 
        };
      }

      return { isValid: true, normalizedPath };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid path format: ${(error as Error).message}` 
      };
    }
  }

  createIgnoreFilter(patterns: string[]): (filePath: string) => boolean {
    const ig = ignore().add(patterns);
    
    return (filePath: string): boolean => {
      const relativePath = path.relative(process.cwd(), filePath);
      return !ig.ignores(relativePath);
    };
  }

  private async filterByFileSize(files: string[], maxSize: number): Promise<string[]> {
    const filteredFiles: string[] = [];

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        if (stats.size <= maxSize) {
          filteredFiles.push(file);
        } else {
          this.logger.debug('File excluded due to size', {
            file,
            size: stats.size,
            maxSize
          });
        }
      } catch (error) {
        this.logger.warn('Failed to check file size', {
          file,
          error: (error as Error).message
        });
      }
    }

    return filteredFiles;
  }

  private detectLanguage(extension: string): string | undefined {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.py': 'python',
      '.pyx': 'python',
      '.pyi': 'python',
      '.java': 'java',
      '.jar': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp'
    };

    return languageMap[extension.toLowerCase()];
  }
}

// Factory function
export function createFileUtils(options?: {
  allowedBasePaths?: string[];
  maxTraversalDepth?: number;
}): IFileUtils {
  return new FileUtils(options);
}