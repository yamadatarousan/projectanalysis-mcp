/**
 * Project structure scanning and analysis
 */

import path from 'path';
import { getLogger, type ILogger } from '@/utils/logger.js';
import { createFileUtils, type IFileUtils } from '@/utils/file-utils.js';
import type { 
  IProjectStructure, 
  IProject, 
  ProjectType, 
  IProjectConfiguration,
  IProjectMetadata,
  ILanguageAnalyzer,
  IFileAnalysis,
  IAnalysisOptions,
  IGitInfo
} from '@/types/index.js';

export interface IProjectScanner {
  scanProject(projectPath: string, options?: IAnalysisOptions): Promise<IProject>;
  buildStructureTree(projectPath: string, options?: IAnalysisOptions): Promise<IProjectStructure>;
  detectProjectType(projectPath: string): Promise<ProjectType>;
  getProjectConfiguration(projectPath: string, projectType: ProjectType): Promise<IProjectConfiguration>;
  getProjectMetadata(projectPath: string): Promise<IProjectMetadata>;
}

export class ProjectScanner implements IProjectScanner {
  private readonly logger: ILogger;
  private readonly fileUtils: IFileUtils;
  private readonly analyzers: Map<string, ILanguageAnalyzer>;

  constructor(
    fileUtils?: IFileUtils,
    analyzers: Map<string, ILanguageAnalyzer> = new Map()
  ) {
    this.logger = getLogger('project-scanner');
    this.fileUtils = fileUtils ?? createFileUtils();
    this.analyzers = analyzers;
  }

  async scanProject(projectPath: string, options: IAnalysisOptions = {}): Promise<IProject> {
    this.logger.info('Starting project scan', { projectPath });
    
    const startTime = Date.now();

    try {
      // Validate project path
      const validation = await this.fileUtils.validatePath(projectPath);
      if (!validation.isValid) {
        throw new Error(`Invalid project path: ${validation.error}`);
      }

      const normalizedPath = validation.normalizedPath!;

      // Check if directory exists
      if (!(await this.fileUtils.isDirectory(normalizedPath))) {
        throw new Error(`Project path is not a directory: ${normalizedPath}`);
      }

      // Detect project type first
      const projectType = await this.detectProjectType(normalizedPath);
      this.logger.debug('Project type detected', { projectType });

      // Get project configuration and metadata in parallel
      const [configuration, metadata] = await Promise.all([
        this.getProjectConfiguration(normalizedPath, projectType),
        this.getProjectMetadata(normalizedPath)
      ]);

      const project: IProject = {
        path: normalizedPath,
        name: path.basename(normalizedPath),
        type: projectType,
        configuration,
        metadata
      };

      const duration = Date.now() - startTime;
      this.logger.info('Project scan completed', { 
        projectPath: normalizedPath,
        projectType,
        duration,
        fileCount: metadata.fileCount
      });

      return project;
    } catch (error) {
      this.logger.error('Project scan failed', error as Error, { projectPath });
      throw error;
    }
  }

  async buildStructureTree(
    projectPath: string, 
    options: IAnalysisOptions = {}
  ): Promise<IProjectStructure> {
    this.logger.debug('Building structure tree', { projectPath });

    const validation = await this.fileUtils.validatePath(projectPath);
    if (!validation.isValid) {
      throw new Error(`Invalid project path: ${validation.error}`);
    }

    const normalizedPath = validation.normalizedPath!;

    try {
      const structure = await this.buildStructureRecursive(normalizedPath, options);
      
      this.logger.debug('Structure tree built', { 
        projectPath: normalizedPath,
        totalNodes: this.countNodes(structure)
      });

      return structure;
    } catch (error) {
      this.logger.error('Failed to build structure tree', error as Error, { projectPath });
      throw error;
    }
  }

