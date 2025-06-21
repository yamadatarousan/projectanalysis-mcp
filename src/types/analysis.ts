/**
 * Analysis result types for project analysis MCP server
 */

export interface IProjectStructure {
  readonly path: string;
  readonly name: string;
  readonly type: 'file' | 'directory';
  readonly children?: IProjectStructure[];
  readonly size?: number;
  readonly extension?: string;
  readonly language?: string;
  readonly lastModified: Date;
}

export interface ITechStack {
  readonly languages: ILanguageInfo[];
  readonly frameworks: IFrameworkInfo[];
  readonly dependencies: IDependencyInfo[];
  readonly buildTools: IBuildToolInfo[];
  readonly packageManagers: IPackageManagerInfo[];
}

export interface ILanguageInfo {
  readonly name: string;
  readonly fileCount: number;
  readonly linesOfCode: number;
  readonly percentage: number;
  readonly extensions: string[];
}

export interface IFrameworkInfo {
  readonly name: string;
  readonly version?: string;
  readonly type: 'frontend' | 'backend' | 'testing' | 'build' | 'other';
  readonly confidence: number;
}

export interface IDependencyInfo {
  readonly name: string;
  readonly version: string;
  readonly type: 'production' | 'development' | 'peer' | 'optional';
  readonly isExternal: boolean;
}

export interface IBuildToolInfo {
  readonly name: string;
  readonly configFiles: string[];
  readonly scripts?: Record<string, string>;
}

export interface IPackageManagerInfo {
  readonly name: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'maven' | 'gradle' | 'other';
  readonly lockFile?: string;
  readonly configFile?: string;
}

export interface IDependencyGraph {
  readonly nodes: IDependencyNode[];
  readonly edges: IDependencyEdge[];
  readonly circularDependencies: ICircularDependency[];
  readonly metrics: IDependencyMetrics;
}

export interface IDependencyNode {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly type: 'internal' | 'external' | 'builtin';
  readonly language: string;
}

export interface IDependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly type: 'import' | 'require' | 'dynamic' | 'inherit';
  readonly line?: number;
  readonly column?: number;
}

export interface ICircularDependency {
  readonly cycle: string[];
  readonly length: number;
  readonly severity: 'low' | 'medium' | 'high';
}

export interface IDependencyMetrics {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly maxDepth: number;
  readonly averageDegree: number;
  readonly circularCount: number;
}

export interface ICodeMetrics {
  readonly files: IFileMetrics[];
  readonly aggregate: IAggregateMetrics;
  readonly hotspots: IHotspot[];
}

export interface IFileMetrics {
  readonly filePath: string;
  readonly complexity: IComplexityMetrics;
  readonly maintainability: IMaintainabilityMetrics;
  readonly size: ISizeMetrics;
  readonly functions: IFunctionMetrics[];
}

export interface IComplexityMetrics {
  readonly cyclomatic: number;
  readonly cognitive: number;
  readonly halstead: IHalsteadMetrics;
}

export interface IHalsteadMetrics {
  readonly vocabulary: number;
  readonly length: number;
  readonly difficulty: number;
  readonly volume: number;
  readonly effort: number;
  readonly bugs: number;
  readonly time: number;
}

export interface IMaintainabilityMetrics {
  readonly index: number;
  readonly rank: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly techDebt: number; // minutes
}

export interface ISizeMetrics {
  readonly linesOfCode: number;
  readonly physicalLines: number;
  readonly commentLines: number;
  readonly emptyLines: number;
}

export interface IFunctionMetrics {
  readonly name: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly complexity: number;
  readonly parameters: number;
  readonly variables: number;
}

export interface IAggregateMetrics {
  readonly totalFiles: number;
  readonly totalLines: number;
  readonly averageComplexity: number;
  readonly averageMaintainability: number;
  readonly techDebtHours: number;
}

export interface IHotspot {
  readonly filePath: string;
  readonly score: number;
  readonly reason: string;
  readonly complexity: number;
  readonly changeFrequency: number;
}

export interface IArchitecturePattern {
  readonly name: string;
  readonly type: 'architectural' | 'design' | 'creational' | 'structural' | 'behavioral';
  readonly confidence: number;
  readonly description: string;
  readonly files: string[];
  readonly evidence: IPatternEvidence[];
}

export interface IPatternEvidence {
  readonly type: string;
  readonly location: string;
  readonly description: string;
  readonly confidence: number;
}

export interface IAnalysisResult {
  readonly projectPath: string;
  readonly structure: IProjectStructure;
  readonly techStack: ITechStack;
  readonly dependencies: IDependencyGraph;
  readonly metrics: ICodeMetrics;
  readonly patterns: IArchitecturePattern[];
  readonly summary: IAnalysisSummary;
  readonly generatedAt: Date;
  readonly analysisTime: number; // milliseconds
}

export interface IAnalysisSummary {
  readonly overview: string;
  readonly strengths: string[];
  readonly recommendations: string[];
  readonly technicalDebt: string[];
  readonly riskAreas: string[];
}

export interface IVisualizationResult {
  readonly format: 'mermaid' | 'plantuml' | 'dot';
  readonly diagramType: 'component' | 'dependency' | 'layered' | 'class';
  readonly content: string;
  readonly metadata: IVisualizationMetadata;
}

export interface IVisualizationMetadata {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly maxDepth: number;
  readonly generatedAt: Date;
}

export interface IAnalysisOptions {
  readonly depth?: number;
  readonly includePatterns?: string[];
  readonly excludePatterns?: string[];
  readonly languages?: string[];
  readonly includeExternal?: boolean;
  readonly calculateMetrics?: boolean;
  readonly detectPatterns?: boolean;
  readonly generateDiagrams?: boolean;
}

export interface IAnalysisContext {
  readonly startTime: Date;
  readonly options: IAnalysisOptions;
  readonly cacheKey: string;
  readonly totalFiles: number;
  readonly processedFiles: number;
  readonly errors: IAnalysisError[];
}

export interface IAnalysisError {
  readonly type: 'parsing' | 'analysis' | 'filesystem' | 'dependency';
  readonly filePath: string;
  readonly message: string;
  readonly stack?: string;
  readonly timestamp: Date;
}

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface IAnalysisProgress {
  readonly status: AnalysisStatus;
  readonly progress: number; // 0-100
  readonly currentFile?: string;
  readonly message?: string;
  readonly errors: IAnalysisError[];
}