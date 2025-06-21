/**
 * JavaScript/TypeScript analyzer implementation
 */

import path from 'path';
import Parser from 'tree-sitter';
import { BaseLanguageAnalyzer } from '../base/analyzer-base.js';
import { TreeSitterParser } from './tree-sitter-parser.js';
// import { getLogger, type ILogger } from '@/utils/logger.js';
import type { IFileUtils } from '@/utils/file-utils.js';
import type {
  IDependency,
  IComplexityMetrics,
  IHalsteadMetrics,
  ISourceLocation
} from '@/types/index.js';

export class JavaScriptAnalyzer extends BaseLanguageAnalyzer {
  override readonly language = 'javascript';
  override readonly supportedExtensions = ['.js', '.jsx', '.mjs', '.cjs'];
  override readonly priority = 1;

  constructor(fileUtils?: IFileUtils) {
    super(new TreeSitterParser('javascript'), fileUtils);
  }

  override async extractDependencies(filePath: string): Promise<IDependency[]> {
    const dependencies: IDependency[] = [];
    
    try {
      const content = await this.fileUtils.readFile(filePath);
      const tree = await this.parser.parse(content) as Parser.Tree;
      
      this.traverseTree(tree.rootNode, (node) => {
        switch (node.type) {
          case 'import_statement':
            dependencies.push(...this.extractImportDependencies(node, filePath, content));
            break;
          case 'call_expression':
            dependencies.push(...this.extractRequireDependencies(node, filePath, content));
            break;
          case 'call_expression':
            dependencies.push(...this.extractDynamicImports(node, filePath, content));
            break;
        }
      });

      return dependencies;
    } catch (error) {
      this.logger.error('Failed to extract dependencies', error as Error, { filePath });
      return [];
    }
  }

  override async calculateComplexity(filePath: string): Promise<IComplexityMetrics> {
    try {
      const content = await this.fileUtils.readFile(filePath);
      const tree = await this.parser.parse(content) as Parser.Tree;

      let cyclomaticComplexity = 1; // Base complexity
      let cognitiveComplexity = 0;
      const halstead = this.calculateHalsteadMetrics(tree, content);

      this.traverseTree(tree.rootNode, (node) => {
        // Cyclomatic complexity
        if (this.isDecisionPoint(node)) {
          cyclomaticComplexity++;
        }

        // Cognitive complexity
        cognitiveComplexity += this.getCognitiveWeight(node);
      });

      return {
        cyclomatic: cyclomaticComplexity,
        cognitive: cognitiveComplexity,
        halstead
      };
    } catch (error) {
      this.logger.error('Failed to calculate complexity', error as Error, { filePath });
      return {
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
      };
    }
  }

  protected override async extractExports(ast: unknown, content: string): Promise<Array<{
    name: string;
    type: 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface' | 'namespace';
    isDefault: boolean;
    location: ISourceLocation;
    documentation?: string;
  }>> {
    const exports: Array<{
      name: string;
      type: 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface' | 'namespace';
      isDefault: boolean;
      location: ISourceLocation;
      documentation?: string;
    }> = [];

    const tree = ast as Parser.Tree;
    
    this.traverseTree(tree.rootNode, (node) => {
      switch (node.type) {
        case 'export_statement':
          exports.push(...this.extractExportStatement(node, content));
          break;
        case 'export_default_statement':
          exports.push(...this.extractDefaultExport(node, content));
          break;
      }
    });

    return exports;
  }

  protected override async extractImports(ast: unknown, content: string): Promise<Array<{
    source: string;
    imported: string[];
    isNamespace: boolean;
    alias?: string;
    location: ISourceLocation;
  }>> {
    const imports: Array<{
      source: string;
      imported: string[];
      isNamespace: boolean;
      alias?: string;
      location: ISourceLocation;
    }> = [];

    const tree = ast as Parser.Tree;
    
    this.traverseTree(tree.rootNode, (node) => {
      if (node.type === 'import_statement') {
        const importInfo = this.extractImportStatement(node, content);
        if (importInfo) {
          imports.push(importInfo);
        }
      }
    });

    return imports;
  }

  protected override async extractFunctions(ast: unknown, content: string): Promise<Array<{
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
    const functions: Array<{
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
    }> = [];

    const tree = ast as Parser.Tree;
    
    this.traverseTree(tree.rootNode, (node) => {
      switch (node.type) {
        case 'function_declaration':
        case 'function_expression':
        case 'arrow_function':
        case 'method_definition':
          const functionInfo = this.extractFunctionInfo(node, content);
          if (functionInfo) {
            functions.push(functionInfo);
          }
          break;
      }
    });

    return functions;
  }

