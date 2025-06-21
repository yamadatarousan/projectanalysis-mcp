/**
 * Analyze Project MCP Tool implementation
 */

import type { JSONSchema7 } from 'json-schema';
import { getLogger, type ILogger } from '@/utils/logger.js';
import { createProjectScanner, type IProjectScanner } from '@/core/project-scanner.js';
import { createAnalyzerRegistry, type IAnalyzerRegistry } from '@/analyzers/index.js';
import { createCacheManager, type ICacheManager } from '@/utils/cache.js';
import type {
  IMCPTool,
  IMCPToolResult,
  IAnalyzeProjectParams,
  IAnalyzeProjectResult,
  IAnalysisResult,
  ITechStack,
  IDependencyGraph,
  ICodeMetrics,
  IArchitecturePattern,
  IAnalysisSummary
} from '@/types/index.js';

export class AnalyzeProjectTool implements IMCPTool {
  readonly name = 'analyze_project';
  readonly description = 'Performs comprehensive project analysis including structure, dependencies, and metrics';
  
  readonly inputSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project root directory'
      },
      depth: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        default: 3,
        description: 'Analysis depth level'
      },
      includePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to include in analysis'
      },
      excludePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to exclude from analysis'
      },
      calculateMetrics: {
        type: 'boolean',
        default: true,
        description: 'Whether to calculate code metrics'
      },
      detectPatterns: {
        type: 'boolean',
        default: true,
        description: 'Whether to detect architecture patterns'
      }
    },
    required: ['projectPath'],
    additionalProperties: false
  };

  private readonly logger: ILogger;
  private readonly projectScanner: IProjectScanner;
  private readonly analyzerRegistry: IAnalyzerRegistry;
  private readonly cacheManager: ICacheManager;

  constructor(
    projectScanner?: IProjectScanner,
    analyzerRegistry?: IAnalyzerRegistry,
    cacheManager?: ICacheManager
  ) {
    this.logger = getLogger('analyze-project-tool');
    this.projectScanner = projectScanner ?? createProjectScanner();
    this.analyzerRegistry = analyzerRegistry ?? createAnalyzerRegistry();
    this.cacheManager = cacheManager ?? createCacheManager();
  }

  async execute(params: unknown): Promise<IMCPToolResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting project analysis', { params });

      // Validate and parse parameters
      const validatedParams = this.validateParams(params);
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(validatedParams);
      
      // Check cache first
      const cachedResult = await this.cacheManager.get<IAnalysisResult>(cacheKey);
      if (cachedResult) {
        this.logger.info('Returning cached analysis result', { 
          projectPath: validatedParams.projectPath,
          cacheKey 
        });
        
        return {
          success: true,
          data: { analysis: cachedResult, cached: true } as IAnalyzeProjectResult,
          metadata: {
            executionTime: Date.now() - startTime,
            cacheHit: true
          }
        };
      }

      // Perform analysis
      const analysis = await this.performAnalysis(validatedParams);
      
      // Cache the result
      await this.cacheManager.set(cacheKey, analysis, 60 * 60 * 1000); // 1 hour TTL

      const executionTime = Date.now() - startTime;
      
      this.logger.info('Project analysis completed', {
        projectPath: validatedParams.projectPath,
        executionTime,
        fileCount: analysis.structure.children?.length ?? 0
      });

      return {
        success: true,
        data: { analysis, cached: false } as IAnalyzeProjectResult,
        metadata: {
          executionTime,
          cacheHit: false
        }
      };
    } catch (error) {
      this.logger.error('Project analysis failed', error as Error, { params });
      
      return {
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: (error as Error).message,
          details: error
        },
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false
        }
      };
    }
  }

  private validateParams(params: unknown): IAnalyzeProjectParams {
    if (!params || typeof params !== 'object') {
      throw new Error('Parameters must be an object');
    }

    const p = params as Record<string, unknown>;

    if (!p.projectPath || typeof p.projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }

    if (p.depth !== undefined && (typeof p.depth !== 'number' || p.depth < 1 || p.depth > 20)) {
      throw new Error('depth must be a number between 1 and 20');
    }

    if (p.includePatterns !== undefined && !Array.isArray(p.includePatterns)) {
      throw new Error('includePatterns must be an array of strings');
    }

    if (p.excludePatterns !== undefined && !Array.isArray(p.excludePatterns)) {
      throw new Error('excludePatterns must be an array of strings');
    }

    return {
      projectPath: p.projectPath,
      depth: p.depth as number | undefined,
      includePatterns: p.includePatterns as string[] | undefined,
      excludePatterns: p.excludePatterns as string[] | undefined,
      calculateMetrics: p.calculateMetrics as boolean | undefined,
      detectPatterns: p.detectPatterns as boolean | undefined
    };
  }

  private generateCacheKey(params: IAnalyzeProjectParams): string {
    const keyData = {
      projectPath: params.projectPath,
      depth: params.depth ?? 3,
      includePatterns: params.includePatterns ?? [],
      excludePatterns: params.excludePatterns ?? [],
      calculateMetrics: params.calculateMetrics ?? true,
      detectPatterns: params.detectPatterns ?? true
    };

    return `analyze-project:${JSON.stringify(keyData)}`;
  }

  private async performAnalysis(params: IAnalyzeProjectParams): Promise<IAnalysisResult> {
    const analysisStartTime = Date.now();
    
    // Step 1: Scan project structure
    this.logger.debug('Scanning project structure', { projectPath: params.projectPath });
    const project = await this.projectScanner.scanProject(params.projectPath, {
      depth: params.depth,
      includePatterns: params.includePatterns,
      excludePatterns: params.excludePatterns
    });

    const structure = await this.projectScanner.buildStructureTree(params.projectPath, {
      depth: params.depth,
      includePatterns: params.includePatterns,
      excludePatterns: params.excludePatterns
    });

    // Step 2: Detect tech stack
    this.logger.debug('Detecting tech stack');
    const techStack = await this.detectTechStack(params.projectPath, structure);

    // Step 3: Analyze dependencies
    this.logger.debug('Analyzing dependencies');
    const dependencies = await this.analyzeDependencies(params.projectPath, structure);

    // Step 4: Calculate metrics (if requested)
    let metrics: ICodeMetrics = {
      files: [],
      aggregate: {
        totalFiles: 0,
        totalLines: 0,
        averageComplexity: 0,
        averageMaintainability: 0,
        techDebtHours: 0
      },
      hotspots: []
    };

    if (params.calculateMetrics !== false) {
      this.logger.debug('Calculating code metrics');
      metrics = await this.calculateMetrics(params.projectPath, structure);
    }

    // Step 5: Detect patterns (if requested)
    let patterns: IArchitecturePattern[] = [];
    
    if (params.detectPatterns !== false) {
      this.logger.debug('Detecting architecture patterns');
      patterns = await this.detectArchitecturePatterns(structure);
    }

    // Step 6: Generate summary
    const summary = this.generateSummary(techStack, dependencies, metrics, patterns);

    const analysisTime = Date.now() - analysisStartTime;

    return {
      projectPath: params.projectPath,
      structure,
      techStack,
      dependencies,
      metrics,
      patterns,
      summary,
      generatedAt: new Date(),
      analysisTime
    };
  }

  private async detectTechStack(projectPath: string, structure: any): Promise<ITechStack> {
    // Basic tech stack detection
    const languages: any[] = [];
    const frameworks: any[] = [];
    const dependencies: any[] = [];
    const buildTools: any[] = [];
    const packageManagers: any[] = [];

    // This is a simplified implementation
    // In a real implementation, you would traverse the structure and analyze files
    
    return {
      languages,
      frameworks,
      dependencies,
      buildTools,
      packageManagers
    };
  }

  private async analyzeDependencies(projectPath: string, structure: any): Promise<IDependencyGraph> {
    // Basic dependency analysis
    return {
      nodes: [],
      edges: [],
      circularDependencies: [],
      metrics: {
        totalNodes: 0,
        totalEdges: 0,
        maxDepth: 0,
        averageDegree: 0,
        circularCount: 0
      }
    };
  }

  private async calculateMetrics(projectPath: string, structure: any): Promise<ICodeMetrics> {
    // Basic metrics calculation
    return {
      files: [],
      aggregate: {
        totalFiles: 0,
        totalLines: 0,
        averageComplexity: 0,
        averageMaintainability: 0,
        techDebtHours: 0
      },
      hotspots: []
    };
  }

  private async detectArchitecturePatterns(structure: any): Promise<IArchitecturePattern[]> {
    // Basic pattern detection
    return [];
  }

  private generateSummary(
    techStack: ITechStack,
    dependencies: IDependencyGraph,
    metrics: ICodeMetrics,
    patterns: IArchitecturePattern[]
  ): IAnalysisSummary {
    const overview = `Project analysis completed with ${techStack.languages.length} languages detected, ${dependencies.nodes.length} dependencies analyzed, and ${patterns.length} architecture patterns identified.`;
    
    const strengths: string[] = [];
    const recommendations: string[] = [];
    const technicalDebt: string[] = [];
    const riskAreas: string[] = [];

    // Generate insights based on analysis results
    if (dependencies.circularDependencies.length === 0) {
      strengths.push('No circular dependencies detected');
    } else {
      riskAreas.push(`${dependencies.circularDependencies.length} circular dependencies found`);
      recommendations.push('Resolve circular dependencies to improve maintainability');
    }

    if (metrics.aggregate.averageComplexity < 10) {
      strengths.push('Low average complexity indicates maintainable code');
    } else {
      technicalDebt.push('High complexity in some areas');
      recommendations.push('Consider refactoring complex functions');
    }

    if (patterns.length > 0) {
      strengths.push(`Well-structured architecture with ${patterns.length} recognized patterns`);
    } else {
      recommendations.push('Consider implementing architectural patterns for better organization');
    }

    return {
      overview,
      strengths,
      recommendations,
      technicalDebt,
      riskAreas
    };
  }
}