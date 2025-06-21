/**
 * Analyzer registry and factory functions
 */

import { getLogger, type ILogger } from '@/utils/logger.js';
import { BaseLanguageAnalyzer } from './base/analyzer-base.js';
import { JavaScriptAnalyzer, TypeScriptAnalyzer } from './javascript/javascript-analyzer.js';
import type { ILanguageAnalyzer } from '@/types/project.js';

export interface IAnalyzerRegistry {
  register(analyzer: ILanguageAnalyzer): void;
  getAnalyzer(language: string): ILanguageAnalyzer | null;
  getAnalyzerByExtension(extension: string): ILanguageAnalyzer | null;
  getAllAnalyzers(): ILanguageAnalyzer[];
  getSupportedLanguages(): string[];
  getSupportedExtensions(): string[];
}

export class AnalyzerRegistry implements IAnalyzerRegistry {
  private readonly analyzers = new Map<string, ILanguageAnalyzer>();
  private readonly extensionMap = new Map<string, ILanguageAnalyzer>();
  private readonly logger: ILogger;

  constructor() {
    this.logger = getLogger('analyzer-registry');
    this.registerDefaultAnalyzers();
  }

  register(analyzer: ILanguageAnalyzer): void {
    this.logger.debug('Registering analyzer', { 
      language: analyzer.language,
      extensions: analyzer.supportedExtensions 
    });

    // Register by language
    this.analyzers.set(analyzer.language, analyzer);

    // Register by extensions
    analyzer.supportedExtensions.forEach(ext => {
      this.extensionMap.set(ext, analyzer);
    });

    this.logger.info('Analyzer registered', { 
      language: analyzer.language,
      extensions: analyzer.supportedExtensions.length 
    });
  }

  getAnalyzer(language: string): ILanguageAnalyzer | null {
    return this.analyzers.get(language) || null;
  }

  getAnalyzerByExtension(extension: string): ILanguageAnalyzer | null {
    // Ensure extension starts with dot
    const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;
    return this.extensionMap.get(normalizedExt) || null;
  }

  getAllAnalyzers(): ILanguageAnalyzer[] {
    return Array.from(this.analyzers.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.analyzers.keys()).sort();
  }

  getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys()).sort();
  }

  private registerDefaultAnalyzers(): void {
    // Register JavaScript analyzer
    this.register(new JavaScriptAnalyzer());
    
    // Register TypeScript analyzer
    this.register(new TypeScriptAnalyzer());

    this.logger.info('Default analyzers registered', {
      languages: this.getSupportedLanguages(),
      extensions: this.getSupportedExtensions()
    });
  }
}

// Factory function
export function createAnalyzerRegistry(): IAnalyzerRegistry {
  return new AnalyzerRegistry();
}

// Re-export analyzer classes
export { BaseLanguageAnalyzer } from './base/analyzer-base.js';
export { JavaScriptAnalyzer, TypeScriptAnalyzer } from './javascript/javascript-analyzer.js';
export { TreeSitterParser } from './javascript/tree-sitter-parser.js';

// Re-export types
export type { ILanguageAnalyzer } from '@/types/project.js';