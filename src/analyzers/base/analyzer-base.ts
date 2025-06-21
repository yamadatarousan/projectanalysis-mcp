/**
 * Base analyzer class providing common functionality
 */

import { getLogger, type ILogger } from '@/utils/logger.js';
import { createFileUtils, type IFileUtils } from '@/utils/file-utils.js';
import type {
  ILanguageAnalyzer,
  IFileAnalysis,
  IDependency,
  IComplexityMetrics,
  IArchitecturePattern,
  IProjectStructure,
  IParser,
  ISourceLocation,
  DependencyType
} from '@/types/index.js';

export abstract class BaseLanguageAnalyzer implements ILanguageAnalyzer {
  abstract readonly language: string;
  abstract readonly supportedExtensions: string[];
  readonly priority: number = 0;

  protected readonly logger: ILogger;
  protected readonly fileUtils: IFileUtils;
  protected readonly parser: IParser;

  constructor(parser: IParser, fileUtils?: IFileUtils) {
    this.parser = parser;
    this.fileUtils = fileUtils ?? createFileUtils();
    this.logger = getLogger('analyzer:base');
  }

  async analyzeFile(filePath: string): Promise<IFileAnalysis> {
    this.logger.debug('Analyzing file', { filePath });
    
    const startTime = Date.now();

    try {
      // Validate file path and extension
      if (!this.isSupported(filePath)) {
        throw new Error(`Unsupported file extension: ${filePath}`);
      }

      const content = await this.fileUtils.readFile(filePath);
      
      if (content.length === 0) {
        return this.createEmptyAnalysis(filePath);
      }

      // Parse the file
      const ast = await this.parser.parse(content);

      // Extract analysis data
      const [dependencies, exports, imports, metrics, functions, classes, variables, comments] = 
        await Promise.all([
          this.extractDependencies(filePath),
          this.extractExports(ast, content),
          this.extractImports(ast, content),
          this.calculateComplexity(filePath),
          this.extractFunctions(ast, content),
          this.extractClasses(ast, content),
          this.extractVariables(ast, content),
          this.extractComments(ast, content)
        ]);

      const analysis: IFileAnalysis = {
        filePath,
        language: this.language,
        ast,
        dependencies,
        exports,
        imports,
        metrics,
        functions,
        classes,
        variables,
        comments,
        analyzedAt: new Date()
      };

      const duration = Date.now() - startTime;
      this.logger.debug('File analysis completed', { 
        filePath, 
        duration,
        dependencies: dependencies.length,
        functions: functions.length 
      });

      return analysis;
    } catch (error) {
      this.logger.error('File analysis failed', error as Error, { filePath });
      throw new AnalysisError(`Failed to analyze file: ${filePath}`, 'FILE_ANALYSIS_ERROR', error);
    }
  }

