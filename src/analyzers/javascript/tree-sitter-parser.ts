/**
 * Tree-sitter parser for JavaScript/TypeScript
 */

import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import { getLogger, type ILogger } from '@/utils/logger.js';
import type { IParser } from '@/types/project.js';

export class TreeSitterParser implements IParser {
  readonly language: string;
  private readonly parser: Parser;
  private readonly logger: ILogger;

  constructor(language: 'javascript' | 'typescript') {
    this.language = language;
    this.logger = getLogger(`parser:${language}`);
    
    this.parser = new Parser();
    
    if (language === 'typescript') {
      this.parser.setLanguage(TypeScript.typescript);
    } else {
      this.parser.setLanguage(JavaScript);
    }
  }

  async parse(content: string): Promise<Parser.Tree> {
    try {
      const tree = this.parser.parse(content);
      
      // Check for parse errors if the method exists
      try {
        if (tree && tree.rootNode && 'hasError' in tree.rootNode) {
          const hasError = (tree.rootNode as any).hasError;
          if (typeof hasError === 'function' && hasError()) {
            this.logger.warn('Parse tree contains errors', {
              language: this.language,
              contentLength: content.length
            });
          }
        }
      } catch (err) {
        // Ignore error checking failures
      }

      return tree;
    } catch (error) {
      this.logger.error('Parsing failed', error as Error, {
        language: this.language,
        contentLength: content.length
      });
      throw new ParsingError(`Failed to parse ${this.language} content`, error as Error);
    }
  }

  async parseFile(filePath: string): Promise<Parser.Tree> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parse(content);
  }

  isSupported(filePath: string): boolean {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    if (this.language === 'typescript') {
      return extension === 'ts' || extension === 'tsx';
    } else {
      return extension === 'js' || extension === 'jsx' || extension === 'mjs' || extension === 'cjs';
    }
  }
}

export class ParsingError extends Error {
  constructor(message: string, public override readonly cause?: Error) {
    super(message);
    this.name = 'ParsingError';
  }
}