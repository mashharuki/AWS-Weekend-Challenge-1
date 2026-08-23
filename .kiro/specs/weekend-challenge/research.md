# 調査・設計判断ログ

## Summary

- **Feature**: `weekend-challenge`
- **Discovery Scope**: Complex Integration / 新規機能
- **Key Findings**:
  - EventBridge Scheduler は Step Functions の `StartExecution` を定期ターゲットにでき、失敗時の再試行・保持も設定できる。
  - Step Functions は Bedrock の `InvokeModel` 統合を持つが、外部情報取得・Strands によるエージェント実行・ドメイン検証をまとめるため、ワークフローから Lambda のエージェント境界を呼び出す。
  - 既存リポジトリには React/Vite、Hono Lambda、CDK の雛形だけがあり、新機能はそれらのアプリ境界を保ったまま追加できる。

## Research Log

### EventBridge Scheduler と Step Functions

- **Context**: 日次で、利用者の操作なしにワークフローを開始する必要がある。
- **Sources Consulted**: [AWS Step Functions: EventBridge Scheduler での起動](https://docs.aws.amazon.com/step-functions/latest/dg/using-eventbridge-scheduler.html)、[EventBridge Scheduler のテンプレートターゲット](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-targets-templated.html)
- **Findings**: Scheduler は cron/rate とタイムゾーンを持つ定期スケジュールから Step Functions `StartExecution` を実行でき、ターゲット呼び出し用ロールが必要である。Scheduler 自身がターゲットを起動できない場合は、ワークフローに到達しないため retry policy と SQS DLQ が必要である。
- **Implications**: スケジュールを唯一の自動起点とし、開始 Lambda の条件付き書込みで同日重複を抑止する。起動前失敗は Scheduler の retry policy、SQS DLQ、CloudWatch Alarm で追跡し、起動後失敗はワークフロー内の `RecordFailure` に収束させる。

### Bedrock とエージェントの実行境界

- **Context**: Nova を使い、情報収集と英語 Markdown の生成を行う必要がある。
- **Sources Consulted**: [Step Functions の Bedrock 統合](https://docs.aws.amazon.com/step-functions/latest/dg/connect-bedrock.html)、[Amazon Nova のモデル利用可能リージョン](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html)、[Strands Agents SDK の TypeScript 例](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-code-deploy-node.html)
- **Findings**: Step Functions の Bedrock 統合ではペイロード制限とモデル固有の Body がある。Nova Lite は東京リージョンを含む複数リージョンで利用可能だが、モデル可用性はリージョンごとに確認が必要である。Strands の TypeScript SDK は Node.js で利用できる。
- **Implications**: エージェント Lambda は、許可済みの公開ソースを収集し、サイズ上限を設けた正規化入力を Strands/Nova に渡す。モデル ID は環境設定として注入し、デプロイ前に対象リージョンのモデルアクセスを確認する。

### 外部コンテンツと prompt injection

- **Context**: エージェントが公開 Web 情報を取得してモデル入力へ渡すため、外部本文を命令として解釈させない必要がある。
- **Sources Consulted**: [Amazon Bedrock Guardrails の prompt attack 検出](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-prompt-attack.html)、[Bedrock の prompt injection security](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-injection.html)
- **Findings**: Guardrails は prompt injection を検出でき、保護対象となる入力を明示的に区別して検査できる。アプリケーション側には prompt injection を防ぐ責任がある。
- **Implications**: 外部本文は untrusted context に隔離し、システム指示・ツール定義と混在させない。Guardrails の拒否または検査不能時は入力を除外し、出力にも検査を適用して投稿しない。

### サーバーレス Web 配信と CDK

- **Context**: 最小コストで、公開 UI と読み取り API を安全に配備する必要がある。
- **Sources Consulted**: [AWS Well-Architected Serverless Lens: Web application](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/web-application.html)、[CDK ベストプラクティス](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)、[Lambda ベストプラクティス](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- **Findings**: S3 + CloudFront は静的 SPA、API Gateway + Lambda + DynamoDB はサーバーレス Web API の標準的な構成である。CDK は論理的な構成を Construct にまとめ、Stack は配備単位として扱うことを推奨する。Lambda は SDK クライアントをハンドラー外で初期化する。
- **Implications**: 単一の小規模 Stack に、Web、API、コンテンツ、ワークフローの Construct を合成する。ブラウザから書込み経路を公開せず、S3 は CloudFront のみが読めるようにする。

### ワークフロー障害への対応

- **Context**: 不完全な生成を公開せず、障害証跡を残す必要がある。
- **Sources Consulted**: [Step Functions のエラー処理](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html)
- **Findings**: Task 状態には `Retry` と `Catch` を設定できる。`States.ALL` では捕捉できない終端エラーもあるため、入力サイズを制限し、個別の失敗記録を持つ必要がある。
- **Implications**: 外部取得・モデル呼出しは指数バックオフ付き再試行とし、失敗時は `RecordFailure` に遷移する。公開フラグは検証済みの保存完了時のみ `published` に変える。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|---|---|---|---|---|
| Lambda だけの定期バッチ | スケジュールから単一 Lambda を起動 | 最小の部品数 | 段階別の証跡・再試行・障害分岐が不明瞭 | 不採用 |
| Step Functions + Lambda エージェント | Scheduler が標準ワークフローを開始し、各責務を Lambda に分離 | 自律実行、状態遷移、証跡、失敗処理が明確 | Lambda と状態機械の権限設定が必要 | 採用 |
| Step Functions から Bedrock を直接呼出す | 収集以外をサービス統合で実装 | 呼出し部品を削減できる | Strands エージェントと複数の検証・保存境界を表しにくい | 将来の最適化候補 |

## Design Decisions

### Decision: 単一 Stack と用途別 Construct

- **Context**: 週末の最小実装で、配備・削除は一括で完了させる必要がある。
- **Alternatives Considered**:
  1. Web、データ、ワークフローを別 Stack に分割する。
  2. 単一 Stack に用途別 Construct を合成する。
- **Selected Approach**: 1 Stack に `WebDelivery`、`ContentStore`、`GenerationWorkflow`、`PublicApi` Construct を合成する。
- **Rationale**: ライフサイクルが同じで、クロススタック参照を避け、削除漏れを防げる。
- **Trade-offs**: 将来の独立配備性は低い。規模または環境数が増えた時点で Stack 分割を再評価する。
- **Follow-up**: CDK assertions と `cdk-nag` で資源構成・例外を検証する。

### Decision: S3 本文 + DynamoDB インデックス

- **Context**: Markdown 本文と実行証跡を、閲覧と監査の両方に適した形で保存する必要がある。
- **Alternatives Considered**:
  1. すべてを DynamoDB に保存する。
  2. すべてを S3 オブジェクトで保存する。
  3. 本文を S3、一覧・実行状態を DynamoDB に保存する。
- **Selected Approach**: 3 を採用する。
- **Rationale**: サイズのある Markdown をオブジェクトとして扱い、最新一覧と実行証跡はキー検索可能に保てる。
- **Trade-offs**: 2 ストア間の整合性を公開状態で制御する必要がある。
- **Follow-up**: 本文保存後にのみ、DynamoDB `TransactWriteItems` で投稿を `published`、実行を `succeeded` に同時確定する。失敗時は非公開にする。

### Decision: 公開 API は読み取り専用

- **Context**: 認証を対象外としつつ、公開アプリケーションの攻撃面を小さくする必要がある。
- **Alternatives Considered**:
  1. UI から手動生成・編集もできる API。
  2. 投稿と実行記録を読む API のみを公開する。
- **Selected Approach**: 2 を採用する。
- **Rationale**: 自律生成という要件に集中し、書込み権限をワークフロー専用ロールへ閉じ込める。
- **Trade-offs**: 手動再生成・編集は提供しない。
- **Follow-up**: API は認証なしの公開読み取りと明示する。CORS をアクセス制御に使わず、HTTP API の route throttling、Read Lambda の予約同時実行数、CloudFront 経由の同一オリジン経路で影響範囲を限定する。

## Risks & Mitigations

- 対象リージョンで Nova が利用できない、またはアクセス未承認 — CDK 設定でモデル ID を注入し、配備前確認を手順化する。
- 外部ソースの形式変更・一時障害 — ソースを許可リスト化し、個別タイムアウト、サイズ上限、再試行、十分な候補がない場合の非公開失敗を設ける。
- LLM が不正な形式、危険な Markdown、または外部本文に含まれる指示へ追従する — Guardrails、untrusted context の分離、Zod による構造検証、Markdown の HTML 無効化、保存前検査を行う。
- Scheduler 自身が StateMachine を起動できない — retry policy、SQS DLQ、DLQ/ターゲットエラーメトリクスのアラームを設定する。
- Scheduler の再送または運用上の再実行 — 日付ベースの条件付き実行記録で冪等にする。
- 削除時にデータが残る — 開発・チャレンジ環境では明示した削除ポリシーとロググループの削除を assertions で検証する。

## References

- [EventBridge Scheduler で Step Functions を開始する](https://docs.aws.amazon.com/step-functions/latest/dg/using-eventbridge-scheduler.html)
- [EventBridge Scheduler の DLQ](https://docs.aws.amazon.com/scheduler/latest/UserGuide/configuring-schedule-dlq.html)
- [Step Functions から Amazon Bedrock を呼び出す](https://docs.aws.amazon.com/step-functions/latest/dg/connect-bedrock.html)
- [Amazon Bedrock モデルのリージョン可用性](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html)
- [AWS CDK のベストプラクティス](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
- [Step Functions のエラー処理](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html)
- [Amazon Bedrock Guardrails の prompt attack 検出](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-prompt-attack.html)
