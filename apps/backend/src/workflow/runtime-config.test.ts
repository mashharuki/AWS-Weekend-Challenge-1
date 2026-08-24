import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkflowRuntimeConfig } from "./runtime-config.js";

const environment = {
  ALLOWED_SOURCE_ORIGINS: "https://aws.amazon.com,https://docs.aws.amazon.com",
  BEDROCK_MODEL_ID: "amazon.nova-lite-v1:0",
  CONTENT_BUCKET_NAME: "content-bucket",
  CONTENT_TABLE_NAME: "content-table",
  GUARDRAIL_IDENTIFIER: "guardrail-id",
  GUARDRAIL_VERSION: "DRAFT",
};

test("必須のワークフロー実行設定を解析する", () => {
  const config = parseWorkflowRuntimeConfig(environment);

  assert.deepEqual(config.allowedSourceOrigins, [
    "https://aws.amazon.com",
    "https://docs.aws.amazon.com",
  ]);
  assert.equal(config.contentTableName, "content-table");
});

test("必須設定が欠ける場合は安全に失敗する", () => {
  const { CONTENT_BUCKET_NAME: _, ...missingBucket } = environment;

  assert.throws(
    () => parseWorkflowRuntimeConfig(missingBucket),
    /CONTENT_BUCKET_NAME/,
  );
});
