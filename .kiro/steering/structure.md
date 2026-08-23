# プロジェクト構造

## 構成方針

ワークスペースを実行境界ごとに分けるアプリケーション中心のモノレポである。UI、API、インフラを独立した `apps` 配下のパッケージとして保ち、各パッケージが自身のビルド・テスト設定を持つ。共通化が必要になった場合のみ `pkgs` 配下に共有パッケージを追加する。

## ディレクトリのパターン

### アプリケーション

**場所**: `/apps/<application>/`  
**目的**: デプロイまたは実行単位ごとのソース、設定、パッケージスクリプトを置く。  
**例**: `apps/frontend` は Vite UI、`apps/backend` は Lambda 向け Hono API、`apps/cdk` は AWS インフラを担当する。

### フロントエンドのエントリーポイント

**場所**: `/apps/frontend/src/`  
**目的**: React のマウント、画面コンポーネント、スタイルを置く。  
**例**: `main.tsx` で `StrictMode` とルートコンポーネントをマウントし、`App.tsx` を画面の起点とする。

### API ハンドラー

**場所**: `/apps/backend/src/`  
**目的**: Hono アプリケーションと Lambda ハンドラーを定義する。  
**例**: `index.ts` でルートを Hono に登録し、`handle(app)` を Lambda エクスポートへ変換する。

### インフラ定義

**場所**: `/apps/cdk/bin/` と `/apps/cdk/lib/`  
**目的**: `bin` に CDK アプリの起動、`lib` に Stack と Construct を置く。  
**例**: `bin/cdk.ts` が `CdkStack` を生成し、`lib/cdk-stack.ts` がリソース構成を定義する。

### プロジェクト資料

**場所**: `/docs/`  
**目的**: プロダクトの構想、実装計画、利用者向け資料などの Markdown を置く。  
**例**: `docs/idea.md` に課題、目標アーキテクチャ、チャレンジ要件を記録する。

## 命名規則

- **ファイル**: TypeScript/TSX は既存のエントリーポイント・設定ファイル名に合わせ、用途を示す kebab-case または標準ファイル名を使う。
- **React コンポーネント**: PascalCase の関数とし、既定エクスポートはページ・アプリの入口に限定する。
- **関数・変数**: camelCase を使う。
- **CDK Construct / Stack**: PascalCase のクラス名とし、役割を末尾に含める（例: `CdkStack`）。

## import の構成

外部依存を先に、同一アプリ内の相対 import を後に記述する。既存パッケージではパスエイリアスを定義していないため、アプリ境界内では相対 import を使用する。import の並び替えは Biome に委ねる。

```typescript
import { ExternalDependency } from "external-package";
import { localHelper } from "./local-helper";
```

## コード構成の原則

- UI、API、インフラの依存関係を一方向に保ち、フロントエンドが CDK 実装へ依存しないようにする。
- AWS のリソース設定・論理 ID は、Stack 内に散在させず外部設定へ集約する。
- エージェント処理はスケジュール、オーケストレーション、生成、保存、配信の責務に分ける。
- 実装前の構想や提出要件は `/docs` に置き、実行コードへ混在させない。

---

_ファイルツリーの網羅ではなく、同じ形で新しいコードを追加できる構造上の規則を記録する。_
