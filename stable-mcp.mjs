#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { promises as fs } from 'fs';
import { z } from 'zod';

const server = new Server({
  name: 'projectanalysis-mcp',
  version: '0.1.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Define schemas for 0.4.0 SDK
const toolsListRequestSchema = z.object({
  method: z.literal('tools/list'),
  params: z.object({}).optional()
});

const toolsCallRequestSchema = z.object({
  method: z.literal('tools/call'),
  params: z.object({
    name: z.string(),
    arguments: z.record(z.any())
  })
});

// Register handlers using proper schema format
server.setRequestHandler(toolsListRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Analyze project directory structure and contents',
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

server.setRequestHandler(toolsCallRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'analyze_project') {
    try {
      const { projectPath } = args;
      
      // Validate path exists and is directory
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

      const topTypes = Object.entries(fileTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);

      return {
        content: [{
          type: 'text',
          text: `# 📊 Project Analysis Results

**📁 Project Path**: ${projectPath}  
**📈 Total Items**: ${files.length}

## 🏷️ File Type Distribution:
${topTypes.map(([ext, count]) => `- **${ext}**: ${count} file${count !== 1 ? 's' : ''}`).join('\n')}

## 📋 Directory Contents (sample):
${files.slice(0, 15).map(f => `- ${f}`).join('\n')}

${files.length > 15 ? `\n*📦 Plus ${files.length - 15} more items...*` : ''}

🕒 **Analysis completed**: ${new Date().toISOString()}`
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ **Analysis Error**: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  return {
    content: [{
      type: 'text',
      text: `❌ **Unknown Tool**: ${name}`
    }],
    isError: true
  };
});

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🎉 Stable MCP Server is running successfully!');
  } catch (error) {
    console.error(`💥 Server startup failed: ${error.message}`);
    process.exit(1);
  }
}

main();