  async detectProjectType(projectPath: string): Promise<ProjectType> {
    try {
      // Check for specific project files
      const indicators = [
        { file: 'package.json', type: 'nodejs' as ProjectType },
        { file: 'requirements.txt', type: 'python' as ProjectType },
        { file: 'pyproject.toml', type: 'python' as ProjectType },
        { file: 'pom.xml', type: 'maven' as ProjectType },
        { file: 'build.gradle', type: 'gradle' as ProjectType },
        { file: 'build.gradle.kts', type: 'gradle' as ProjectType },
        { file: 'lerna.json', type: 'monorepo' as ProjectType },
        { file: 'nx.json', type: 'monorepo' as ProjectType },
        { file: 'rush.json', type: 'monorepo' as ProjectType }
      ];

      for (const indicator of indicators) {
        const filePath = path.join(projectPath, indicator.file);
        if (await this.fileUtils.exists(filePath)) {
          this.logger.debug('Project type indicator found', { 
            file: indicator.file, 
            type: indicator.type 
          });
          return indicator.type;
        }
      }

      // Check for Java files without build tools
      const files = await this.fileUtils.getAllFiles(projectPath, {
        includePatterns: ['**/*.java'],
        maxDepth: 3
      });

      if (files.length > 0) {
        return 'java';
      }

      return 'unknown';
    } catch (error) {
      this.logger.warn('Failed to detect project type', { projectPath, error });
      return 'unknown';
    }
  }

  async getProjectConfiguration(
    projectPath: string, 
    projectType: ProjectType
  ): Promise<IProjectConfiguration> {
    const configuration: IProjectConfiguration = {
      configFiles: [],
      entryPoints: [],
      sourceDirectories: [],
      testDirectories: [],
      buildDirectories: []
    };

    try {
      switch (projectType) {
        case 'nodejs':
          await this.configureNodeJSProject(projectPath, configuration);
          break;
        case 'python':
          await this.configurePythonProject(projectPath, configuration);
          break;
        case 'maven':
          await this.configureMavenProject(projectPath, configuration);
          break;
        case 'gradle':
          await this.configureGradleProject(projectPath, configuration);
          break;
        case 'java':
          await this.configureJavaProject(projectPath, configuration);
          break;
        case 'monorepo':
          await this.configureMonorepoProject(projectPath, configuration);
          break;
        default:
          await this.configureGenericProject(projectPath, configuration);
      }

      // Find all config files
      configuration.configFiles = await this.findConfigFiles(projectPath);

      return configuration;
    } catch (error) {
      this.logger.warn('Failed to get project configuration', { 
        projectPath, 
        projectType, 
        error 
      });
      return configuration;
    }
  }

  async getProjectMetadata(projectPath: string): Promise<IProjectMetadata> {
    try {
      const dirInfo = await this.fileUtils.getDirectoryInfo(projectPath);
      
      // Get Git information
      const gitInfo = await this.getGitInfo(projectPath);

      // Try to get additional metadata from package.json or similar
      const packageInfo = await this.getPackageInfo(projectPath);

      return {
        size: dirInfo.totalSize,
        fileCount: dirInfo.fileCount,
        lastModified: dirInfo.lastModified,
        gitRepository: gitInfo,
        license: packageInfo?.license,
        description: packageInfo?.description,
        version: packageInfo?.version,
        authors: packageInfo?.authors
      };
    } catch (error) {
      this.logger.warn('Failed to get project metadata', { projectPath, error });
      
      // Return minimal metadata
      return {
        size: 0,
        fileCount: 0,
        lastModified: new Date()
      };
    }
  }

  private async buildStructureRecursive(
    currentPath: string,
    options: IAnalysisOptions,
    depth = 0
  ): Promise<IProjectStructure> {
    const maxDepth = options.depth ?? 10;
    
    if (depth > maxDepth) {
      throw new Error(`Maximum depth exceeded: ${maxDepth}`);
    }

    const isDirectory = await this.fileUtils.isDirectory(currentPath);
    const name = path.basename(currentPath);

    if (isDirectory) {
      const children: IProjectStructure[] = [];
      
      try {
        const files = await this.fileUtils.getAllFiles(currentPath, {
          includePatterns: options.includePatterns ?? ['*'],
          excludePatterns: options.excludePatterns,
          maxDepth: 1
        });

        // Process immediate children only
        const immediateChildren = new Set<string>();
        for (const file of files) {
          const relativePath = path.relative(currentPath, file);
          const firstSegment = relativePath.split(path.sep)[0];
          if (firstSegment) {
            immediateChildren.add(path.join(currentPath, firstSegment));
          }
        }

        // Recursively build children
        for (const childPath of immediateChildren) {
          const child = await this.buildStructureRecursive(childPath, options, depth + 1);
          children.push(child);
        }
      } catch (error) {
        this.logger.debug('Failed to read directory', { currentPath, error });
      }

      const dirInfo = await this.fileUtils.getDirectoryInfo(currentPath);

      return {
        path: currentPath,
        name,
        type: 'directory',
        children: children.sort((a, b) => a.name.localeCompare(b.name)),
        lastModified: dirInfo.lastModified
      };
    } else {
      const fileInfo = await this.fileUtils.getFileInfo(currentPath);

      return {
        path: currentPath,
        name,
        type: 'file',
        size: fileInfo.size,
        extension: fileInfo.extension,
        language: fileInfo.language,
        lastModified: fileInfo.lastModified
      };
    }
  }

