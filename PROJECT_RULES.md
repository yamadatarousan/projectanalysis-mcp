# プロジェクト分析MCPサーバー - プロジェクトルール・コーディング規約

## 1. プロジェクト構造

### 1.1 ディレクトリ構成
```
projectanalysis-mcp/
├── src/                           # ソースコード
│   ├── analyzers/                 # 言語別・機能別アナライザー
│   │   ├── base/                  # ベースクラス・共通インターface
│   │   ├── javascript/            # JavaScript/TypeScript解析
│   │   ├── python/                # Python解析
│   │   └── java/                  # Java解析
│   ├── core/                      # コア機能
│   │   ├── project-scanner.ts     # プロジェクト構造スキャン
│   │   ├── dependency-tracker.ts  # 依存関係追跡
│   │   ├── metrics-calculator.ts  # メトリクス計算
│   │   └── pattern-detector.ts    # パターン検出
│   ├── visualizers/               # 可視化機能
│   │   ├── mermaid-generator.ts   # Mermaid図生成
│   │   ├── plantuml-generator.ts  # PlantUML図生成
│   │   └── report-generator.ts    # レポート生成
│   ├── mcp/                       # MCP関連
│   │   ├── server.ts              # MCPサーバーメイン
│   │   ├── tools/                 # MCPツール実装
│   │   └── resources/             # MCPリソース実装
│   ├── utils/                     # ユーティリティ
│   │   ├── cache.ts               # キャッシュ管理
│   │   ├── logger.ts              # ログ管理
│   │   ├── file-utils.ts          # ファイル操作
│   │   └── config.ts              # 設定管理
│   └── types/                     # 型定義
│       ├── analysis.ts            # 分析結果型
│       ├── project.ts             # プロジェクト型
│       └── mcp.ts                 # MCP関連型
├── tests/                         # テストファイル
│   ├── unit/                      # ユニットテスト
│   ├── integration/               # 統合テスト
│   └── fixtures/                  # テスト用データ
├── docs/                          # ドキュメント
├── config/                        # 設定ファイル
└── scripts/                       # ビルド・開発スクリプト
```

### 1.2 ファイル命名規則
- **TypeScriptファイル**: kebab-case (例: `dependency-tracker.ts`)
- **テストファイル**: `*.test.ts` または `*.spec.ts`
- **型定義ファイル**: 機能名 + `.ts` (例: `analysis.ts`)
- **設定ファイル**: 全て小文字 (例: `package.json`, `tsconfig.json`)

## 2. コーディング規約

### 2.1 TypeScript設定

#### 2.1.1 厳格な型チェック
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

#### 2.1.2 型定義のルール
- **インターフェース**: PascalCase + `I`プレフィックス（例: `IAnalysisResult`）
- **型エイリアス**: PascalCase（例: `ProjectType`）
- **列挙型**: PascalCase（例: `AnalysisStatus`）
- **型ガード**: `is` + 型名（例: `isValidProject`）

### 2.2 命名規則

#### 2.2.1 変数・関数
```typescript
// ✅ 推奨
const projectPath = '/path/to/project';
const analyzeProject = async (path: string): Promise<IAnalysisResult> => {};

// ❌ 非推奨
const pp = '/path/to/project';
const analyze = async (p: string) => {};
```

#### 2.2.2 クラス・インターフェース
```typescript
// ✅ 推奨
interface IProjectAnalyzer {
  analyzeStructure(path: string): Promise<IProjectStructure>;
}

class JavaScriptAnalyzer implements IProjectAnalyzer {
  private readonly parser: TreeSitterParser;
}

// ❌ 非推奨
interface analyzer {}
class jsAnalyzer {}
```

#### 2.2.3 定数
```typescript
// ✅ 推奨
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python'] as const;

// ❌ 非推奨
const maxSize = 10485760;
const langs = ['js', 'ts', 'py'];
```

### 2.3 関数・メソッド設計

