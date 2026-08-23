import assert from "node:assert/strict";
import test from "node:test";
import {
  appConfigSchema,
  draftPostSchema,
  generationErrorSchema,
  generationRunSchema,
  postDetailSchema,
} from "./contracts.js";

const runId = "2026-08-23";
const postId = "6c55db8d-dfc6-4271-9a13-7a4f8f35d4f8";
const occurredAt = "2026-08-23T00:00:00.000Z";

test("shared schemas accept the valid generation and published-post contracts", () => {
  const run = generationRunSchema.parse({
    runId,
    status: "SUCCEEDED",
    scheduledAt: occurredAt,
    completedAt: occurredAt,
    postId,
  });
  const draft = draftPostSchema.parse({
    runId,
    title: "A practical idea",
    markdown: "# A practical idea\n\nBuild a useful demo.",
    sourceUrls: ["https://aws.amazon.com/blogs/aws/"],
    generatedAt: occurredAt,
  });
  const post = postDetailSchema.parse({
    postId,
    title: draft.title,
    publishedAt: occurredAt,
    markdown: draft.markdown,
    sourceUrls: draft.sourceUrls,
  });

  assert.equal(run.status, "SUCCEEDED");
  assert.equal(post.postId, postId);
});

test("shared schemas reject unsafe or malformed boundary values", () => {
  assert.throws(() =>
    draftPostSchema.parse({
      runId,
      title: "Unsafe draft",
      markdown: "<script>alert('unsafe')</script>",
      sourceUrls: ["http://example.com/source"],
      generatedAt: "not-a-timestamp",
    }),
  );
  assert.throws(() =>
    appConfigSchema.parse({
      environment: "challenge",
      timezone: "Asia/Tokyo",
      scheduleExpression: "cron(0 9 * * ? *)",
      bedrockModelId: "amazon.nova-lite-v1:0",
      allowedSourceOrigins: ["http://example.com"],
      logRetentionDays: 14,
    }),
  );
  assert.throws(() =>
    generationErrorSchema.parse({
      code: "UNKNOWN_FAILURE",
      message: "internal details must not be exposed",
      retriable: false,
    }),
  );
});
