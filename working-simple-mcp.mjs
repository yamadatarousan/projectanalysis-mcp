#!/usr/bin/env node

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

// Register tools/list handler
server.setRequestHandler('tools/list', async (request) => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Analyze a project directory',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory'
            }
          },
          required: ['projectPath']
        }
      }
    ]
  };
});

// Register tools/call handler
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'analyze_project') {
    try {
      const { projectPath } = args;
      
      // Check if path exists
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Path must be a directory');
      }

      // Get directory contents
      const files = await fs.readdir(projectPath);
      
      return {
        content: [{
          type: 'text',
          text: `# Project Analysis Results

**Project Path**: ${projectPath}
**Total Items**: ${files.length}

## Directory Contents:
${files.slice(0, 15).map(f => `- ${f}`).join('\n')}

${files.length > 15 ? `\n... and ${files.length - 15} more items` : ''}

*Analysis completed at: ${new Date().toISOString()}*`
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  return {
    content: [{
      type: 'text',
      text: `❌ Unknown tool: ${name}`
    }],
    isError: true
  };
});

// Start the server
async function startServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ MCP Server connected successfully');
  } catch (error) {
    console.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();