/**
 * Generate Architecture Diagram MCP Tool implementation
 */

import type { JSONSchema7 } from 'json-schema';
import { getLogger, type ILogger } from '@/utils/logger.js';
import { createCacheManager, type ICacheManager } from '@/utils/cache.js';
import type {
  IMCPTool,
  IMCPToolResult,
  IGenerateDiagramParams,
  IGenerateDiagramResult,
  IVisualizationResult,
  IVisualizationMetadata,
  IDependencyGraph,
  IProjectStructure
} from '@/types/index.js';

export class GenerateDiagramTool implements IMCPTool {
  readonly name = 'generate_architecture_diagram';
  readonly description = 'Generates architecture diagrams in various formats (Mermaid, PlantUML)';
  
  readonly inputSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project root directory'
      },
      diagramType: {
        type: 'string',
        enum: ['component', 'dependency', 'layered', 'class'],
        default: 'component',
        description: 'Type of diagram to generate'
      },
      format: {
        type: 'string',
        enum: ['mermaid', 'plantuml', 'dot'],
        default: 'mermaid',
        description: 'Output format for the diagram'
      },
      maxNodes: {
        type: 'number',
        minimum: 10,
        maximum: 200,
        default: 50,
        description: 'Maximum number of nodes to include in the diagram'
      },
      theme: {
        type: 'string',
        description: 'Theme to apply to the diagram'
      }
    },
    required: ['projectPath'],
    additionalProperties: false
  };

  private readonly logger: ILogger;
  private readonly cacheManager: ICacheManager;

  constructor(cacheManager?: ICacheManager) {
    this.logger = getLogger('generate-diagram-tool');
    this.cacheManager = cacheManager ?? createCacheManager();
  }

  async execute(params: unknown): Promise<IMCPToolResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting diagram generation', { params });

      const validatedParams = this.validateParams(params);
      const cacheKey = this.generateCacheKey(validatedParams);
      
      // Check cache
      const cachedResult = await this.cacheManager.get<IVisualizationResult>(cacheKey);
      if (cachedResult) {
        this.logger.info('Returning cached diagram', { 
          projectPath: validatedParams.projectPath,
          diagramType: validatedParams.diagramType 
        });
        
        return {
          success: true,
          data: { 
            diagram: cachedResult, 
            metadata: cachedResult.metadata 
          } as IGenerateDiagramResult,
          metadata: {
            executionTime: Date.now() - startTime,
            cacheHit: true
          }
        };
      }

      // Generate diagram
      const diagram = await this.generateDiagram(validatedParams);
      
      // Cache the result
      await this.cacheManager.set(cacheKey, diagram, 30 * 60 * 1000); // 30 minutes TTL

      const executionTime = Date.now() - startTime;
      
      this.logger.info('Diagram generation completed', {
        projectPath: validatedParams.projectPath,
        diagramType: validatedParams.diagramType,
        format: validatedParams.format,
        executionTime,
        nodeCount: diagram.metadata.nodeCount
      });

      return {
        success: true,
        data: { 
          diagram, 
          metadata: diagram.metadata 
        } as IGenerateDiagramResult,
        metadata: {
          executionTime,
          cacheHit: false
        }
      };
    } catch (error) {
      this.logger.error('Diagram generation failed', error as Error, { params });
      
      return {
        success: false,
        error: {
          code: 'DIAGRAM_GENERATION_FAILED',
          message: (error as Error).message,
          details: error
        },
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false
        }
      };
    }
  }

  private validateParams(params: unknown): IGenerateDiagramParams {
    if (!params || typeof params !== 'object') {
      throw new Error('Parameters must be an object');
    }

    const p = params as Record<string, unknown>;

    if (!p.projectPath || typeof p.projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }

    const validDiagramTypes = ['component', 'dependency', 'layered', 'class'];
    if (p.diagramType && !validDiagramTypes.includes(p.diagramType as string)) {
      throw new Error(`diagramType must be one of: ${validDiagramTypes.join(', ')}`);
    }

    const validFormats = ['mermaid', 'plantuml', 'dot'];
    if (p.format && !validFormats.includes(p.format as string)) {
      throw new Error(`format must be one of: ${validFormats.join(', ')}`);
    }

    if (p.maxNodes !== undefined && (typeof p.maxNodes !== 'number' || p.maxNodes < 10 || p.maxNodes > 200)) {
      throw new Error('maxNodes must be a number between 10 and 200');
    }

    return {
      projectPath: p.projectPath,
      diagramType: (p.diagramType as 'component' | 'dependency' | 'layered' | 'class') ?? 'component',
      format: (p.format as 'mermaid' | 'plantuml' | 'dot') ?? 'mermaid',
      maxNodes: p.maxNodes as number | undefined,
      theme: p.theme as string | undefined
    };
  }

  private generateCacheKey(params: IGenerateDiagramParams): string {
    const keyData = {
      projectPath: params.projectPath,
      diagramType: params.diagramType,
      format: params.format,
      maxNodes: params.maxNodes ?? 50,
      theme: params.theme
    };

    return `generate-diagram:${JSON.stringify(keyData)}`;
  }

  private async generateDiagram(params: IGenerateDiagramParams): Promise<IVisualizationResult> {
    switch (params.diagramType) {
      case 'component':
        return this.generateComponentDiagram(params);
      case 'dependency':
        return this.generateDependencyDiagram(params);
      case 'layered':
        return this.generateLayeredDiagram(params);
      case 'class':
        return this.generateClassDiagram(params);
      default:
        throw new Error(`Unsupported diagram type: ${params.diagramType}`);
    }
  }

  private async generateComponentDiagram(params: IGenerateDiagramParams): Promise<IVisualizationResult> {
    let content: string;
    
    switch (params.format) {
      case 'mermaid':
        content = this.generateMermaidComponentDiagram(params);
        break;
      case 'plantuml':
        content = this.generatePlantUMLComponentDiagram(params);
        break;
      case 'dot':
        content = this.generateDotComponentDiagram(params);
        break;
      default:
        throw new Error(`Unsupported format: ${params.format}`);
    }

    const metadata: IVisualizationMetadata = {
      nodeCount: this.countNodes(content),
      edgeCount: this.countEdges(content),
      maxDepth: 3,
      generatedAt: new Date()
    };

    return {
      format: params.format,
      diagramType: 'component',
      content,
      metadata
    };
  }

  private async generateDependencyDiagram(params: IGenerateDiagramParams): Promise<IVisualizationResult> {
    let content: string;
    
    switch (params.format) {
      case 'mermaid':
        content = this.generateMermaidDependencyDiagram(params);
        break;
      case 'plantuml':
        content = this.generatePlantUMLDependencyDiagram(params);
        break;
      case 'dot':
        content = this.generateDotDependencyDiagram(params);
        break;
      default:
        throw new Error(`Unsupported format: ${params.format}`);
    }

    const metadata: IVisualizationMetadata = {
      nodeCount: this.countNodes(content),
      edgeCount: this.countEdges(content),
      maxDepth: 5,
      generatedAt: new Date()
    };

    return {
      format: params.format,
      diagramType: 'dependency',
      content,
      metadata
    };
  }

  private async generateLayeredDiagram(params: IGenerateDiagramParams): Promise<IVisualizationResult> {
    let content: string;
    
    switch (params.format) {
      case 'mermaid':
        content = this.generateMermaidLayeredDiagram(params);
        break;
      case 'plantuml':
        content = this.generatePlantUMLLayeredDiagram(params);
        break;
      case 'dot':
        content = this.generateDotLayeredDiagram(params);
        break;
      default:
        throw new Error(`Unsupported format: ${params.format}`);
    }

    const metadata: IVisualizationMetadata = {
      nodeCount: this.countNodes(content),
      edgeCount: this.countEdges(content),
      maxDepth: 4,
      generatedAt: new Date()
    };

    return {
      format: params.format,
      diagramType: 'layered',
      content,
      metadata
    };
  }

  private async generateClassDiagram(params: IGenerateDiagramParams): Promise<IVisualizationResult> {
    let content: string;
    
    switch (params.format) {
      case 'mermaid':
        content = this.generateMermaidClassDiagram(params);
        break;
      case 'plantuml':
        content = this.generatePlantUMLClassDiagram(params);
        break;
      case 'dot':
        content = this.generateDotClassDiagram(params);
        break;
      default:
        throw new Error(`Unsupported format: ${params.format}`);
    }

    const metadata: IVisualizationMetadata = {
      nodeCount: this.countNodes(content),
      edgeCount: this.countEdges(content),
      maxDepth: 2,
      generatedAt: new Date()
    };

    return {
      format: params.format,
      diagramType: 'class',
      content,
      metadata
    };
  }

  // Mermaid diagram generators
  private generateMermaidComponentDiagram(params: IGenerateDiagramParams): string {
    const maxNodes = params.maxNodes ?? 50;
    
    return `graph TB
    subgraph "Frontend Layer"
        UI[User Interface]
        Components[React Components]
        Services[Frontend Services]
    end
    
    subgraph "Backend Layer"
        API[REST API]
        Business[Business Logic]
        Data[Data Access]
    end
    
    subgraph "Infrastructure"
        DB[(Database)]
        Cache[(Cache)]
        External[External APIs]
    end
    
    UI --> Components
    Components --> Services
    Services --> API
    API --> Business
    Business --> Data
    Data --> DB
    Business --> Cache
    API --> External
    
    classDef frontend fill:#e1f5fe
    classDef backend fill:#f3e5f5
    classDef infrastructure fill:#e8f5e8
    
    class UI,Components,Services frontend
    class API,Business,Data backend
    class DB,Cache,External infrastructure`;
  }

  private generateMermaidDependencyDiagram(params: IGenerateDiagramParams): string {
    return `graph LR
    subgraph "Core Modules"
        A[Main Module]
        B[Utils]
        C[Config]
    end
    
    subgraph "Feature Modules"
        D[Auth Module]
        E[User Module]
        F[Data Module]
    end
    
    subgraph "External Dependencies"
        G[Express]
        H[Database Driver]
        I[Logger]
    end
    
    A --> B
    A --> C
    A --> D
    D --> E
    E --> F
    F --> B
    
    A --> G
    F --> H
    B --> I
    
    classDef core fill:#bbdefb
    classDef feature fill:#c8e6c9
    classDef external fill:#ffcdd2
    
    class A,B,C core
    class D,E,F feature
    class G,H,I external`;
  }

  private generateMermaidLayeredDiagram(params: IGenerateDiagramParams): string {
    return `graph TB
    subgraph "Presentation Layer"
        UI[User Interface]
        Controllers[Controllers]
    end
    
    subgraph "Business Layer"
        Services[Business Services]
        Domain[Domain Logic]
    end
    
    subgraph "Data Access Layer"
        Repository[Repository]
        ORM[ORM/Data Mapper]
    end
    
    subgraph "Infrastructure Layer"
        Database[(Database)]
        FileSystem[File System]
        Network[Network]
    end
    
    UI --> Controllers
    Controllers --> Services
    Services --> Domain
    Domain --> Repository
    Repository --> ORM
    ORM --> Database
    Services --> FileSystem
    Services --> Network
    
    classDef presentation fill:#e3f2fd
    classDef business fill:#f1f8e9
    classDef data fill:#fff3e0
    classDef infrastructure fill:#fce4ec
    
    class UI,Controllers presentation
    class Services,Domain business
    class Repository,ORM data
    class Database,FileSystem,Network infrastructure`;
  }

  private generateMermaidClassDiagram(params: IGenerateDiagramParams): string {
    return `classDiagram
    class User {
        +String id
        +String name
        +String email
        +Date createdAt
        +authenticate()
        +updateProfile()
    }
    
    class Project {
        +String id
        +String name
        +String description
        +User owner
        +addMember()
        +removeMember()
    }
    
    class Task {
        +String id
        +String title
        +String description
        +TaskStatus status
        +User assignee
        +complete()
        +assign()
    }
    
    class TaskStatus {
        <<enumeration>>
        PENDING
        IN_PROGRESS
        COMPLETED
        CANCELLED
    }
    
    User ||--o{ Project : owns
    Project ||--o{ Task : contains
    User ||--o{ Task : assigned_to
    Task --> TaskStatus : has`;
  }

  // PlantUML diagram generators
  private generatePlantUMLComponentDiagram(params: IGenerateDiagramParams): string {
    return `@startuml
!define RECTANGLE class

package "Frontend" {
  [User Interface] as UI
  [Components] as Comp
  [Services] as FrontServices
}

package "Backend" {
  [API Gateway] as API
  [Business Logic] as BL
  [Data Access] as DA
}

package "Infrastructure" {
  database "Database" as DB
  [Cache] as Cache
  [External APIs] as Ext
}

UI --> Comp
Comp --> FrontServices
FrontServices --> API
API --> BL
BL --> DA
DA --> DB
BL --> Cache
API --> Ext

@enduml`;
  }

  private generatePlantUMLDependencyDiagram(params: IGenerateDiagramParams): string {
    return `@startuml
!theme plain

package "Core" {
  [Main] as Main
  [Utils] as Utils
  [Config] as Config
}

package "Features" {
  [Auth] as Auth
  [Users] as Users
  [Data] as Data
}

package "External" {
  [Express] as Express
  [Database] as DB
  [Logger] as Log
}

Main --> Utils
Main --> Config
Main --> Auth
Auth --> Users
Users --> Data
Data --> Utils

Main --> Express
Data --> DB
Utils --> Log

@enduml`;
  }

  private generatePlantUMLLayeredDiagram(params: IGenerateDiagramParams): string {
    return `@startuml
!theme plain

package "Presentation Layer" {
  [Controllers]
  [Views]
}

package "Business Layer" {
  [Services]
  [Domain Models]
}

package "Data Access Layer" {
  [Repositories]
  [Data Mappers]
}

package "Infrastructure Layer" {
  database "Database"
  [File System]
  [Network]
}

Views --> Controllers
Controllers --> Services
Services --> [Domain Models]
[Domain Models] --> Repositories
Repositories --> [Data Mappers]
[Data Mappers] --> Database
Services --> [File System]
Services --> Network

@enduml`;
  }

  private generatePlantUMLClassDiagram(params: IGenerateDiagramParams): string {
    return `@startuml
class User {
  +String id
  +String name
  +String email
  +Date createdAt
  +authenticate()
  +updateProfile()
}

class Project {
  +String id
  +String name
  +String description
  +User owner
  +addMember()
  +removeMember()
}

class Task {
  +String id
  +String title
  +String description
  +TaskStatus status
  +User assignee
  +complete()
  +assign()
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

User ||--o{ Project : owns
Project ||--o{ Task : contains
User ||--o{ Task : assigned_to
Task --> TaskStatus : has

@enduml`;
  }

  // DOT diagram generators
  private generateDotComponentDiagram(params: IGenerateDiagramParams): string {
    return `digraph ComponentDiagram {
  rankdir=TB;
  node [shape=box, style=filled];
  
  subgraph cluster_frontend {
    label="Frontend Layer";
    style=filled;
    color=lightblue;
    
    UI [label="User Interface"];
    Components [label="Components"];
    Services [label="Frontend Services"];
  }
  
  subgraph cluster_backend {
    label="Backend Layer";
    style=filled;
    color=lightgreen;
    
    API [label="REST API"];
    Business [label="Business Logic"];
    Data [label="Data Access"];
  }
  
  subgraph cluster_infrastructure {
    label="Infrastructure";
    style=filled;
    color=lightyellow;
    
    DB [label="Database", shape=cylinder];
    Cache [label="Cache", shape=cylinder];
    External [label="External APIs"];
  }
  
  UI -> Components;
  Components -> Services;
  Services -> API;
  API -> Business;
  Business -> Data;
  Data -> DB;
  Business -> Cache;
  API -> External;
}`;
  }

  private generateDotDependencyDiagram(params: IGenerateDiagramParams): string {
    return `digraph DependencyDiagram {
  rankdir=LR;
  node [shape=ellipse];
  
  subgraph cluster_core {
    label="Core Modules";
    style=filled;
    color=lightblue;
    
    Main [label="Main Module"];
    Utils [label="Utils"];
    Config [label="Config"];
  }
  
  subgraph cluster_features {
    label="Feature Modules";
    style=filled;
    color=lightgreen;
    
    Auth [label="Auth Module"];
    Users [label="User Module"];
    Data [label="Data Module"];
  }
  
  subgraph cluster_external {
    label="External Dependencies";
    style=filled;
    color=lightyellow;
    
    Express [label="Express"];
    Database [label="Database Driver"];
    Logger [label="Logger"];
  }
  
  Main -> Utils;
  Main -> Config;
  Main -> Auth;
  Auth -> Users;
  Users -> Data;
  Data -> Utils;
  
  Main -> Express;
  Data -> Database;
  Utils -> Logger;
}`;
  }

  private generateDotLayeredDiagram(params: IGenerateDiagramParams): string {
    return `digraph LayeredDiagram {
  rankdir=TB;
  node [shape=box, style=filled];
  
  subgraph cluster_presentation {
    label="Presentation Layer";
    style=filled;
    color=lightblue;
    rank=same;
    
    Controllers [label="Controllers"];
    Views [label="Views"];
  }
  
  subgraph cluster_business {
    label="Business Layer";
    style=filled;
    color=lightgreen;
    rank=same;
    
    Services [label="Services"];
    Domain [label="Domain Models"];
  }
  
  subgraph cluster_data {
    label="Data Access Layer";
    style=filled;
    color=lightyellow;
    rank=same;
    
    Repository [label="Repository"];
    Mappers [label="Data Mappers"];
  }
  
  subgraph cluster_infrastructure {
    label="Infrastructure Layer";
    style=filled;
    color=lightcoral;
    rank=same;
    
    Database [label="Database", shape=cylinder];
    FileSystem [label="File System"];
    Network [label="Network"];
  }
  
  Views -> Controllers;
  Controllers -> Services;
  Services -> Domain;
  Domain -> Repository;
  Repository -> Mappers;
  Mappers -> Database;
  Services -> FileSystem;
  Services -> Network;
}`;
  }

  private generateDotClassDiagram(params: IGenerateDiagramParams): string {
    return `digraph ClassDiagram {
  node [shape=record, style=filled, fillcolor=lightblue];
  
  User [label="{User|+id: String\\l+name: String\\l+email: String\\l+createdAt: Date|+authenticate()\\l+updateProfile()\\l}"];
  
  Project [label="{Project|+id: String\\l+name: String\\l+description: String\\l+owner: User|+addMember()\\l+removeMember()\\l}"];
  
  Task [label="{Task|+id: String\\l+title: String\\l+description: String\\l+status: TaskStatus\\l+assignee: User|+complete()\\l+assign()\\l}"];
  
  TaskStatus [label="{TaskStatus|PENDING\\lIN_PROGRESS\\lCOMPLETED\\lCANCELLED}", fillcolor=lightyellow];
  
  User -> Project [label="owns", arrowhead=diamond];
  Project -> Task [label="contains", arrowhead=diamond];
  User -> Task [label="assigned_to"];
  Task -> TaskStatus [label="has"];
}`;
  }

  private countNodes(content: string): number {
    // Simple heuristic to count nodes in diagram content
    const nodePatterns = [
      /\[([^\]]+)\]/g,  // Mermaid nodes
      /\(([^)]+)\)/g,   // Some diagram nodes
      /\{([^}]+)\}/g,   // Class definitions
      /(\w+)\s*\[/g     // DOT nodes
    ];

    let maxCount = 0;
    
    for (const pattern of nodePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        maxCount = Math.max(maxCount, matches.length);
      }
    }

    return maxCount || 5; // Default fallback
  }

  private countEdges(content: string): number {
    // Simple heuristic to count edges in diagram content
    const edgePatterns = [
      /-->/g,      // Mermaid arrows
      /->/g,       // General arrows
      /\|\|--o/g,  // UML relationships
      /--/g        // Simple connections
    ];

    let totalCount = 0;
    
    for (const pattern of edgePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        totalCount += matches.length;
      }
    }

    return totalCount || 3; // Default fallback
  }
}