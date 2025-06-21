#!/usr/bin/env node
/**
 * Simple working MCP Server for Project Analysis
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { promises as fs } from 'fs';
import { join } from 'path';

// Create server
const server = new Server({
  name: 'projectanalysis-mcp',
  version: '0.1.0'
}, {
  capabilities: {
    tools: {}
  }
});

// List tools
server.setRequestHandler({method: 'tools/list'}, async () => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Analyze project structure and file types',
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

// Execute tools
server.setRequestHandler({method: 'tools/call'}, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'analyze_project') {
      const { projectPath } = args;
      
      // Validate directory exists
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Path must be a directory');
      }

      // Simple file analysis
      const files = await getFilesRecursive(projectPath);
      const analysis = analyzeFiles(files);
      
      return {
        content: [{
          type: 'text',
          text: `# Project Analysis: ${projectPath.split('/').pop()}

**Total Files**: ${files.length}
**Project Path**: ${projectPath}

## File Types:
${analysis.extensions.map(ext => 
  `- **${ext.extension}**: ${ext.count} files (${ext.percentage}%)`
).join('\n')}

*Analysis completed: ${new Date().toISOString()}*`
        }]
      };
    }
    
    throw new Error(`Unknown tool: ${name}`);
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
});

async function getFilesRecursive(dir, files = []) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip common ignored directories
      if (entry.name.startsWith('.') || 
          ['node_modules', 'dist', 'build', 'coverage'].includes(entry.name)) {
        continue;
      }
      
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (files.length < 1000) { // Limit to prevent infinite recursion
          await getFilesRecursive(fullPath, files);
        }
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return files;
}

function analyzeFiles(files) {
  const extensions = {};
  
  files.forEach(file => {
    const ext = file.split('.').pop()?.toLowerCase() || 'no-extension';
    extensions[ext] = (extensions[ext] || 0) + 1;
  });

  const sortedExtensions = Object.entries(extensions)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([ext, count]) => ({
      extension: ext,
      count,
      percentage: ((count / files.length) * 100).toFixed(1)
    }));

  return { extensions: sortedExtensions };
}

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ Simple MCP Server started');
  } catch (error) {
    console.error('❌ Server failed:', error);
    process.exit(1);
  }
}

main();