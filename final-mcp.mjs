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

// Handle tools list requests
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Analyze project directory structure and file types',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory to analyze'
            }
          },
          required: ['projectPath']
        }
      }
    ]
  };
});

// Handle tool execution requests
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'analyze_project') {
    try {
      const { projectPath } = args;
      
      // Validate that the path exists and is a directory
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Provided path is not a directory');
      }

      // Read directory contents
      const files = await fs.readdir(projectPath);
      
      // Analyze file types
      const fileTypes = {};
      files.forEach(file => {
        const ext = file.split('.').pop()?.toLowerCase() || 'no-extension';
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      });

      // Sort by frequency
      const sortedTypes = Object.entries(fileTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      return {
        content: [{
          type: 'text',
          text: `# Project Analysis Results

**Project Path**: ${projectPath}
**Total Items**: ${files.length}

## File Type Breakdown:
${sortedTypes.map(([ext, count]) => 
  `- **${ext}**: ${count} file${count > 1 ? 's' : ''}`
).join('\n')}

## Directory Contents (first 15 items):
${files.slice(0, 15).map(f => `- ${f}`).join('\n')}

${files.length > 15 ? `\n*... and ${files.length - 15} more items*` : ''}

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
    console.error('✅ Project Analysis MCP Server started successfully');
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error.message);
    process.exit(1);
  }
}

main();