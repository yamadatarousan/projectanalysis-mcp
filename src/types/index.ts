/**
 * Central type definitions export
 */

// Analysis types
export type {
  IProjectStructure,
  ITechStack,
  ILanguageInfo,
  IFrameworkInfo,
  IDependencyInfo,
  IBuildToolInfo,
  IPackageManagerInfo,
  IDependencyGraph,
  IDependencyNode,
  IDependencyEdge,
  ICircularDependency,
  IDependencyMetrics,
  ICodeMetrics,
  IFileMetrics,
  IComplexityMetrics,
  IHalsteadMetrics,
  IMaintainabilityMetrics,
  ISizeMetrics,
  IFunctionMetrics,
  IAggregateMetrics,
  IHotspot,
  IArchitecturePattern,
  IPatternEvidence,
  IAnalysisResult,
  IAnalysisSummary,
  IVisualizationResult,
  IVisualizationMetadata,
  IAnalysisOptions,
  IAnalysisContext,
  IAnalysisError,
  AnalysisStatus,
  IAnalysisProgress
} from './analysis.js';

// Project types
export type {
  IProject,
  ProjectType,
  IProjectConfiguration,
  IProjectMetadata,
  IGitInfo,
  IFileInfo,
  IDirectoryInfo,
  ILanguageAnalyzer,
  IFileAnalysis,
  IDependency,
  DependencyType,
  IExport,
  ExportType,
  IImport,
  ISourceLocation,
  IFunctionInfo,
  IParameterInfo,
  IClassInfo,
  IMethodInfo,
  IPropertyInfo,
  IVariableInfo,
  VariableScope,
  ICommentInfo,
  IParser,
  IAnalysisConfig,
  IGlobalConfig,
  ILanguageConfig,
  IPatternConfig,
  IVisualizationConfig,
  ICacheConfig,
  ISecurityConfig
} from './project.js';

// File utilities
export type { IFileSearchOptions } from '../utils/file-utils.js';

// MCP types
export type {
  IMCPTool,
  IMCPToolResult,
  IMCPError,
  IMCPMetadata,
  IMCPResource,
  IMCPResourceContent,
  IAnalyzeProjectParams,
  IGenerateDiagramParams,
  IAnalyzeDependenciesParams,
  ITraceImpactParams,
  IDetectPatternsParams,
  IAnalyzeProjectResult,
  IGenerateDiagramResult,
  IAnalyzeDependenciesResult,
  IDependencySummary,
  ITraceImpactResult,
  IImpactedFile,
  IImpactSummary,
  IDetectPatternsResult,
  IPatternSummary,
  IMCPServer,
  IMCPRequest,
  IMCPResponse
} from './mcp.js';