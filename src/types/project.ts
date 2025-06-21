/**
 * Project-related types for the analysis system
 */

// Forward declarations to avoid circular dependencies
export interface IComplexityMetrics {
  readonly cyclomatic: number;
  readonly cognitive: number;
  readonly halstead: {
    readonly vocabulary: number;
    readonly length: number;
    readonly difficulty: number;
    readonly volume: number;
    readonly effort: number;
    readonly bugs: number;
    readonly time: number;
  };
}

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

export interface IArchitecturePattern {
  readonly name: string;
  readonly type: 'architectural' | 'design' | 'creational' | 'structural' | 'behavioral';
  readonly confidence: number;
  readonly description: string;
  readonly files: string[];
  readonly evidence: Array<{
    readonly type: string;
    readonly location: string;
    readonly description: string;
    readonly confidence: number;
  }>;
}

export interface IProject {
  readonly path: string;
  readonly name: string;
  readonly type: ProjectType;
  readonly configuration: IProjectConfiguration;
  readonly metadata: IProjectMetadata;
}

export type ProjectType = 
  | 'nodejs' 
  | 'python' 
  | 'java' 
  | 'maven' 
  | 'gradle' 
  | 'monorepo' 
  | 'unknown';

export interface IProjectConfiguration {
  packageManager?: string;
  buildTool?: string;
  configFiles: string[];
  entryPoints: string[];
  sourceDirectories: string[];
  testDirectories: string[];
  buildDirectories: string[];
}

export interface IProjectMetadata {
  readonly size: number;
  readonly fileCount: number;
  readonly lastModified: Date;
  readonly gitRepository?: IGitInfo;
  readonly license?: string;
  readonly description?: string;
  readonly version?: string;
  readonly authors?: string[];
}

export interface IGitInfo {
  readonly remoteUrl?: string;
  readonly branch: string;
  readonly lastCommit: string;
  readonly lastCommitDate: Date;
  readonly isDirty: boolean;
}

export interface IFileInfo {
  readonly path: string;
  readonly relativePath: string;
  readonly name: string;
  readonly extension: string;
  readonly size: number;
  readonly language?: string;
  readonly encoding: string;
  readonly lastModified: Date;
  readonly permissions: string;
  readonly isSymlink: boolean;
}

export interface IDirectoryInfo {
  readonly path: string;
  readonly relativePath: string;
  readonly name: string;
  readonly fileCount: number;
  readonly directoryCount: number;
  readonly totalSize: number;
  readonly lastModified: Date;
  readonly permissions: string;
}

export interface ILanguageAnalyzer {
  readonly language: string;
  readonly supportedExtensions: string[];
  readonly priority: number;
  
  analyzeFile(filePath: string): Promise<IFileAnalysis>;
  analyzeBatch(filePaths: string[]): Promise<IFileAnalysis[]>;
  extractDependencies(filePath: string): Promise<IDependency[]>;
  calculateComplexity(filePath: string): Promise<IComplexityMetrics>;
  detectPatterns?(structure: IProjectStructure): Promise<IArchitecturePattern[]>;
}

export interface IFileAnalysis {
  readonly filePath: string;
  readonly language: string;
  readonly ast?: unknown;
  readonly dependencies: IDependency[];
  readonly exports: IExport[];
  readonly imports: IImport[];
  readonly metrics: IComplexityMetrics;
  readonly functions: IFunctionInfo[];
  readonly classes: IClassInfo[];
  readonly variables: IVariableInfo[];
  readonly comments: ICommentInfo[];
  readonly analyzedAt: Date;
}

export interface IDependency {
  readonly source: string;
  readonly target: string;
  readonly type: DependencyType;
  readonly isResolved: boolean;
  readonly resolvedPath?: string;
  readonly isExternal: boolean;
  readonly version?: string;
  readonly location: ISourceLocation;
}

export type DependencyType = 
  | 'import' 
  | 'require' 
  | 'dynamic-import' 
  | 'inherit' 
  | 'implement' 
  | 'compose' 
  | 'aggregate';

export interface IExport {
  readonly name: string;
  readonly type: ExportType;
  readonly isDefault: boolean;
  readonly location: ISourceLocation;
  readonly documentation?: string;
}