  private extractImportDependencies(node: Parser.SyntaxNode, filePath: string, content: string): IDependency[] {
    const dependencies: IDependency[] = [];
    
    const sourceNode = node.childForFieldName('source');
    if (sourceNode) {
      const source = this.getNodeText(sourceNode, content).replace(/['"]/g, '');
      const location = this.nodeToLocation(sourceNode);
      const isExternal = this.isExternalModule(source);

      dependencies.push(this.createDependency(
        filePath,
        source,
        'import',
        location,
        isExternal
      ));
    }

    return dependencies;
  }

  private extractRequireDependencies(node: Parser.SyntaxNode, filePath: string, content: string): IDependency[] {
    const dependencies: IDependency[] = [];
    
    const functionNode = node.childForFieldName('function');
    if (functionNode && this.getNodeText(functionNode, content) === 'require') {
      const argumentsNode = node.childForFieldName('arguments');
      if (argumentsNode && argumentsNode.childCount > 0) {
        const firstArg = argumentsNode.child(0);
        if (firstArg && firstArg.type === 'string') {
          const source = this.getNodeText(firstArg, content).replace(/['"]/g, '');
          const location = this.nodeToLocation(firstArg);
          const isExternal = this.isExternalModule(source);

          dependencies.push(this.createDependency(
            filePath,
            source,
            'require',
            location,
            isExternal
          ));
        }
      }
    }

    return dependencies;
  }

  private extractDynamicImports(node: Parser.SyntaxNode, filePath: string, content: string): IDependency[] {
    const dependencies: IDependency[] = [];
    
    const functionNode = node.childForFieldName('function');
    if (functionNode && this.getNodeText(functionNode, content) === 'import') {
      const argumentsNode = node.childForFieldName('arguments');
      if (argumentsNode && argumentsNode.childCount > 0) {
        const firstArg = argumentsNode.child(0);
        if (firstArg && firstArg.type === 'string') {
          const source = this.getNodeText(firstArg, content).replace(/['"]/g, '');
          const location = this.nodeToLocation(firstArg);
          const isExternal = this.isExternalModule(source);

          dependencies.push(this.createDependency(
            filePath,
            source,
            'dynamic-import',
            location,
            isExternal
          ));
        }
      }
    }

    return dependencies;
  }

  private extractExportStatement(node: Parser.SyntaxNode, content: string): Array<{
    name: string;
    type: 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface' | 'namespace';
    isDefault: boolean;
    location: ISourceLocation;
    documentation?: string;
  }> {
    const exports: Array<{
      name: string;
      type: 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface' | 'namespace';
      isDefault: boolean;
      location: ISourceLocation;
      documentation?: string;
    }> = [];

    // Handle different export patterns
    const declarationNode = node.childForFieldName('declaration');
    if (declarationNode) {
      const location = this.nodeToLocation(declarationNode);
      
      switch (declarationNode.type) {
        case 'function_declaration':
          const functionName = this.getFunctionName(declarationNode, content);
          if (functionName) {
            exports.push({
              name: functionName,
              type: 'function',
              isDefault: false,
              location
            });
          }
          break;
        case 'class_declaration':
          const className = this.getClassName(declarationNode, content);
          if (className) {
            exports.push({
              name: className,
              type: 'class',
              isDefault: false,
              location
            });
          }
          break;
        case 'variable_declaration':
          const variableNames = this.getVariableNames(declarationNode, content);
          variableNames.forEach(name => {
            exports.push({
              name,
              type: 'variable',
              isDefault: false,
              location
            });
          });
          break;
      }
    }

    return exports;
  }

  private extractDefaultExport(node: Parser.SyntaxNode, content: string): Array<{
    name: string;
    type: 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface' | 'namespace';
    isDefault: boolean;
    location: ISourceLocation;
    documentation?: string;
  }> {
    const exports: Array<{
      name: string;
      type: 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface' | 'namespace';
      isDefault: boolean;
      location: ISourceLocation;
      documentation?: string;
    }> = [];

    const declarationNode = node.childForFieldName('declaration') || node.child(1);
    if (declarationNode) {
      const location = this.nodeToLocation(declarationNode);
      let name = 'default';
      let type: 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface' | 'namespace' = 'variable';

      switch (declarationNode.type) {
        case 'function_declaration':
          name = this.getFunctionName(declarationNode, content) || 'default';
          type = 'function';
          break;
        case 'class_declaration':
          name = this.getClassName(declarationNode, content) || 'default';
          type = 'class';
          break;
        case 'identifier':
          name = this.getNodeText(declarationNode, content);
          type = 'variable';
          break;
      }

      exports.push({
        name,
        type,
        isDefault: true,
        location
      });
    }

    return exports;
  }

  private extractImportStatement(node: Parser.SyntaxNode, content: string): {
    source: string;
    imported: string[];
    isNamespace: boolean;
    alias?: string;
    location: ISourceLocation;
  } | null {
    const sourceNode = node.childForFieldName('source');
    if (!sourceNode) return null;

    const source = this.getNodeText(sourceNode, content).replace(/['"]/g, '');
    const location = this.nodeToLocation(node);
    const imported: string[] = [];
    let isNamespace = false;
    let alias: string | undefined;

    // Extract import specifiers
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;

      switch (child.type) {
        case 'import_specifier':
          const specifierName = this.getImportSpecifierName(child, content);
          if (specifierName) {
            imported.push(specifierName);
          }
          break;
        case 'namespace_import':
          isNamespace = true;
          const namespaceAlias = this.getNamespaceAlias(child, content);
          if (namespaceAlias) {
            alias = namespaceAlias;
          }
          break;
        case 'default_import':
          const defaultName = this.getNodeText(child, content);
          if (defaultName) {
            imported.push(defaultName);
          }
          break;
      }
    }

    const result: {
      source: string;
      imported: string[];
      isNamespace: boolean;
      alias?: string;
      location: ISourceLocation;
    } = { source, imported, isNamespace, location };
    
    if (alias) result.alias = alias;
    
    return result;
  }

  private extractFunctionInfo(node: Parser.SyntaxNode, content: string): {
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
  } | null {
    const name = this.getFunctionName(node, content);
    if (!name) return null;

    const parameters = this.getFunctionParameters(node, content);
    const location = this.nodeToLocation(node);
    const isAsync = this.isFunctionAsync(node, content);
    const isGenerator = this.isFunctionGenerator(node, content);
    const complexity = this.calculateFunctionComplexity(node);

    return {
      name,
      parameters,
      isAsync,
      isGenerator,
      visibility: 'public', // JavaScript doesn't have explicit visibility
      location,
      complexity
    };
  }

  private calculateHalsteadMetrics(tree: Parser.Tree, content: string): IHalsteadMetrics {
    const operators = new Set<string>();
    const operands = new Set<string>();
    let operatorCount = 0;
    let operandCount = 0;

    this.traverseTree(tree.rootNode, (node) => {
      if (this.isOperator(node)) {
        const op = this.getNodeText(node, content);
        operators.add(op);
        operatorCount++;
      } else if (this.isOperand(node)) {
        const operand = this.getNodeText(node, content);
        operands.add(operand);
        operandCount++;
      }
    });

    const vocabulary = operators.size + operands.size;
    const length = operatorCount + operandCount;
    const difficulty = vocabulary > 0 ? (operators.size / 2) * (operands.size > 0 ? operandCount / operands.size : 0) : 0;
    const volume = length * Math.log2(vocabulary || 1);
    const effort = difficulty * volume;
    const bugs = volume / 3000;
    const time = effort / 18;

    return {
      vocabulary,
      length,
      difficulty,
      volume,
      effort,
      bugs,
      time
    };
  }

  private isDecisionPoint(node: Parser.SyntaxNode): boolean {
    const decisionTypes = [
      'if_statement',
      'while_statement',
      'for_statement',
      'for_in_statement',
      'for_of_statement',
      'switch_case',
      'catch_clause',
      'conditional_expression',
      'logical_expression'
    ];

    return decisionTypes.includes(node.type);
  }

  private getCognitiveWeight(node: Parser.SyntaxNode): number {
    switch (node.type) {
      case 'if_statement':
      case 'while_statement':
      case 'for_statement':
      case 'for_in_statement':
      case 'for_of_statement':
        return 1;
      case 'switch_case':
        return 1;
      case 'catch_clause':
        return 2;
      case 'conditional_expression':
        return 1;
      case 'logical_expression':
        return 1;
      default:
        return 0;
    }
  }

  private calculateFunctionComplexity(node: Parser.SyntaxNode): number {
    let complexity = 1; // Base complexity

    this.traverseTree(node, (child) => {
      if (this.isDecisionPoint(child)) {
        complexity++;
      }
    });

    return complexity;
  }

  private isExternalModule(moduleName: string): boolean {
    return !moduleName.startsWith('.') && !moduleName.startsWith('/') && !path.isAbsolute(moduleName);
  }

  private isOperator(node: Parser.SyntaxNode): boolean {
    const operatorTypes = [
      '+', '-', '*', '/', '%', '**',
      '=', '+=', '-=', '*=', '/=', '%=',
      '==', '!=', '===', '!==', '<', '>', '<=', '>=',
      '&&', '||', '!',
      '&', '|', '^', '~', '<<', '>>', '>>>',
      '++', '--',
      '?', ':',
      'typeof', 'instanceof', 'in', 'new', 'delete'
    ];

    return operatorTypes.includes(node.type);
  }

  private isOperand(node: Parser.SyntaxNode): boolean {
    const operandTypes = [
      'identifier',
      'number',
      'string',
      'boolean',
      'null',
      'undefined',
      'this',
      'super'
    ];

    return operandTypes.includes(node.type);
  }

  private traverseTree(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.traverseTree(child, callback);
      }
    }
  }

  private getNodeText(node: Parser.SyntaxNode, content: string): string {
    return content.slice(node.startIndex, node.endIndex);
  }

  private nodeToLocation(node: Parser.SyntaxNode): ISourceLocation {
    return {
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    };
  }

  private getFunctionName(node: Parser.SyntaxNode, content: string): string | null {
    const nameNode = node.childForFieldName('name');
    return nameNode ? this.getNodeText(nameNode, content) : null;
  }

  private getClassName(node: Parser.SyntaxNode, content: string): string | null {
    const nameNode = node.childForFieldName('name');
    return nameNode ? this.getNodeText(nameNode, content) : null;
  }

  private getVariableNames(node: Parser.SyntaxNode, content: string): string[] {
    const names: string[] = [];
    
    this.traverseTree(node, (child) => {
      if (child.type === 'variable_declarator') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          names.push(this.getNodeText(nameNode, content));
        }
      }
    });

    return names;
  }

  private getFunctionParameters(node: Parser.SyntaxNode, content: string): Array<{
    name: string;
    type?: string;
    isOptional: boolean;
    defaultValue?: string;
  }> {
    const parameters: Array<{
      name: string;
      type?: string;
      isOptional: boolean;
      defaultValue?: string;
    }> = [];

    const parametersNode = node.childForFieldName('parameters');
    if (parametersNode) {
      this.traverseTree(parametersNode, (child) => {
        if (child.type === 'identifier' || child.type === 'formal_parameter') {
          const name = this.getNodeText(child, content);
          parameters.push({
            name,
            isOptional: false // JavaScript doesn't have explicit optional parameters
          });
        }
      });
    }

    return parameters;
  }

  private isFunctionAsync(node: Parser.SyntaxNode, content: string): boolean {
    return this.getNodeText(node, content).includes('async');
  }

  private isFunctionGenerator(node: Parser.SyntaxNode, content: string): boolean {
    return this.getNodeText(node, content).includes('function*');
  }

  private getImportSpecifierName(node: Parser.SyntaxNode, content: string): string | null {
    const nameNode = node.childForFieldName('name');
    return nameNode ? this.getNodeText(nameNode, content) : null;
  }

  private getNamespaceAlias(node: Parser.SyntaxNode, content: string): string | null {
    const aliasNode = node.childForFieldName('alias');
    return aliasNode ? this.getNodeText(aliasNode, content) : null;
  }
}

// TypeScript analyzer extends JavaScript analyzer
export class TypeScriptAnalyzer extends BaseLanguageAnalyzer {
  override readonly language = 'typescript';
  override readonly supportedExtensions = ['.ts', '.tsx'];
  override readonly priority = 2;

  constructor(fileUtils?: IFileUtils) {
    super(new TreeSitterParser('typescript'), fileUtils);
  }

  // Use JavaScript analyzer methods
  override async extractDependencies(filePath: string): Promise<IDependency[]> {
    const jsAnalyzer = new JavaScriptAnalyzer(this.fileUtils);
    return jsAnalyzer.extractDependencies(filePath);
  }

  override async calculateComplexity(filePath: string): Promise<IComplexityMetrics> {
    const jsAnalyzer = new JavaScriptAnalyzer(this.fileUtils);
    return jsAnalyzer.calculateComplexity(filePath);
  }
}