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

// Use the latest SDK syntax
server.setRequestHandler({
  method: 'tools/list'
}, async () => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Analyze a project directory structure',
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

server.setRequestHandler({
  method: 'tools/call'
}, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'analyze_project') {
    try {
      const { projectPath } = args;
      
      // Validate path
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Path must be a directory');
      }

      // Read directory
      const files = await fs.readdir(projectPath);
      
      // Analyze file types
      const extensions = {};
      files.forEach(file => {
        const ext = file.split('.').pop()?.toLowerCase() || 'no-extension';
        extensions[ext] = (extensions[ext] || 0) + 1;
      });

      const topExtensions = Object.entries(extensions)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      return {
        content: [{
          type: 'text',
          text: `# Project Analysis

**Path**: ${projectPath}
**Total Items**: ${files.length}

## File Types:
${topExtensions.map(([ext, count]) => `- **${ext}**: ${count} files`).join('\n')}

## Sample Files:
${files.slice(0, 10).map(f => `- ${f}`).join('\n')}

${files.length > 10 ? `\n*... and ${files.length - 10} more items*` : ''}

*Completed: ${new Date().toISOString()}*`
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Latest MCP Server running');
}

main().catch(error => {
  console.error(`❌ Server error: ${error.message}`);
  process.exit(1);
});