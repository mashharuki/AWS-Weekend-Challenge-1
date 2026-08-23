import assert from "node:assert/strict";
import test from "node:test";
import { GenerationFailure } from "../generation/generation-error.js";
import type {
  DraftPost,
  GenerationError,
  PublishedPost,
  SourceDocument,
} from "../shared/contracts.js";
import {
  createRecordFailureHandler,
  createResearchHandler,
  createStartRunHandler,
  createValidatePublishHandler,
  GenerationWorkflow,
  type WorkflowLogEvent,
} from "./handlers.js";
import { createStateMachineDefinition } from "./state-machine-definition.js";

const scheduledAt = "2026-08-23T00:00:00.000Z";
const runId = "2026-08-23";
const source: SourceDocument = {
  url: "https://aws.amazon.com/blogs/aws/example",
  title: "AWS update",
  excerpt: "A practical update for builders.",
};
const draft: DraftPost = {
  runId,
  title: "Build an AWS checklist",
  markdown: "# Checklist\n\nBuild a useful checklist.",
  sourceUrls: [source.url],
  generatedAt: scheduledAt,
};
const post: PublishedPost = {
  postId: "018a9f3a-5d6e-7f80-9a0b-1c2d3e4f5a6b",
  title: draft.title,
  publishedAt: scheduledAt,
  sourceUrls: draft.sourceUrls,
};

const createDependencies = () => {
  const logs: WorkflowLogEvent[] = [];
  const failures: Array<{
    runId: string;
    error: GenerationError;
    stage: string;
  }> = [];
  let duplicate = false;
  let researchFailure: Error | undefined;

  const start = createStartRunHandler(
    {
      start: async () => ({ runId, isDuplicate: duplicate }),
    },
    (event) => logs.push(event),
    () => 10,
  );
  const research = createResearchHandler(
    {
      collect: async () => [source],
    },
    {
      generate: async () => {
        if (researchFailure) {
          throw researchFailure;
        }
        return draft;
      },
    },
    (event) => logs.push(event),
    () => 20,
  );
  const publish = createValidatePublishHandler(
    {
      publish: async () => post,
    },
    (event) => logs.push(event),
    () => 30,
  );
  const recordFailure = createRecordFailureHandler(
    {
      recordFailure: async (failedRunId, error, stage) => {
        failures.push({ runId: failedRunId, error, stage });
      },
    },
    (event) => logs.push(event),
    () => 40,
  );

  return {
    logs,
    failures,
    start,
    research,
    publish,
    recordFailure,
    setDuplicate(value: boolean) {
      duplicate = value;
    },
    setResearchFailure(value: Error | undefined) {
      researchFailure = value;
    },
  };
};

test("開始ハンドラーは重複を正常終了として、本文を含まない構造化ログを記録する", async () => {
  const dependencies = createDependencies();
  dependencies.setDuplicate(true);

  const result = await dependencies.start({
    scheduledAt,
    scheduleName: "daily",
  });

  assert.deepEqual(result, {
    scheduledAt,
    scheduleName: "daily",
    runId,
    isDuplicate: true,
  });
  assert.deepEqual(dependencies.logs, [
    {
      runId,
      stage: "START",
      status: "DUPLICATE",
      durationMs: 10,
    },
  ]);
});

test("ワークフローは成功時だけ公開し、収集・生成失敗を安全な失敗記録に変換する", async () => {
  const success = createDependencies();
  const workflow = new GenerationWorkflow(success);

  assert.deepEqual(
    await workflow.execute({ scheduledAt, scheduleName: "daily" }),
    { status: "PUBLISHED", post },
  );
  assert.equal(success.failures.length, 0);

  const failure = createDependencies();
  failure.setResearchFailure(new GenerationFailure("MODEL_THROTTLED", true));
  const failedWorkflow = new GenerationWorkflow(failure);

  assert.deepEqual(
    await failedWorkflow.execute({ scheduledAt, scheduleName: "daily" }),
    { status: "FAILED", runId, errorCode: "MODEL_THROTTLED" },
  );
  assert.deepEqual(failure.failures, [
    {
      runId,
      stage: "RESEARCH",
      error: {
        code: "MODEL_THROTTLED",
        message: "MODEL_THROTTLED",
        retriable: true,
      },
    },
  ]);
});

test("StateMachine 定義は重複分岐、限定再試行、失敗記録を持つ", () => {
  const definition = createStateMachineDefinition({
    startRunArn: "arn:aws:lambda:ap-northeast-1:123456789012:function:start",
    researchArn: "arn:aws:lambda:ap-northeast-1:123456789012:function:research",
    validatePublishArn:
      "arn:aws:lambda:ap-northeast-1:123456789012:function:publish",
    recordFailureArn:
      "arn:aws:lambda:ap-northeast-1:123456789012:function:failure",
  });

  assert.equal(definition.StartAt, "StartRun");
  assert.deepEqual(definition.States.CheckDuplicate, {
    Type: "Choice",
    Choices: [
      {
        Variable: "$.isDuplicate",
        BooleanEquals: true,
        Next: "DuplicateCompleted",
      },
    ],
    Default: "ResearchAgent",
  });
  assert.equal(definition.States.ResearchAgent.Retry?.[0]?.MaxAttempts, 2);
  assert.deepEqual(definition.States.ResearchAgent.Catch, [
    {
      ErrorEquals: ["States.ALL"],
      ResultPath: "$.failureContext",
      Next: "RecordResearchFailure",
    },
  ]);
  assert.deepEqual(definition.States.RecordPublishFailure, {
    Type: "Task",
    Resource: "arn:aws:states:::lambda:invoke",
    Parameters: {
      FunctionName:
        "arn:aws:lambda:ap-northeast-1:123456789012:function:failure",
      Payload: {
        "runId.$": "$.runId",
        failureStage: "VALIDATE_PUBLISH",
        error: {
          "code.$": "$.failureContext.Error",
          message: "Workflow execution failed",
          retriable: false,
        },
      },
    },
    End: true,
  });
});
