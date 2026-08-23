# 技術スタック

## アーキテクチャ

pnpm ワークスペースによる TypeScript モノレポで、React/Vite のブラウザ UI、Hono を使う Lambda 向け API、AWS CDK によるインフラストラクチャを分離する。完成形では EventBridge の定期起動から Step Functions のエージェントワークフローを実行し、生成済み Markdown を永続化して API/UI から参照する。

現時点で実装済みの基盤は、Vite/React UI、Hono の Lambda ハンドラー、CDK Stack の雛形である。Bedrock、Step Functions、EventBridge、DynamoDB などは企画で採用が決まっているが、まだ CDK に実装されていない。

## コア技術

- **言語**: TypeScript（各アプリで strict 設定）
- **パッケージ管理**: pnpm 10 ワークスペース
- **フロントエンド**: React 19、Vite 8
- **API**: Hono 4 と `hono/aws-lambda`
- **インフラ**: AWS CDK v2、Constructs
- **バンドル**: esbuild（Lambda を Node.js 20 向けにバンドル）

## 開発標準

### 型安全性

新規コードは TypeScript の strict なコンパイラ設定を維持し、型を明示する。フロントエンドは `noUnusedLocals` と `noUnusedParameters` を有効にしているため、未使用の定義を残さない。

### コード品質

リポジトリ全体の整形・静的解析は Biome を基本とし、ダブルクォートとスペースインデントを使用する。依存関係・未使用コードは Knip、重複は jscpd で確認する。フロントエンド固有の lint は Oxlint を使用する。

### テスト

CDK パッケージは Jest と `ts-jest` を使う。インフラを追加・変更するときは、CloudFormation テンプレートのアサーションをテストに追加する。現状のテストは CDK 雛形由来であり、実リソースの検証は未実装である。

## 開発環境

### 必要ツール

- Node.js 20 以上（バックエンドのビルドターゲット）
- pnpm 10.32.1
- AWS CDK CLI と、デプロイ対象アカウントの AWS 認証情報

### よく使うコマンド

```bash
# リポジトリ全体を整形
pnpm format

# リポジトリ全体を検査・自動修正
pnpm check

# フロントエンドを開発起動
pnpm --filter frontend dev

# Lambda 用バックエンドをビルド
pnpm --filter backend build

# CDK をビルド・テスト
pnpm --filter cdk build
pnpm --filter cdk test
```

## 主要な技術判断

- 自律実行の制御は、単発の HTTP リクエストではなく EventBridge と Step Functions に委譲する。
- 生成処理は Amazon Bedrock の Nova モデルを利用する前提とし、生成・保存・配信の責務を分離する。
- AWS リソースの定義は CDK に集約し、デプロイ対象の設定・論理 ID はコードから分離した外部設定で管理する方針である。
- 機密値は Secret Manager で管理し、ソースコード・ステアリング・ログに含めない。

---

_依存関係の全一覧ではなく、開発上の判断と繰り返し適用する標準を記録する。_
