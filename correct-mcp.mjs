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

// Use correct method registration syntax
server.setRequestHandler({
  method: 'tools/list'
}, async () => {
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

server.setRequestHandler({
  method: 'tools/call'
}, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'analyze_project') {
    try {
      const { projectPath } = args;
      
      // Check if path exists and is directory
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Provided path is not a directory');
      }

      // Read directory contents
      const files = await fs.readdir(projectPath);
      
      // Simple file type analysis
      const fileTypes = {};
      files.forEach(file => {
        const ext = file.split('.').pop()?.toLowerCase() || 'no-extension';
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      });

      const sortedTypes = Object.entries(fileTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);

      return {
        content: [{
          type: 'text',
          text: `# Project Analysis: ${projectPath.split('/').pop()}

**Project Path**: ${projectPath}
**Total Items**: ${files.length}

## File Type Distribution:
${sortedTypes.map(([ext, count]) => 
  `- **${ext}**: ${count} file${count !== 1 ? 's' : ''}`
).join('\n')}

## Sample Files:
${files.slice(0, 12).map(f => `- ${f}`).join('\n')}

${files.length > 12 ? `\n*... and ${files.length - 12} more items*` : ''}

*Analysis completed: ${new Date().toISOString()}*`
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

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ Project Analysis MCP Server started');
  } catch (error) {
    console.error(`❌ Server error: ${error.message}`);
    process.exit(1);
  }
}

main();