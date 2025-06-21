/**
 * MCP Server implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

import { getLogger, type ILogger } from '@/utils/logger.js';
import { createConfigManager, type IConfigManager } from '@/utils/config.js';
import { createCacheManager, type ICacheManager } from '@/utils/cache.js';
import { AnalyzeProjectTool, GenerateDiagramTool } from './tools/index.js';
import type { 
  IMCPServer, 
  IMCPTool, 
  IMCPRequest, 
  IMCPResponse,
  IMCPError 
} from '@/types/mcp.js';

export class ProjectAnalysisMCPServer implements IMCPServer {
  readonly name = 'projectanalysis-mcp';
  readonly version = '0.1.0';
  
  readonly tools = new Map<string, IMCPTool>();
  readonly resources = new Map<string, any>();

  private readonly server: Server;
  private readonly logger: ILogger;
  private readonly configManager: IConfigManager;
  private readonly cacheManager: ICacheManager;

  constructor() {
    this.logger = getLogger('mcp-server');
    this.configManager = createConfigManager();
    this.cacheManager = createCacheManager();
    
    this.server = new Server(
      {
        name: this.name,
        version: this.version
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    this.setupServer();
    this.registerDefaultTools();
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Starting MCP server', { 
        name: this.name, 
        version: this.version,
        tools: Array.from(this.tools.keys())
      });

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.logger.info('MCP server started successfully');
    } catch (error) {
      this.logger.error('Failed to start MCP server', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping MCP server');
      await this.server.close();
      this.logger.info('MCP server stopped');
    } catch (error) {
      this.logger.error('Error stopping MCP server', error as Error);
      throw error;
    }
  }

  registerTool(tool: IMCPTool): void {
    this.logger.debug('Registering tool', { name: tool.name });
    this.tools.set(tool.name, tool);
    this.logger.info('Tool registered', { name: tool.name });
  }

  registerResource(resource: any): void {
    this.logger.debug('Registering resource', { name: resource.name });
    this.resources.set(resource.name, resource);
    this.logger.info('Resource registered', { name: resource.name });
  }

  async handleRequest(request: IMCPRequest): Promise<IMCPResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Handling request', { 
        id: request.id, 
        method: request.method 
      });

      let result: unknown;
      
      switch (request.method) {
        case 'tools/call':
          result = await this.handleToolCall(request);
          break;
        case 'tools/list':
          result = await this.handleListTools();
          break;
        case 'resources/list':
          result = await this.handleListResources();
          break;
        default:
          throw new Error(`Unsupported method: ${request.method}`);
      }

      const duration = Date.now() - startTime;
      
      this.logger.debug('Request handled successfully', {
        id: request.id,
        method: request.method,
        duration
      });

      return {
        id: request.id,
        result
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Request handling failed', error as Error, {
        id: request.id,
        method: request.method,
        duration
      });

      const mcpError: IMCPError = {
        code: 'REQUEST_FAILED',
        message: (error as Error).message,
        details: error
      };

      return {
        id: request.id,
        error: mcpError
      };
    }
  }

  private setupServer(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      return { tools };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      this.logger.info('Executing tool', { toolName: name });
      
      const result = await tool.execute(args);
      
      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2)
            }
          ]
        };
      } else {
        throw new Error(result.error?.message || 'Tool execution failed');
      }
    });

    // Error handler
    this.server.onerror = (error) => {
      this.logger.error('MCP server error', error);
    };
  }

  private registerDefaultTools(): void {
    this.logger.info('Registering default tools');

    // Register analyze project tool
    const analyzeProjectTool = new AnalyzeProjectTool();
    this.registerTool(analyzeProjectTool);

    // Register generate diagram tool
    const generateDiagramTool = new GenerateDiagramTool(this.cacheManager);
    this.registerTool(generateDiagramTool);

    this.logger.info('Default tools registered', {
      toolCount: this.tools.size,
      tools: Array.from(this.tools.keys())
    });
  }

  private async handleToolCall(request: IMCPRequest): Promise<unknown> {
    const params = request.params as any;
    const toolName = params.name;
    const args = params.arguments;

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    this.logger.info('Executing tool', { toolName, args });
    
    const result = await tool.execute(args);
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Tool execution failed');
    }

    return result.data;
  }

  private async handleListTools(): Promise<{ tools: Tool[] }> {
    const tools: Tool[] = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    return { tools };
  }

  private async handleListResources(): Promise<{ resources: any[] }> {
    const resources = Array.from(this.resources.values());
    return { resources };
  }
}

// Factory function
export function createMCPServer(): IMCPServer {
  return new ProjectAnalysisMCPServer();
}