#### 2.3.1 純粋関数の優先
```typescript
// ✅ 推奨（純粋関数）
function calculateComplexity(ast: ASTNode): number {
  return traverseAndCount(ast, isComplexityNode);
}

// ❌ 非推奨（副作用あり）
function calculateComplexity(ast: ASTNode): number {
  this.lastCalculation = Date.now(); // 副作用
  return traverseAndCount(ast, isComplexityNode);
}
```

#### 2.3.2 単一責任の原則
```typescript
// ✅ 推奨（責任が分離されている）
async function scanProjectStructure(path: string): Promise<IFileTree> {}
async function analyzeFileDependencies(files: string[]): Promise<IDependencyGraph> {}
async function generateReport(analysis: IAnalysisResult): Promise<string> {}

// ❌ 非推奨（複数の責任を持つ）
async function doEverything(path: string): Promise<string> {
  // ファイルスキャン + 依存関係分析 + レポート生成
}
```

### 2.4 エラーハンドリング

#### 2.4.1 カスタムエラークラス
```typescript
export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export class ParsingError extends AnalysisError {
  constructor(filePath: string, cause: Error) {
    super(`Failed to parse file: ${filePath}`, 'PARSING_ERROR', cause);
  }
}
```

#### 2.4.2 Result型パターン
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

async function analyzeFile(path: string): Promise<Result<IFileAnalysis, AnalysisError>> {
  try {
    const analysis = await performAnalysis(path);
    return { success: true, data: analysis };
  } catch (error) {
    return { success: false, error: new AnalysisError('Analysis failed', 'ANALYSIS_ERROR', error) };
  }
}
```

### 2.5 非同期処理

#### 2.5.1 async/await の使用
```typescript
// ✅ 推奨
async function analyzeMultipleFiles(paths: string[]): Promise<IAnalysisResult[]> {
  const results = await Promise.allSettled(
    paths.map(path => analyzeFile(path))
  );
  
  return results
    .filter((result): result is PromiseFulfilledResult<IAnalysisResult> => 
      result.status === 'fulfilled'
    )
    .map(result => result.value);
}

// ❌ 非推奨（Promiseチェーン）
function analyzeMultipleFiles(paths: string[]): Promise<IAnalysisResult[]> {
  return Promise.all(paths.map(path => 
    analyzeFile(path).then(result => result).catch(err => null)
  )).then(results => results.filter(Boolean));
}
```

## 3. 設計原則

### 3.1 SOLID原則の適用

#### 3.1.1 単一責任原則 (SRP)
```typescript
// ✅ 各クラスが単一の責任を持つ
class FileScanner {
  scanDirectory(path: string): Promise<string[]> {}
}

class DependencyAnalyzer {
  analyzeDependencies(files: string[]): Promise<IDependencyGraph> {}
}

class ReportGenerator {
  generateReport(data: IAnalysisResult): string {}
}
```

#### 3.1.2 依存関係逆転原則 (DIP)
```typescript
// ✅ 抽象に依存
interface IParser {
  parse(content: string): Promise<ASTNode>;
}

class ProjectAnalyzer {
  constructor(private readonly parser: IParser) {}
}

// 具象実装
class TreeSitterParser implements IParser {
  parse(content: string): Promise<ASTNode> {}
}
```

### 3.2 設定駆動設計

#### 3.2.1 外部設定による動作制御
```typescript
interface IAnalysisConfig {
  maxFileSize: number;
  supportedExtensions: string[];
  excludePatterns: string[];
  analysisDepth: number;
}

class ConfigurableAnalyzer {
  constructor(private readonly config: IAnalysisConfig) {}
  