  private async configureNodeJSProject(
    projectPath: string, 
    config: IProjectConfiguration
  ): Promise<void> {
    config.packageManager = 'npm';
    
    // Check for different package managers
    if (await this.fileUtils.exists(path.join(projectPath, 'yarn.lock'))) {
      config.packageManager = 'yarn';
    } else if (await this.fileUtils.exists(path.join(projectPath, 'pnpm-lock.yaml'))) {
      config.packageManager = 'pnpm';
    }

    // Common directories
    config.sourceDirectories = ['src', 'lib', 'app'];
    config.testDirectories = ['test', 'tests', '__tests__', 'spec'];
    config.buildDirectories = ['dist', 'build', 'out'];

    // Entry points
    config.entryPoints = ['index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts'];

    // Filter existing directories
    config.sourceDirectories = await this.filterExistingDirectories(projectPath, config.sourceDirectories);
    config.testDirectories = await this.filterExistingDirectories(projectPath, config.testDirectories);
    config.buildDirectories = await this.filterExistingDirectories(projectPath, config.buildDirectories);
    config.entryPoints = await this.filterExistingFiles(projectPath, config.entryPoints);
  }

  private async configurePythonProject(
    projectPath: string, 
    config: IProjectConfiguration
  ): Promise<void> {
    config.packageManager = 'pip';
    
    config.sourceDirectories = ['src', 'lib', 'app'];
    config.testDirectories = ['tests', 'test'];
    config.buildDirectories = ['dist', 'build'];
    config.entryPoints = ['main.py', 'app.py', '__main__.py'];

    config.sourceDirectories = await this.filterExistingDirectories(projectPath, config.sourceDirectories);
    config.testDirectories = await this.filterExistingDirectories(projectPath, config.testDirectories);
    config.buildDirectories = await this.filterExistingDirectories(projectPath, config.buildDirectories);
    config.entryPoints = await this.filterExistingFiles(projectPath, config.entryPoints);
  }

  private async configureMavenProject(
    projectPath: string, 
    config: IProjectConfiguration
  ): Promise<void> {
    config.packageManager = 'maven';
    config.buildTool = 'maven';
    
    config.sourceDirectories = ['src/main/java', 'src/main/resources'];
    config.testDirectories = ['src/test/java', 'src/test/resources'];
    config.buildDirectories = ['target'];

    config.sourceDirectories = await this.filterExistingDirectories(projectPath, config.sourceDirectories);
    config.testDirectories = await this.filterExistingDirectories(projectPath, config.testDirectories);
    config.buildDirectories = await this.filterExistingDirectories(projectPath, config.buildDirectories);
  }

  private async configureGradleProject(
    projectPath: string, 
    config: IProjectConfiguration
  ): Promise<void> {
    config.packageManager = 'gradle';
    config.buildTool = 'gradle';
    
    config.sourceDirectories = ['src/main/java', 'src/main/kotlin', 'src/main/resources'];
    config.testDirectories = ['src/test/java', 'src/test/kotlin', 'src/test/resources'];
    config.buildDirectories = ['build'];

    config.sourceDirectories = await this.filterExistingDirectories(projectPath, config.sourceDirectories);
    config.testDirectories = await this.filterExistingDirectories(projectPath, config.testDirectories);
    config.buildDirectories = await this.filterExistingDirectories(projectPath, config.buildDirectories);
  }