export type ExportType = 
  | 'function' 
  | 'class' 
  | 'variable' 
  | 'constant' 
  | 'type' 
  | 'interface' 
  | 'namespace';

export interface IImport {
  readonly source: string;
  readonly imported: string[];
  readonly isNamespace: boolean;
  readonly alias?: string;
  readonly location: ISourceLocation;
}

export interface ISourceLocation {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface IFunctionInfo {
  readonly name: string;
  readonly parameters: IParameterInfo[];
  readonly returnType?: string;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly visibility: 'public' | 'private' | 'protected';
  readonly location: ISourceLocation;
  readonly complexity: number;
  readonly documentation?: string;
}

export interface IParameterInfo {
  readonly name: string;
  readonly type?: string;
  readonly isOptional: boolean;
  readonly defaultValue?: string;
}

export interface IClassInfo {
  readonly name: string;
  readonly superClass?: string;
  readonly interfaces: string[];
  readonly methods: IMethodInfo[];
  readonly properties: IPropertyInfo[];
  readonly visibility: 'public' | 'private' | 'protected';
  readonly isAbstract: boolean;
  readonly location: ISourceLocation;
  readonly documentation?: string;
}

export interface IMethodInfo {
  readonly name: string;
  readonly parameters: IParameterInfo[];
  readonly returnType?: string;
  readonly isStatic: boolean;
  readonly isAsync: boolean;
  readonly visibility: 'public' | 'private' | 'protected';
  readonly location: ISourceLocation;
  readonly complexity: number;
  readonly documentation?: string;
}

export interface IPropertyInfo {
  readonly name: string;
  readonly type?: string;
  readonly isStatic: boolean;
  readonly isReadonly: boolean;
  readonly visibility: 'public' | 'private' | 'protected';
  readonly location: ISourceLocation;
  readonly defaultValue?: string;
  readonly documentation?: string;
}

export interface IVariableInfo {
  readonly name: string;
  readonly type?: string;
  readonly scope: VariableScope;
  readonly isConstant: boolean;
  readonly location: ISourceLocation;
  readonly documentation?: string;
}

export type VariableScope = 'global' | 'module' | 'function' | 'block' | 'class';

export interface ICommentInfo {
  readonly content: string;
  readonly type: 'line' | 'block' | 'doc';
  readonly location: ISourceLocation;
}

export interface IParser {
  readonly language: string;
  parse(content: string): Promise<unknown>;
  parseFile(filePath: string): Promise<unknown>;
  isSupported(filePath: string): boolean;
}

// Configuration interfaces
export interface IAnalysisConfig {
  readonly global: IGlobalConfig;
  readonly languages: Record<string, ILanguageConfig>;
  readonly patterns: IPatternConfig;
  readonly visualization: IVisualizationConfig;
  readonly cache: ICacheConfig;
  readonly security: ISecurityConfig;
}

export interface IGlobalConfig {
  readonly maxFileSize: number;
  readonly maxFileCount: number;
  readonly timeout: number;
  readonly concurrency: number;
  readonly excludePatterns: string[];
  readonly includePatterns: string[];
}

export interface ILanguageConfig {
  readonly enabled: boolean;
  readonly extensions: string[];
  readonly parser: string;
  readonly excludePatterns?: string[];
  readonly customRules?: Record<string, unknown>;
}

export interface IPatternConfig {
  readonly enabled: boolean;
  readonly architectural: string[];
  readonly design: string[];
  readonly confidence: number;
}

export interface IVisualizationConfig {
  readonly maxNodes: number;
  readonly maxEdges: number;
  readonly defaultFormat: 'mermaid' | 'plantuml' | 'dot';
  readonly themes: Record<string, unknown>;
}

export interface ICacheConfig {
  readonly enabled: boolean;
  readonly ttl: number;
  readonly maxSize: number;
  readonly directory: string;
}

export interface ISecurityConfig {
  readonly allowedPaths: string[];
  readonly blockedPaths: string[];
  readonly maxTraversalDepth: number;
  readonly sandboxEnabled: boolean;
}