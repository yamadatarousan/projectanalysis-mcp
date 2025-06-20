# Project Analysis MCP Server

A comprehensive Model Context Protocol (MCP) server for analyzing software projects, providing deep insights into code structure, dependencies, architecture patterns, and metrics.

## 🚀 Features

### Core Analysis Capabilities
- **Project Structure Analysis**: Comprehensive directory and file organization mapping
- **Language & Tech Stack Detection**: Automatic identification of programming languages, frameworks, and libraries
- **Dependency Analysis**: Static dependency tracking with circular dependency detection
- **Architecture Pattern Detection**: Automatic identification of common architectural patterns (MVC, Layered, Microservices, etc.)

### Code Quality & Metrics
- **Complexity Metrics**: Cyclomatic and cognitive complexity analysis
- **Code Quality Assessment**: Maintainability index, technical debt identification
- **Hotspot Detection**: Identification of problematic code areas based on change frequency and complexity

### Visualization & Reporting
- **Architecture Diagrams**: Generate Mermaid and PlantUML diagrams
- **Dependency Graphs**: Visual representation of project dependencies
- **Comprehensive Reports**: Detailed project overview and technical debt reports

### Supported Languages (Phase 1)
- JavaScript/TypeScript
- Python
- Java

## 📋 Requirements

- Node.js 18+
- MCP-compatible client (Claude Desktop, etc.)

## 🛠 Installation

### From npm (Coming Soon)
```bash
npm install -g projectanalysis-mcp
```

### From Source
```bash
git clone https://github.com/your-org/projectanalysis-mcp.git
cd projectanalysis-mcp
npm install
npm run build
```

## 🔧 Configuration

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "projectanalysis": {
      "command": "projectanalysis-mcp",
      "args": []
    }
  }
}
```

### Server Configuration

Create a configuration file at `~/.config/projectanalysis-mcp/config.json`:

```json
{
  "analysis": {
    "maxFileSize": 10485760,
    "maxFileCount": 10000,
    "excludePatterns": [
      "node_modules/**",
      ".git/**",
      "dist/**",
      "build/**"
    ],
    "supportedExtensions": {
      "javascript": [".js", ".jsx", ".ts", ".tsx", ".mjs"],
      "python": [".py", ".pyx", ".pyi"],
      "java": [".java", ".jar"]
    }
  },
  "visualization": {
    "maxNodes": 50,
    "defaultFormat": "mermaid"
  },
  "cache": {
    "enabled": true,
    "ttl": 3600000,
    "maxSize": 100
  }
}
```

## 📖 Usage

### Available MCP Tools

#### `analyze_project`
Performs comprehensive project analysis including structure, dependencies, and metrics.

```typescript
// Parameters
{
  projectPath: string;          // Path to project root
  depth?: number;              // Analysis depth (default: 3)
  includePatterns?: string[];  // File patterns to include
  excludePatterns?: string[];  // File patterns to exclude
}
```

#### `generate_architecture_diagram`
Generates architecture diagrams in various formats.

```typescript
// Parameters
{
  projectPath: string;
  diagramType: 'component' | 'dependency' | 'layered';
  format: 'mermaid' | 'plantuml';
  maxNodes?: number;           // Maximum nodes in diagram
}
```

#### `analyze_dependencies`
Detailed dependency analysis with cycle detection.

```typescript
// Parameters
{
  projectPath: string;
  targetFiles?: string[];      // Specific files to analyze
  includeExternal?: boolean;   // Include external dependencies
}
```

#### `trace_impact`
Analyzes the impact of changes to specific files.

```typescript
// Parameters
{
  projectPath: string;
  targetFile: string;          // File to analyze impact for
  direction: 'incoming' | 'outgoing' | 'both';
  maxDepth?: number;           // Trace depth
}
```

#### `detect_patterns`
Detects architectural and design patterns in the codebase.

```typescript
// Parameters
{
  projectPath: string;
  patternTypes?: string[];     // Specific patterns to detect
}
```

### Example Usage with Claude

```
Analyze this TypeScript project for me:
- Project path: /path/to/my/project
- Show me the architecture overview
- Identify any circular dependencies
- Generate a component diagram
```

## 🏗 Architecture

The server follows a layered architecture with pluggable analyzers:

```
MCP Layer (Presentation)
├── Core Business Logic
├── Analyzer Layer (Pluggable)
├── Visualization Layer
└── Infrastructure Layer
```

### Key Components

- **Analysis Orchestrator**: Coordinates all analysis operations
- **Language Analyzers**: Pluggable analyzers for different languages
- **Project Scanner**: File system traversal and project structure mapping
- **Dependency Tracker**: Static dependency analysis
- **Pattern Detector**: Architecture and design pattern recognition
- **Visualization Generators**: Diagram and report generation

## 🧪 Development

### Setup Development Environment

```bash
git clone https://github.com/your-org/projectanalysis-mcp.git
cd projectanalysis-mcp
npm install
```

### Development Commands

```bash
# Start development server
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Code quality
npm run lint
npm run format
npm run typecheck

# Build
npm run build

# Analyze project itself
npm run analyze:deps
npm run analyze:complexity
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- analyzers
npm test -- integration

# Generate coverage report
npm run test:coverage
```

### Adding Language Support

1. Create analyzer in `src/analyzers/{language}/`
2. Implement `ILanguageAnalyzer` interface
3. Register in `AnalyzerRegistry`
4. Add tests in `tests/unit/analyzers/`

Example:
```typescript
export class CustomLanguageAnalyzer extends BaseLanguageAnalyzer {
  readonly language = 'custom';
  readonly supportedExtensions = ['.custom'];
  
  async extractDependencies(filePath: string): Promise<IDependency[]> {
    // Implementation
  }
  
  async calculateComplexity(filePath: string): Promise<IComplexityMetrics> {
    // Implementation
  }
}
```

## 📊 Performance

### Benchmarks

| Project Size | Files | Analysis Time | Memory Usage |
|-------------|-------|---------------|--------------|
| Small       | <100  | <5s          | <50MB        |
| Medium      | <1K   | <30s         | <200MB       |
| Large       | <10K  | <5min        | <512MB       |

### Optimization Features

- **Parallel Processing**: Multi-threaded analysis using Worker threads
- **Intelligent Caching**: Multi-level cache with LRU eviction
- **Streaming Processing**: Memory-efficient handling of large projects
- **Incremental Analysis**: Only analyze changed files

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Maintain test coverage >80%
- Use conventional commit messages
- Update documentation for new features

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

- Report bugs: [GitHub Issues](https://github.com/your-org/projectanalysis-mcp/issues)
- Feature requests: [GitHub Discussions](https://github.com/your-org/projectanalysis-mcp/discussions)
- Documentation: [Wiki](https://github.com/your-org/projectanalysis-mcp/wiki)

## 🗺 Roadmap

### Phase 1 (Current) - MVP
- [x] Basic project structure analysis
- [x] JavaScript/TypeScript support
- [x] Dependency analysis
- [x] Mermaid diagram generation
- [ ] Python support
- [ ] Java support

### Phase 2 - Advanced Analysis
- [ ] Code complexity metrics
- [ ] Pattern detection
- [ ] Technical debt analysis
- [ ] Performance optimization

### Phase 3 - Extended Language Support
- [ ] Go, Rust, C# support
- [ ] Custom analyzer plugins
- [ ] Advanced visualization options
- [ ] Real-time analysis capabilities

---

**Built with ❤️ for the MCP ecosystem**
