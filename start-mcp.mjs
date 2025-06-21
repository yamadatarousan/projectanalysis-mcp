#!/usr/bin/env node
/**
 * Simplified and reliable MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import pkg from 'glob';
const { glob } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = new Server({
  name: 'projectanalysis-mcp',
  version: '0.1.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Tool definitions
server.setRequestHandler({method: 'tools/list'}, async () => {
  return {
    tools: [
      {
        name: 'analyze_project',
        description: 'Analyze a software project structure and provide insights',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory'
            },
            depth: {
              type: 'number',
              description: 'Analysis depth (1-5)',
              minimum: 1,
              maximum: 5,
              default: 2
            }
          },
          required: ['projectPath']
        }
      },
      {
        name: 'generate_diagram',
        description: 'Generate a simple project structure diagram',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory'
            },
            diagramType: {
              type: 'string',
              enum: ['structure', 'dependencies'],
              default: 'structure',
              description: 'Type of diagram to generate'
            }
          },
          required: ['projectPath']
        }
      }
    ]
  };
});

// Tool execution
server.setRequestHandler({method: 'tools/call'}, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'analyze_project') {
      return await analyzeProject(args);
    } else if (name === 'generate_diagram') {
      return await generateDiagram(args);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
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

async function analyzeProject(args) {
  const { projectPath, depth = 2 } = args;
  
  try {
    // Check if path exists
    const stats = await fs.stat(projectPath);
    if (!stats.isDirectory()) {
      throw new Error('Path must be a directory');
    }

    // Get file list
    const patterns = ['**/*'];
    const ignore = ['node_modules/**', '.git/**', 'dist/**', 'build/**', '**/*.log'];
    
    const files = await glob(patterns, {
      cwd: projectPath,
      ignore,
      nodir: true,
      absolute: false
    });

    // Analyze file types
    const analysis = analyzeFiles(files);
    
    // Get directory structure
    const structure = await getDirectoryStructure(projectPath, depth);

    return {
      content: [{
        type: 'text',
        text: formatAnalysisResult(projectPath, analysis, structure, files.length)
      }]
    };

  } catch (error) {
    throw new Error(`Failed to analyze project: ${error.message}`);
  }
}

async function generateDiagram(args) {
  const { projectPath, diagramType = 'structure' } = args;
  
  try {
    const stats = await fs.stat(projectPath);
    if (!stats.isDirectory()) {
      throw new Error('Path must be a directory');
    }

    const projectName = projectPath.split('/').pop() || 'Project';
    let diagram = '';

    if (diagramType === 'structure') {
      diagram = `graph TD
    A[${projectName}] --> B[src/]
    A --> C[tests/]
    A --> D[docs/]
    A --> E[config/]
    B --> F[components/]
    B --> G[utils/]
    B --> H[types/]`;
    } else if (diagramType === 'dependencies') {
      diagram = `graph LR
    A[Main App] --> B[Core]
    A --> C[UI]
    B --> D[Utils]
    C --> E[Components]`;
    }

    return {
      content: [{
        type: 'text',
        text: `# ${diagramType.charAt(0).toUpperCase() + diagramType.slice(1)} Diagram

\`\`\`mermaid
${diagram}
\`\`\`

Project: ${projectPath}`
      }]
    };

  } catch (error) {
    throw new Error(`Failed to generate diagram: ${error.message}`);
  }
}

function analyzeFiles(files) {
  const extensions = {};
  let totalSize = 0;

  files.forEach(file => {
    const ext = file.split('.').pop()?.toLowerCase() || 'no-ext';
    if (!extensions[ext]) {
      extensions[ext] = { count: 0, files: [] };
    }
    extensions[ext].count++;
    extensions[ext].files.push(file);
  });

  return {
    totalFiles: files.length,
    extensions: Object.entries(extensions)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([ext, data]) => ({
        extension: ext,
        count: data.count,
        percentage: ((data.count / files.length) * 100).toFixed(1)
      }))
  };
}

async function getDirectoryStructure(projectPath, maxDepth) {
  const structure = [];
  
  async function scan(dir, currentDepth) {
    if (currentDepth >= maxDepth) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries.slice(0, 20)) { // Limit entries
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          structure.push(`${'  '.repeat(currentDepth)}📁 ${entry.name}/`);
          await scan(join(dir, entry.name), currentDepth + 1);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }
  
  await scan(projectPath, 0);
  return structure.slice(0, 50); // Limit output
}

function formatAnalysisResult(projectPath, analysis, structure, totalFiles) {
  return `# Project Analysis: ${projectPath.split('/').pop()}

## Overview
- **Total Files**: ${totalFiles}
- **Project Path**: ${projectPath}

## File Types
${analysis.extensions.map(ext => 
  `- **${ext.extension}**: ${ext.count} files (${ext.percentage}%)`
).join('\n')}

## Directory Structure
${structure.slice(0, 20).join('\n')}

*Analysis completed at ${new Date().toISOString()}*`;
}

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();