  private async configureJavaProject(
    projectPath: string, 
    config: IProjectConfiguration
  ): Promise<void> {
    config.sourceDirectories = ['src', 'java'];
    config.testDirectories = ['test', 'tests'];
    config.buildDirectories = ['build', 'target', 'out'];

    config.sourceDirectories = await this.filterExistingDirectories(projectPath, config.sourceDirectories);
    config.testDirectories = await this.filterExistingDirectories(projectPath, config.testDirectories);
    config.buildDirectories = await this.filterExistingDirectories(projectPath, config.buildDirectories);
  }

  private async configureMonorepoProject(
    projectPath: string, 
    config: IProjectConfiguration
  ): Promise<void> {
    config.sourceDirectories = ['packages', 'apps', 'libs'];
    config.testDirectories = ['tests'];
    config.buildDirectories = ['dist', 'build'];

    config.sourceDirectories = await this.filterExistingDirectories(projectPath, config.sourceDirectories);
    config.testDirectories = await this.filterExistingDirectories(projectPath, config.testDirectories);
    config.buildDirectories = await this.filterExistingDirectories(projectPath, config.buildDirectories);
  }

  private async configureGenericProject(
    projectPath: string, 
    config: IProjectConfiguration
  ): Promise<void> {
    config.sourceDirectories = ['src', 'source', 'lib'];
    config.testDirectories = ['test', 'tests'];
    config.buildDirectories = ['build', 'dist', 'out'];

    config.sourceDirectories = await this.filterExistingDirectories(projectPath, config.sourceDirectories);
    config.testDirectories = await this.filterExistingDirectories(projectPath, config.testDirectories);
    config.buildDirectories = await this.filterExistingDirectories(projectPath, config.buildDirectories);
  }

  private async filterExistingDirectories(basePath: string, directories: string[]): Promise<string[]> {
    const existing: string[] = [];
    
    for (const dir of directories) {
      const fullPath = path.join(basePath, dir);
      if (await this.fileUtils.isDirectory(fullPath)) {
        existing.push(dir);
      }
    }
    
    return existing;
  }

  private async filterExistingFiles(basePath: string, files: string[]): Promise<string[]> {
    const existing: string[] = [];
    
    for (const file of files) {
      const fullPath = path.join(basePath, file);
      if (await this.fileUtils.isFile(fullPath)) {
        existing.push(file);
      }
    }
    
    return existing;
  }

  private async findConfigFiles(projectPath: string): Promise<string[]> {
    const configPatterns = [
      '*.json',
      '*.yml',
      '*.yaml',
      '*.toml',
      '*.ini',
      '*.conf',
      '.env*',
      '.*rc',
      '.*config.*'
    ];

    try {
      const files = await this.fileUtils.getAllFiles(projectPath, {
        includePatterns: configPatterns,
        maxDepth: 2
      });

      return files.map(file => path.relative(projectPath, file));
    } catch (error) {
      this.logger.debug('Failed to find config files', { projectPath, error });
      return [];
    }
  }

  private async getGitInfo(projectPath: string): Promise<IGitInfo | undefined> {
    try {
      const gitDir = path.join(projectPath, '.git');
      if (!(await this.fileUtils.exists(gitDir))) {
        return undefined;
      }

      // Basic Git info - in a real implementation, you'd use a Git library
      return {
        branch: 'main', // Would be detected from Git
        lastCommit: 'unknown',
        lastCommitDate: new Date(),
        isDirty: false
      };
    } catch (error) {
      this.logger.debug('Failed to get Git info', { projectPath, error });
      return undefined;
    }
  }

  private async getPackageInfo(projectPath: string): Promise<{
    license?: string;
    description?: string;
    version?: string;
    authors?: string[];
  } | undefined> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await this.fileUtils.exists(packageJsonPath)) {
        const content = await this.fileUtils.readFile(packageJsonPath);
        const packageJson = JSON.parse(content);
        
        return {
          license: packageJson.license,
          description: packageJson.description,
          version: packageJson.version,
          authors: packageJson.author ? [packageJson.author] : packageJson.contributors
        };
      }
    } catch (error) {
      this.logger.debug('Failed to get package info', { projectPath, error });
    }

    return undefined;
  }

  private countNodes(structure: IProjectStructure): number {
    let count = 1;
    if (structure.children) {
      for (const child of structure.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }
}

// Factory function
export function createProjectScanner(
  fileUtils?: IFileUtils,
  analyzers?: Map<string, ILanguageAnalyzer>
): IProjectScanner {
  return new ProjectScanner(fileUtils, analyzers);
}