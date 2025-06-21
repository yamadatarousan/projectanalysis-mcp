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

// Use simple string-based handlers (works with all SDK versions)
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Analyze project directory and files',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to project directory'
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
      
      // Check if directory exists
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Path must be a directory');
      }

      // Read directory contents
      const files = await fs.readdir(projectPath);
      
      // Simple file type counting
      const fileTypes = {};
      files.forEach(file => {
        const ext = file.split('.').pop()?.toLowerCase() || 'no-extension';
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      });

      const topTypes = Object.entries(fileTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 6);

      return {
        content: [{
          type: 'text',
          text: `# Project Analysis

**📁 Path**: ${projectPath}  
**📊 Total Items**: ${files.length}

## 📋 File Types:
${topTypes.map(([ext, count]) => `- **${ext}**: ${count} file${count !== 1 ? 's' : ''}`).join('\n')}

## 📂 Sample Contents:
${files.slice(0, 12).map(f => `- ${f}`).join('\n')}

${files.length > 12 ? `\n*... plus ${files.length - 12} more items*` : ''}

🕒 *Analysis completed: ${new Date().toISOString()}*`
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Analysis failed: ${error.message}`
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

// Start server with error handling
async function startServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 Ultimate MCP Server is running!');
  } catch (error) {
    console.error(`💥 Server startup failed: ${error.message}`);
    process.exit(1);
  }
}

startServer();