/**
 * MCP (Model Context Protocol) related types
 */

import type { JSONSchema7 } from 'json-schema';

// MCP Tool interfaces
export interface IMCPTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JSONSchema7;
  execute(params: unknown): Promise<IMCPToolResult>;
}

export interface IMCPToolResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: IMCPError;
  readonly metadata?: IMCPMetadata;
}

export interface IMCPError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface IMCPMetadata {
  readonly executionTime: number;
  readonly cacheHit?: boolean;
  readonly warnings?: string[];
}

// MCP Resource interfaces
export interface IMCPResource {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
  read(): Promise<IMCPResourceContent>;
}

export interface IMCPResourceContent {
  readonly content: string | ArrayBuffer;
  readonly mimeType: string;
  readonly size: number;
  readonly lastModified?: Date;
}

// Specific tool parameter types
export interface IAnalyzeProjectParams {
  readonly projectPath: string;
  readonly depth?: number;
  readonly includePatterns?: string[];
  readonly excludePatterns?: string[];
  readonly calculateMetrics?: boolean;
  readonly detectPatterns?: boolean;
}

export interface IGenerateDiagramParams {
  readonly projectPath: string;
  readonly diagramType: 'component' | 'dependency' | 'layered' | 'class';
  readonly format?: 'mermaid' | 'plantuml' | 'dot';
  readonly maxNodes?: number;
  readonly theme?: string;
}

export interface IAnalyzeDependenciesParams {
  readonly projectPath: string;
  readonly targetFiles?: string[];
  readonly includeExternal?: boolean;
  readonly maxDepth?: number;
}

export interface ITraceImpactParams {
  readonly projectPath: string;
  readonly targetFile: string;
  readonly direction: 'incoming' | 'outgoing' | 'both';
  readonly maxDepth?: number;
}

export interface IDetectPatternsParams {
  readonly projectPath: string;
  readonly patternTypes?: string[];
  readonly confidence?: number;
}

// Tool result types
export interface IAnalyzeProjectResult {
  readonly analysis: IAnalysisResult;
  readonly cached?: boolean;
}

export interface IGenerateDiagramResult {
  readonly diagram: IVisualizationResult;
  readonly metadata: IVisualizationMetadata;
}

export interface IAnalyzeDependenciesResult {
  readonly dependencies: IDependencyGraph;
  readonly summary: IDependencySummary;
}

export interface IDependencySummary {
  readonly totalDependencies: number;
  readonly externalDependencies: number;
  readonly circularDependencies: number;
  readonly maxDepth: number;
  readonly recommendations: string[];
}

export interface ITraceImpactResult {
  readonly impactedFiles: IImpactedFile[];
  readonly summary: IImpactSummary;
}

export interface IImpactedFile {
  readonly filePath: string;
  readonly impactType: 'direct' | 'indirect';
  readonly distance: number;
  readonly dependencyPath: string[];
}

export interface IImpactSummary {
  readonly totalImpactedFiles: number;
  readonly directImpacts: number;
  readonly indirectImpacts: number;
  readonly maxDistance: number;
  readonly criticalPaths: string[][];
}

export interface IDetectPatternsResult {
  readonly patterns: IArchitecturePattern[];
  readonly summary: IPatternSummary;
}

export interface IPatternSummary {
  readonly totalPatterns: number;
  readonly patternTypes: Record<string, number>;
  readonly highConfidencePatterns: number;
  readonly recommendations: string[];
}

// MCP Server interfaces
export interface IMCPServer {
  readonly name: string;
  readonly version: string;
  readonly tools: Map<string, IMCPTool>;
  readonly resources: Map<string, IMCPResource>;
  
  start(): Promise<void>;
  stop(): Promise<void>;
  registerTool(tool: IMCPTool): void;
  registerResource(resource: IMCPResource): void;
  handleRequest(request: IMCPRequest): Promise<IMCPResponse>;
}

export interface IMCPRequest {
  readonly id: string;
  readonly method: string;
  readonly params?: unknown;
}

export interface IMCPResponse {
  readonly id: string;
  readonly result?: unknown;
  readonly error?: IMCPError;
}

// Re-export types from analysis.ts and project.ts
export type {
  IAnalysisResult,
  IVisualizationResult,
  IVisualizationMetadata,
  IDependencyGraph,
  IArchitecturePattern,
  IProjectStructure,
  IComplexityMetrics
} from './analysis.js';

export type {
  IFileAnalysis,
  IDependency,
  ILanguageAnalyzer,
  IAnalysisConfig
} from './project.js';