  shouldAnalyzeFile(filePath: string): boolean {
    return this.config.supportedExtensions.some(ext => 
      filePath.endsWith(ext)
    );
  }
}
```

## 4. テスト戦略

### 4.1 テストの分類と比率
- **ユニットテスト**: 70% - 各関数・クラスの個別テスト
- **統合テスト**: 20% - コンポーネント間連携テスト
- **E2Eテスト**: 10% - MCP通信を含む全体テスト

### 4.2 テスト命名規則
```typescript
describe('DependencyAnalyzer', () => {
  describe('analyzeDependencies', () => {
    it('should return empty graph for project with no dependencies', () => {});
    it('should detect circular dependencies', () => {});
    it('should handle malformed package.json gracefully', () => {});
  });
});
```

### 4.3 テストデータ管理
```typescript
// テスト用フィクスチャの管理
const FIXTURES = {
  SIMPLE_JS_PROJECT: '/tests/fixtures/simple-js',
  COMPLEX_TS_PROJECT: '/tests/fixtures/complex-ts',
  PYTHON_PROJECT: '/tests/fixtures/python-flask'
} as const;
```

## 5. パフォーマンス要件

### 5.1 処理時間制限
- **小規模プロジェクト** (< 100ファイル): 5秒以内
- **中規模プロジェクト** (< 1,000ファイル): 30秒以内
- **大規模プロジェクト** (< 10,000ファイル): 5分以内

### 5.2 メモリ使用量制限
- **最大メモリ使用量**: 512MB
- **ストリーミング処理**: 100MB以上のファイルは分割処理

### 5.3 パフォーマンス測定
```typescript
class PerformanceMonitor {
  measureAnalysisTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    return { result, duration };
  }
}
```

## 6. ログ・デバッグ戦略

### 6.1 ログレベル定義
```typescript
enum LogLevel {
  ERROR = 0,   // システムエラー、処理継続不可
  WARN = 1,    // 警告、処理は継続可能
  INFO = 2,    // 一般的な情報
  DEBUG = 3,   // デバッグ情報
  TRACE = 4    // 詳細トレース情報
}
```

### 6.2 構造化ログ
```typescript
interface ILogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: {
    projectPath?: string;
    fileName?: string;
    analysisType?: string;
    duration?: number;
    error?: Error;
  };
}
```

## 7. セキュリティ要件

### 7.1 ファイルアクセス制限
- 指定されたプロジェクトディレクトリ外へのアクセス禁止
- シンボリックリンクの追跡制限
- 実行可能ファイルの実行禁止

### 7.2 入力検証
```typescript
function validateProjectPath(path: string): Result<string, ValidationError> {
  if (!path || typeof path !== 'string') {
    return { success: false, error: new ValidationError('Invalid path format') };
  }
  
  if (path.includes('..') || !isWithinAllowedDirectory(path)) {
    return { success: false, error: new ValidationError('Path traversal detected') };
  }
  
  return { success: true, data: path };
}
```

## 8. リリース・バージョニング戦略

### 8.1 セマンティックバージョニング
- **MAJOR**: 破壊的変更
- **MINOR**: 後方互換性のある機能追加
- **PATCH**: 後方互換性のあるバグ修正

### 8.2 ブランチ戦略
- **main**: 本番用安定版
- **develop**: 開発統合ブランチ
- **feature/***: 機能開発ブランチ
- **hotfix/***: 緊急修正ブランチ

## 9. ドキュメント要件

### 9.1 必須ドキュメント
- **README.md**: プロジェクト概要・セットアップ手順
- **API.md**: MCPツール・リソースの仕様
- **CONTRIBUTING.md**: 開発貢献ガイドライン
- **CHANGELOG.md**: バージョン別変更履歴

### 9.2 コードドキュメント
```typescript
/**
 * プロジェクトの依存関係を分析し、循環依存を検出する
 * 
 * @param projectPath - 分析対象プロジェクトのルートパス
 * @param options - 分析オプション（深度、除外パターンなど）
 * @returns 依存関係グラフと循環依存リスト
 * 
 * @throws {AnalysisError} プロジェクトが存在しない、または読み取り不可の場合
 * @throws {ParsingError} 依存関係ファイルの解析に失敗した場合
 * 
 * @example
 * ```typescript
 * const result = await analyzeDependencies('/path/to/project', {
 *   maxDepth: 5,
 *   excludePatterns: ['node_modules/**']
 * });
 * console.log(`Found ${result.circularDependencies.length} circular dependencies`);
 * ```
 */
async function analyzeDependencies(
  projectPath: string,
  options: IAnalysisOptions = {}
): Promise<IDependencyAnalysisResult> {}
```

---

**最終更新**: 2024-12-20
**承認者**: [開発中]
**適用開始**: 開発開始時より