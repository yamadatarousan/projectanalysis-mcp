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

// Define the request handlers using the correct schema format
const toolsListHandler = {
  method: 'tools/list',
  schema: null
};

const toolsCallHandler = {
  method: 'tools/call', 
  schema: null
};

server.setRequestHandler(toolsListHandler, async () => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Analyze project directory structure',
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

server.setRequestHandler(toolsCallHandler, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'analyze_project') {
    try {
      const { projectPath } = args;
      const stats = await fs.stat(projectPath);
      
      if (!stats.isDirectory()) {
        throw new Error('Path must be a directory');
      }

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

*Analysis completed: ${new Date().toISOString()}*`
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error analyzing project: ${error.message}`
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

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ Project Analysis MCP Server is running');
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

main();