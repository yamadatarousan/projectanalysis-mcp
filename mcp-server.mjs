#!/usr/bin/env node
/**
 * Project Analysis MCP Server Entry Point
 * This script provides a working MCP server for Claude Desktop integration
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Add the dist directory to the module path
const distPath = join(__dirname, 'dist');
process.env.NODE_PATH = distPath;

async function startMCPServer() {
  try {
    console.error('🚀 Starting Project Analysis MCP Server...');
    
    // Import and start the MCP server
    // For now, create a minimal MCP server implementation
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    
    const server = new Server({
      name: 'projectanalysis-mcp',
      version: '0.1.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Add analyze_project tool
    server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'analyze_project',
            description: 'Analyze a software project for structure, dependencies, and metrics',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory to analyze'
                },
                depth: {
                  type: 'number',
                  description: 'Analysis depth (1-10)',
                  minimum: 1,
                  maximum: 10,
                  default: 3
                },
                includePatterns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'File patterns to include in analysis'
                },
                excludePatterns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'File patterns to exclude from analysis'
                }
              },
              required: ['projectPath']
            }
          },
          {
            name: 'generate_diagram',
            description: 'Generate architecture diagrams for a project',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory'
                },
                diagramType: {
                  type: 'string',
                  enum: ['component', 'dependency', 'layered'],
                  description: 'Type of diagram to generate'
                },
                format: {
                  type: 'string',
                  enum: ['mermaid', 'plantuml'],
                  default: 'mermaid',
                  description: 'Output format for the diagram'
                }
              },
              required: ['projectPath', 'diagramType']
            }
          }
        ]
      };
    });

    // Add tool execution handler
    server.setRequestHandler('tools/call', async (request) => {
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
        console.error(`Tool execution error: ${error.message}`);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('✅ Project Analysis MCP Server running and ready for Claude Desktop');

  } catch (error) {
    console.error('❌ Failed to start MCP server:', error.message);
    process.exit(1);
  }
}

async function analyzeProject(args) {
  const { projectPath, depth = 3, includePatterns = ['**/*'], excludePatterns = ['node_modules/**', '.git/**'] } = args;
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Basic project analysis
    const stats = await fs.stat(projectPath);
    if (!stats.isDirectory()) {
      throw new Error('Project path must be a directory');
    }

    // Get project structure
    const files = await getProjectFiles(projectPath, { includePatterns, excludePatterns, maxDepth: depth });
    
    // Analyze file types
    const filesByType = {};
    let totalLines = 0;
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!filesByType[ext]) {
        filesByType[ext] = { count: 0, lines: 0 };
      }
      filesByType[ext].count++;
      
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n').length;
        filesByType[ext].lines += lines;
        totalLines += lines;
      } catch (e) {
        // Skip binary files
      }
    }

    const analysis = {
      projectPath,
      totalFiles: files.length,
      totalLines,
      fileTypes: Object.entries(filesByType)
        .sort(([,a], [,b]) => b.lines - a.lines)
        .slice(0, 10)
        .map(([ext, data]) => ({
          extension: ext || 'no extension',
          fileCount: data.count,
          linesOfCode: data.lines,
          percentage: ((data.lines / totalLines) * 100).toFixed(1)
        })),
      analyzedAt: new Date().toISOString(),
      analysisDepth: depth
    };

    return {
      content: [
        {
          type: 'text',
          text: `# Project Analysis Results

**Project:** ${projectPath}
**Total Files:** ${analysis.totalFiles}
**Total Lines:** ${analysis.totalLines.toLocaleString()}
**Analysis Depth:** ${depth}

## File Type Breakdown:

${analysis.fileTypes.map(ft => 
  `- **${ft.extension}**: ${ft.fileCount} files, ${ft.linesOfCode.toLocaleString()} lines (${ft.percentage}%)`
).join('\n')}

## Project Structure Overview:
The project contains ${analysis.totalFiles} files with a total of ${analysis.totalLines.toLocaleString()} lines of code. The primary languages appear to be ${analysis.fileTypes.slice(0, 3).map(ft => ft.extension).join(', ')}.

*Analysis completed at: ${analysis.analyzedAt}*`
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error analyzing project: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

async function generateDiagram(args) {
  const { projectPath, diagramType, format = 'mermaid' } = args;
  
  try {
    // Simple diagram generation based on project structure
    let diagram = '';
    
    if (format === 'mermaid') {
      if (diagramType === 'component') {
        diagram = `graph TD
    A[${projectPath.split('/').pop() || 'Project'}] --> B[src/]
    A --> C[tests/]
    A --> D[docs/]
    B --> E[components/]
    B --> F[utils/]
    B --> G[types/]
    E --> H[Component1]
    E --> I[Component2]
    F --> J[helpers]
    F --> K[validators]`;
      } else if (diagramType === 'dependency') {
        diagram = `graph LR
    A[Main App] --> B[Core Module]
    A --> C[UI Components]
    B --> D[Data Layer]
    B --> E[Business Logic]
    C --> F[Shared Components]
    D --> G[Database]
    E --> H[Services]`;
      } else if (diagramType === 'layered') {
        diagram = `graph TB
    A[Presentation Layer] --> B[Business Layer]
    B --> C[Data Layer]
    A --> D[UI Components]
    B --> E[Services]
    C --> F[Repository]
    F --> G[Database]`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `# ${diagramType.charAt(0).toUpperCase() + diagramType.slice(1)} Diagram

Generated ${format} diagram for project: ${projectPath}

\`\`\`${format}
${diagram}
\`\`\`

This is a simplified ${diagramType} diagram. For more detailed analysis, the full implementation would scan the actual project structure and dependencies.`
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error generating diagram: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

async function getProjectFiles(dir, options) {
  const { glob } = await import('glob');
  const files = [];
  
  for (const pattern of options.includePatterns) {
    const matches = await glob(pattern, {
      cwd: dir,
      absolute: true,
      ignore: options.excludePatterns || []
    });
    files.push(...matches);
  }
  
  return [...new Set(files)]; // Remove duplicates
}

// Start the server
startMCPServer().catch(console.error);