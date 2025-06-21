#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { promises as fs } from 'fs';

// Create server with simple configuration
const server = new Server(
  {
    name: 'projectanalysis-mcp',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Define handlers using the simple string method
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Basic project directory analysis',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to analyze'
            }
          },
          required: ['projectPath']
        }
      }
    ]
  };
});

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
          text: `# Simple Project Analysis

**Path**: ${projectPath}  
**Items Found**: ${files.length}

## First 10 items:
${files.slice(0, 10).map(f => `- ${f}`).join('\n')}

${files.length > 10 ? `\n... plus ${files.length - 10} more items` : ''}

*Completed: ${new Date().toISOString()}*`
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
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('✅ Test MCP Server started');
}).catch(error => {
  console.error(`❌ Server failed: ${error.message}`);
  process.exit(1);
});