  async analyzeBatch(filePaths: string[]): Promise<IFileAnalysis[]> {
    this.logger.info('Starting batch analysis', { fileCount: filePaths.length });
    
    const startTime = Date.now();
    const results: IFileAnalysis[] = [];
    const errors: Array<{ filePath: string; error: Error }> = [];

    // Process files in parallel with concurrency limit
    const concurrency = 4;
    const chunks = this.chunkArray(filePaths, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(filePath => this.analyzeFile(filePath))
      );

      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const filePath = chunk[index];
          errors.push({ filePath, error: result.reason });
          this.logger.warn('File analysis failed in batch', { 
            filePath, 
            error: result.reason 
          });
        }
      });
    }

    const duration = Date.now() - startTime;
    this.logger.info('Batch analysis completed', {
      total: filePaths.length,
      successful: results.length,
      failed: errors.length,
      duration
    });

    return results;
  }

  // Abstract methods to be implemented by specific analyzers
  abstract extractDependencies(filePath: string): Promise<IDependency[]>;
  abstract calculateComplexity(filePath: string): Promise<IComplexityMetrics>;
  
  // Optional methods with default implementations
  async detectPatterns?(_structure: IProjectStructure): Promise<IArchitecturePattern[]> {
    return [];
  }

  // Protected helper methods
  protected async extractExports(_ast: unknown, _content: string): Promise<Array<{
    name: string;
    type: 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface' | 'namespace';
    isDefault: boolean;
    location: ISourceLocation;
    documentation?: string;
  }>> {
    // Default implementation - to be overridden by specific analyzers
    return [];
  }

  protected async extractImports(_ast: unknown, _content: string): Promise<Array<{
    source: string;
    imported: string[];
    isNamespace: boolean;
    alias?: string;
    location: ISourceLocation;
  }>> {
    // Default implementation - to be overridden by specific analyzers
    return [];
  }

  protected async extractFunctions(_ast: unknown, _content: string): Promise<Array<{
    name: string;
    parameters: Array<{
      name: string;
      type?: string;
      isOptional: boolean;
      defaultValue?: string;
    }>;
    returnType?: string;
    isAsync: boolean;
    isGenerator: boolean;
    visibility: 'public' | 'private' | 'protected';
    location: ISourceLocation;
    complexity: number;
    documentation?: string;
  }>> {
    // Default implementation - to be overridden by specific analyzers
    return [];
  }

  protected async extractClasses(_ast: unknown, _content: string): Promise<Array<{
    name: string;
    superClass?: string;
    interfaces: string[];
    methods: Array<{
      name: string;
      parameters: Array<{
        name: string;
        type?: string;
        isOptional: boolean;
        defaultValue?: string;
      }>;
      returnType?: string;
      isStatic: boolean;
      isAsync: boolean;
      visibility: 'public' | 'private' | 'protected';
      location: ISourceLocation;
      complexity: number;
      documentation?: string;
    }>;
    properties: Array<{
      name: string;
      type?: string;
      isStatic: boolean;
      isReadonly: boolean;
      visibility: 'public' | 'private' | 'protected';
      location: ISourceLocation;
      defaultValue?: string;
      documentation?: string;
    }>;
    visibility: 'public' | 'private' | 'protected';
    isAbstract: boolean;
    location: ISourceLocation;
    documentation?: string;
  }>> {
    // Default implementation - to be overridden by specific analyzers
    return [];
  }

  protected async extractVariables(_ast: unknown, _content: string): Promise<Array<{
    name: string;
    type?: string;
    scope: 'global' | 'module' | 'function' | 'block' | 'class';
    isConstant: boolean;
    location: ISourceLocation;
    documentation?: string;
  }>> {
    // Default implementation - to be overridden by specific analyzers
    return [];
  }

  protected async extractComments(_ast: unknown, content: string): Promise<Array<{
    content: string;
    type: 'line' | 'block' | 'doc';
    location: ISourceLocation;
  }>> {
    // Parse comments from content
    const comments: Array<{
      content: string;
      type: 'line' | 'block' | 'doc';
      location: ISourceLocation;
    }> = [];

    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      const trimmed = line.trim();

      // Line comments
      if (trimmed.startsWith('//')) {
        comments.push({
          content: trimmed.substring(2).trim(),
          type: 'line',
          location: { line: i + 1, column: line.indexOf('//') }
        });
      }

      // Block comments (simple detection)
      const blockStart = line.indexOf('/*');
      if (blockStart !== -1) {
        const blockEnd = line.indexOf('*/', blockStart);
        if (blockEnd !== -1) {
          // Single line block comment
          const commentContent = line.substring(blockStart + 2, blockEnd).trim();
          comments.push({
            content: commentContent,
            type: trimmed.startsWith('/**') ? 'doc' : 'block',
            location: { line: i + 1, column: blockStart }
          });
        }
      }
    }

    return comments;
  }

  protected isSupported(filePath: string): boolean {
    const extension = this.getFileExtension(filePath);
    return this.supportedExtensions.includes(extension);
  }

  protected getFileExtension(filePath: string): string {
    const match = filePath.match(/\.[^.]+$/);
    return match?.[0] ?? '';
  }

  protected createEmptyAnalysis(filePath: string): IFileAnalysis {
    return {
      filePath,
      language: this.language,
      dependencies: [],
      exports: [],
      imports: [],
      metrics: {
        cyclomatic: 0,
        cognitive: 0,
        halstead: {
          vocabulary: 0,
          length: 0,
          difficulty: 0,
          volume: 0,
          effort: 0,
          bugs: 0,
          time: 0
        }
      },
      functions: [],
      classes: [],
      variables: [],
      comments: [],
      analyzedAt: new Date()
    };
  }

  protected chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  protected createDependency(
    source: string,
    target: string,
    type: DependencyType,
    location: ISourceLocation,
    isExternal = false
  ): IDependency {
    return {
      source,
      target,
      type,
      isResolved: false,
      isExternal,
      location
    };
  }

  protected createSourceLocation(
    line: number,
    column: number,
    endLine?: number,
    endColumn?: number
  ): ISourceLocation {
    const location: ISourceLocation = { line, column };
    if (endLine !== undefined) location.endLine = endLine;
    if (endColumn !== undefined) location.endColumn = endColumn;
    return location;
  }
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}