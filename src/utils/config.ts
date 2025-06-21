/**
 * Configuration management system
 */

import fs from 'fs/promises';
import path from 'path';
import { cosmiconfigSync } from 'cosmiconfig';
import { getLogger, type ILogger } from './logger.js';
import type { IAnalysisConfig } from '@/types/project.js';

export interface IConfigManager {
  loadConfig(projectPath?: string): Promise<IAnalysisConfig>;
  getDefaultConfig(): IAnalysisConfig;
  validateConfig(config: unknown): ValidationResult<IAnalysisConfig>;
  mergeConfigs(configs: Partial<IAnalysisConfig>[]): IAnalysisConfig;
}

export interface ValidationResult<T> {
  readonly isValid: boolean;
  readonly data?: T;
  readonly errors?: string[];
}

export class ConfigManager implements IConfigManager {
  private readonly logger: ILogger;
  private readonly explorer: ReturnType<typeof cosmiconfigSync>;
  private cachedConfig?: IAnalysisConfig;

  constructor() {
    this.logger = getLogger('config');
    this.explorer = cosmiconfigSync('projectanalysis', {
      searchPlaces: [
        'package.json',
        '.projectanalysisrc',
        '.projectanalysisrc.json',
        '.projectanalysisrc.js',
        'projectanalysis.config.js',
        'projectanalysis.config.json'
      ]
    });
  }

  async loadConfig(projectPath?: string): Promise<IAnalysisConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const configs: Partial<IAnalysisConfig>[] = [];

    // 1. Default configuration
    configs.push(this.getDefaultConfig());

    // 2. Global user configuration
    try {
      const globalConfig = await this.loadGlobalConfig();
      if (globalConfig) {
        configs.push(globalConfig);
      }
    } catch (error) {
      this.logger.debug('No global config found', { error });
    }

    // 3. Project-specific configuration
    if (projectPath) {
      try {
        const projectConfig = await this.loadProjectConfig(projectPath);
        if (projectConfig) {
          configs.push(projectConfig);
        }
      } catch (error) {
        this.logger.debug('No project config found', { projectPath, error });
      }
    }

    // 4. Environment variables
    const envConfig = this.loadEnvironmentConfig();
    if (envConfig) {
      configs.push(envConfig);
    }

    const mergedConfig = this.mergeConfigs(configs);
    const validation = this.validateConfig(mergedConfig);

    if (!validation.isValid) {
      this.logger.warn('Configuration validation failed', {
        errors: validation.errors
      });
      // Fall back to default config
      this.cachedConfig = this.getDefaultConfig();
    } else {
      this.cachedConfig = validation.data!;
    }

    this.logger.info('Configuration loaded', {
      projectPath,
      configSources: configs.length
    });

