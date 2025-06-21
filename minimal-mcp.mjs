#!/usr/bin/env node
/**
 * Minimal working MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { promises as fs } from 'fs';

const server = new Server({
  name: 'projectanalysis-mcp',
  version: '0.1.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Handle tools list
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Basic project analysis',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to project'
            }
          },
          required: ['projectPath']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'analyze_project') {
    try {
      const { projectPath } = args;
      const stats = await fs.stat(projectPath);
      
      if (!stats.isDirectory()) {
        return {
          content: [{ type: 'text', text: 'Error: Path must be a directory' }],
          isError: true
        };
      }

      const files = await fs.readdir(projectPath);
      
      return {
        content: [{
          type: 'text',
          text: `# Project Analysis

**Path**: ${projectPath}
**Files found**: ${files.length}

## Files:
${files.slice(0, 10).map(f => `- ${f}`).join('\n')}

${files.length > 10 ? `... and ${files.length - 10} more files` : ''}

*Analysis completed at ${new Date().toISOString()}*`
        }]
      };
      
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
  
  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server started');
}

main().catch(console.error);