/**
 * MCP Tools export module
 */

export { AnalyzeProjectTool } from './analyze-project-tool.js';
export { GenerateDiagramTool } from './generate-diagram-tool.js';

// Re-export types
export type {
  IMCPTool,
  IMCPToolResult,
  IAnalyzeProjectParams,
  IAnalyzeProjectResult,
  IGenerateDiagramParams,
  IGenerateDiagramResult
} from '@/types/mcp.js';