    return this.cachedConfig;
  }

  getDefaultConfig(): IAnalysisConfig {
    return {
      global: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFileCount: 10000,
        timeout: 5 * 60 * 1000, // 5 minutes
        concurrency: 4,
        excludePatterns: [
          'node_modules/**',
          '.git/**',
          'dist/**',
          'build/**',
          '.cache/**',
          'coverage/**',
          '.nyc_output/**',
          'logs/**',
          '*.log'
        ],
        includePatterns: ['**/*']
      },
      languages: {
        javascript: {
          enabled: true,
          extensions: ['.js', '.jsx', '.mjs', '.cjs'],
          parser: 'tree-sitter-javascript'
        },
        typescript: {
          enabled: true,
          extensions: ['.ts', '.tsx'],
          parser: 'tree-sitter-typescript'
        },
        python: {
          enabled: true,
          extensions: ['.py', '.pyx', '.pyi'],
          parser: 'tree-sitter-python'
        },
        java: {
          enabled: true,
          extensions: ['.java'],
          parser: 'tree-sitter-java'
        }
      },
      patterns: {
        enabled: true,
        architectural: ['mvc', 'mvp', 'mvvm', 'layered', 'microservices', 'component'],
        design: ['singleton', 'factory', 'observer', 'strategy', 'decorator'],
        confidence: 0.7
      },
      visualization: {
        maxNodes: 50,
        maxEdges: 200,
        defaultFormat: 'mermaid',
        themes: {
          default: {
            primaryColor: '#1f2937',
            secondaryColor: '#6b7280',
            accentColor: '#3b82f6'
          }
        }
      },
      cache: {
        enabled: true,
        ttl: 60 * 60 * 1000, // 1 hour
        maxSize: 100,
        directory: './.cache'
      },
      security: {
        allowedPaths: [process.cwd()],
        blockedPaths: ['/etc', '/usr', '/bin', '/sbin'],
        maxTraversalDepth: 10,
        sandboxEnabled: true
      }
    };
  }

  validateConfig(config: unknown): ValidationResult<IAnalysisConfig> {
    const errors: string[] = [];

    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        errors: ['Configuration must be an object']
      };
    }

    const cfg = config as Record<string, unknown>;

    // Validate global config
    if (!cfg.global || typeof cfg.global !== 'object') {
      errors.push('global configuration is required');
    } else {
      const global = cfg.global as Record<string, unknown>;
      if (typeof global.maxFileSize !== 'number' || global.maxFileSize <= 0) {
        errors.push('global.maxFileSize must be a positive number');
      }
      if (typeof global.maxFileCount !== 'number' || global.maxFileCount <= 0) {
        errors.push('global.maxFileCount must be a positive number');
      }
      if (typeof global.timeout !== 'number' || global.timeout <= 0) {
        errors.push('global.timeout must be a positive number');
      }
    }

    // Validate languages config
    if (!cfg.languages || typeof cfg.languages !== 'object') {
      errors.push('languages configuration is required');
    } else {
      const languages = cfg.languages as Record<string, unknown>;
      for (const [lang, langConfig] of Object.entries(languages)) {
        if (!langConfig || typeof langConfig !== 'object') {
          errors.push(`languages.${lang} must be an object`);
          continue;
        }
        const lc = langConfig as Record<string, unknown>;
        if (typeof lc.enabled !== 'boolean') {
          errors.push(`languages.${lang}.enabled must be a boolean`);
        }
        if (!Array.isArray(lc.extensions)) {
          errors.push(`languages.${lang}.extensions must be an array`);
        }
      }
    }

    // Validate visualization config
    if (cfg.visualization && typeof cfg.visualization === 'object') {
      const viz = cfg.visualization as Record<string, unknown>;
      if (typeof viz.maxNodes !== 'number' || viz.maxNodes <= 0) {
        errors.push('visualization.maxNodes must be a positive number');
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return { isValid: true, data: config as IAnalysisConfig };
  }

  mergeConfigs(configs: Partial<IAnalysisConfig>[]): IAnalysisConfig {
    let merged = {} as IAnalysisConfig;

    for (const config of configs) {
      merged = this.deepMerge(merged, config) as IAnalysisConfig;
    }

    return merged;
  }

  private async loadGlobalConfig(): Promise<Partial<IAnalysisConfig> | null> {
    const configPaths = [
      path.join(process.env.HOME ?? '', '.config', 'projectanalysis-mcp', 'config.json'),
      path.join(process.env.HOME ?? '', '.projectanalysisrc'),
      path.join(process.env.HOME ?? '', '.projectanalysisrc.json')
    ];

    for (const configPath of configPaths) {
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(content);
        this.logger.debug('Global config loaded', { configPath });
        return config;
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  private async loadProjectConfig(projectPath: string): Promise<Partial<IAnalysisConfig> | null> {
    try {
      const result = this.explorer.search(projectPath);
      if (result && result.config) {
        this.logger.debug('Project config loaded', { 
          configPath: result.filepath,
          projectPath 
        });
        return result.config;
      }
    } catch (error) {
      this.logger.debug('Failed to load project config', { projectPath, error });
    }

    return null;
  }

  private loadEnvironmentConfig(): Partial<IAnalysisConfig> | null {
    const envConfig: Partial<IAnalysisConfig> = {};
    let hasEnvConfig = false;

    // Check for environment variables
    if (process.env['PA_MAX_FILE_SIZE']) {
      (envConfig as any).global = {
        ...envConfig.global,
        maxFileSize: parseInt(process.env['PA_MAX_FILE_SIZE'], 10)
      };
      hasEnvConfig = true;
    }

    if (process.env['PA_CACHE_ENABLED']) {
      (envConfig as any).cache = {
        ...envConfig.cache,
        enabled: process.env['PA_CACHE_ENABLED'] === 'true'
      };
      hasEnvConfig = true;
    }

    if (process.env.PA_LOG_LEVEL) {
      // Log level handling would go here
      hasEnvConfig = true;
    }

    return hasEnvConfig ? envConfig : null;
  }

  private deepMerge(target: unknown, source: unknown): unknown {
    if (!source || typeof source !== 'object') {
      return target;
    }

    if (!target || typeof target !== 'object') {
      return source;
    }

    const result = { ...target } as Record<string, unknown>;
    const src = source as Record<string, unknown>;

    for (const key in src) {
      if (src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
        result[key] = this.deepMerge(result[key], src[key]);
      } else {
        result[key] = src[key];
      }
    }

    return result;
  }
}

// Factory function
export function createConfigManager(): IConfigManager {
  return new ConfigManager();
}