# プロジェクト分析MCPサーバー - 要件定義書

## 1. プロジェクト概要

### 1.1 目的
Claude等のAIアシスタントが任意のプロジェクトを深く理解し、より質の高いコード支援を提供するためのMCPサーバー。

### 1.2 ターゲットユーザー
- AIアシスタント（Claude）
- 開発者（間接的なエンドユーザー）

### 1.3 スコープ
- コードベース分析・可視化
- アーキテクチャ理解支援
- 技術的な意思決定支援

## 2. 機能要件

### 2.1 Core Analysis Functions

#### 2.1.1 プロジェクト構造分析
- **機能**: ディレクトリ構造とファイル組織の分析
- **入力**: プロジェクトルートパス
- **出力**: 
  - ファイル/ディレクトリツリー
  - ファイルタイプ分布
  - プロジェクト規模メトリクス
- **優先度**: 高

#### 2.1.2 言語・技術スタック検出
- **機能**: 使用されている言語、フレームワーク、ライブラリの特定
- **入力**: プロジェクトパス
- **出力**:
  - 主要言語とその使用率
  - フレームワーク一覧
  - 依存関係マップ
- **優先度**: 高

#### 2.1.3 依存関係分析
- **機能**: モジュール間、ファイル間の依存関係を分析
- **入力**: プロジェクトパス、解析対象ファイルパターン
- **出力**:
  - 依存関係グラフ（Mermaid形式）
  - 循環依存の検出
  - 結合度・凝集度メトリクス
- **優先度**: 高

#### 2.1.4 アーキテクチャパターン検出
- **機能**: アーキテクチャパターンの自動識別
- **パターン例**:
  - MVC, MVP, MVVM
  - Layered Architecture
  - Microservices
  - Component-based
- **出力**: 検出されたパターンとその適合度
- **優先度**: 中

### 2.2 Code Quality Analysis

#### 2.2.1 複雑度メトリクス
- **機能**: コード複雑度の測定
- **メトリクス**:
  - 循環的複雑度
  - 認知的複雑度
  - 継承の深さ
  - 結合度
- **優先度**: 中

#### 2.2.2 ホットスポット特定
- **機能**: 変更頻度とコード複雑度から問題箇所を特定
- **入力**: Gitログ + コードメトリクス
- **出力**: リファクタリング候補ファイル一覧
- **優先度**: 中

### 2.3 Visualization Functions

#### 2.3.1 アーキテクチャ図生成
- **機能**: プロジェクト構造の可視化
- **フォーマット**: Mermaid, PlantUML, DOT
- **図の種類**:
  - コンポーネント図
  - 依存関係図
  - データフロー図
- **優先度**: 高

#### 2.3.2 インタラクティブ探索
- **機能**: 特定ファイル/モジュールからの影響範囲可視化
- **入力**: ファイルパス、分析深度
- **出力**: 影響を受けるファイル一覧 + 可視化
- **優先度**: 低

### 2.4 Reporting Functions

#### 2.4.1 プロジェクト概要レポート
- **機能**: プロジェクト全体の状況を簡潔にまとめたレポート
- **内容**:
  - 技術スタック
  - アーキテクチャ概要
  - 主要コンポーネント
  - 推奨改善点
- **優先度**: 高

#### 2.4.2 技術的借金レポート
- **機能**: 技術的問題の特定と優先度付け
- **内容**:
  - 複雑度が高いファイル
  - 循環依存
  - アーキテクチャ違反
- **優先度**: 低

## 3. 非機能要件

### 3.1 パフォーマンス
- **大規模プロジェクト対応**: 10,000ファイル以下で5分以内
- **中規模プロジェクト**: 1,000ファイル以下で30秒以内
- **小規模プロジェクト**: 100ファイル以下で5秒以内

### 3.2 対応言語
**Phase 1 (MVP)**:
- JavaScript/TypeScript
- Python
- Java

**Phase 2**:
- Go
- Rust
- C#
- PHP

### 3.3 対応プロジェクト形式
- Node.js (package.json)
- Python (requirements.txt, pyproject.toml)
- Java (pom.xml, build.gradle)
- モノレポ構造

### 3.4 拡張性
- プラガブルなアナライザー設計
- 新言語の容易な追加
- カスタムルールの設定可能

## 4. MCPインターフェース仕様

### 4.1 提供ツール

#### 4.1.1 analyze_project
```typescript
{
  name: "analyze_project",
  description: "プロジェクト全体を分析し、構造・技術スタック・依存関係を把握",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string", description: "分析対象のプロジェクトルートパス" },
      depth: { type: "number", default: 3, description: "分析の深度レベル" },
      includePatterns: { type: "array", items: { type: "string" }, description: "含めるファイルパターン" },
      excludePatterns: { type: "array", items: { type: "string" }, description: "除外するファイルパターン" }
    },
    required: ["projectPath"]
  }
}
```

#### 4.1.2 generate_architecture_diagram
```typescript
{
  name: "generate_architecture_diagram",
  description: "アーキテクチャ図をMermaid形式で生成",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      diagramType: { type: "string", enum: ["component", "dependency", "layered"], default: "component" },
      format: { type: "string", enum: ["mermaid", "plantuml"], default: "mermaid" },
      maxNodes: { type: "number", default: 50, description: "図に含める最大ノード数" }
    },
    required: ["projectPath"]
  }
}
```

#### 4.1.3 analyze_dependencies
```typescript
{
  name: "analyze_dependencies",
  description: "依存関係を詳細分析し、循環依存や結合度を評価",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      targetFiles: { type: "array", items: { type: "string" }, description: "分析対象ファイル（省略時は全ファイル）" },
      includeExternal: { type: "boolean", default: false, description: "外部依存関係も含めるか" }
    },
    required: ["projectPath"]
  }
}
```

#### 4.1.4 trace_impact
```typescript
{
  name: "trace_impact",
  description: "特定ファイルの変更が与える影響範囲を分析",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      targetFile: { type: "string", description: "影響分析の起点となるファイル" },
      direction: { type: "string", enum: ["incoming", "outgoing", "both"], default: "both" },
      maxDepth: { type: "number", default: 3, description: "追跡する依存関係の深度" }
    },
    required: ["projectPath", "targetFile"]
  }
}
```

#### 4.1.5 detect_patterns
```typescript
{
  name: "detect_patterns",
  description: "アーキテクチャパターンやデザインパターンを検出",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      patternTypes: { type: "array", items: { type: "string" }, description: "検出するパターンタイプ" }
    },
    required: ["projectPath"]
  }
}
```

### 4.2 リソース仕様

#### 4.2.1 analysis_cache
- **タイプ**: プロジェクト分析結果のキャッシュ
- **URI形式**: `analysis://project/{project_id}/cache`
- **内容**: 分析結果のJSONデータ

#### 4.2.2 project_metadata
- **タイプ**: プロジェクトメタデータ
- **URI形式**: `analysis://project/{project_id}/metadata`
- **内容**: プロジェクト基本情報

## 5. 成功基準

### 5.1 機能的成功基準
- [ ] TypeScript/JavaScript プロジェクトの構造を正確に分析できる
- [ ] 依存関係グラフを生成できる
- [ ] Mermaid形式のアーキテクチャ図を生成できる
- [ ] 主要フレームワーク（React, Vue, Express, Next.js）を識別できる

### 5.2 品質基準
- [ ] 1000ファイル規模のプロジェクトを30秒以内で分析
- [ ] 分析精度 > 85%（手動レビューとの比較）
- [ ] メモリ使用量 < 512MB（大規模プロジェクト時）

### 5.3 使いやすさ基準
- [ ] Claude から直感的に利用できるツール設計
- [ ] エラーメッセージが分かりやすい
- [ ] 段階的な詳細化が可能（概要→詳細）

## 6. 制約・前提条件

### 6.1 技術制約
- Node.js 18+ 環境で動作
- MCP Protocol 1.0 準拠
- ファイルシステムアクセス権限が必要

### 6.2 前提条件
- 分析対象プロジェクトは読み取り可能
- プロジェクトが一般的な構造に従っている
- Git履歴が利用可能（一部機能）

## 7. 除外項目（スコープ外）

- リアルタイム監視機能
- プロジェクト修正・リファクタリング実行
- IDE統合機能
- Webインターフェース
- 複数プロジェクト間の比較分析
- パフォーマンスプロファイリング
- セキュリティ脆弱性検出（別サーバーの担当）

---

**最終更新**: 2024-12-20
**承認者**: [検討中]
**次回レビュー**: MVP完成時