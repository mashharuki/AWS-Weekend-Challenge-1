import assert from "node:assert/strict";
import test from "node:test";
import type {
  GenerationRun,
  PostSummary,
  PublishedPost,
} from "../shared/contracts.js";
import { createReadApi } from "./read-api.js";

const postId = "018a9f3a-5d6e-7f80-9a0b-1c2d3e4f5a6b";
const publishedAt = "2026-08-23T00:00:00.000Z";
const summary: PostSummary = {
  postId,
  title: "Build an AWS checklist",
  publishedAt,
};
const published: PublishedPost = {
  ...summary,
  sourceUrls: ["https://aws.amazon.com/blogs/aws/example"],
};
const run: GenerationRun = {
  runId: "2026-08-23",
  status: "SUCCEEDED",
  scheduledAt: publishedAt,
  completedAt: publishedAt,
  postId,
};

const createApp = () => {
  const calls = { list: 0, get: 0, markdown: 0, latestRun: 0 };
  const app = createReadApi({
    posts: {
      listPublished: async () => {
        calls.list += 1;
        return [summary];
      },
      getPublished: async () => {
        calls.get += 1;
        return published;
      },
    },
    markdown: {
      getPublished: async () => {
        calls.markdown += 1;
        return "# Checklist\n\nBuild a useful checklist.";
      },
    },
    runs: {
      getLatestRun: async () => {
        calls.latestRun += 1;
        return run;
      },
    },
  });
  return { app, calls };
};

test("公開投稿一覧は limit を検証して、公開用の要約だけを返す", async () => {
  const { app, calls } = createApp();

  const response = await app.request("http://localhost/api/posts?limit=2");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [summary]);
  assert.equal(calls.list, 1);

  const invalid = await app.request("http://localhost/api/posts?limit=21");
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), {
    code: "BAD_REQUEST",
    message: "Invalid request.",
  });
});

test("公開投稿詳細は本文を結合し、非公開または不存在は公開しない", async () => {
  const { app, calls } = createApp();

  const response = await app.request(`http://localhost/api/posts/${postId}`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ...published,
    markdown: "# Checklist\n\nBuild a useful checklist.",
  });
  assert.deepEqual(calls, { list: 0, get: 1, markdown: 1, latestRun: 0 });

  const missingApp = createReadApi({
    posts: { listPublished: async () => [], getPublished: async () => null },
    markdown: { getPublished: async () => "unreachable" },
    runs: { getLatestRun: async () => null },
  });
  const missing = await missingApp.request(
    `http://localhost/api/posts/${postId}`,
  );
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    code: "NOT_FOUND",
    message: "Post not found.",
  });
});

test("ヘルスチェックと最新実行状態を提供し、書込みルートは公開しない", async () => {
  const { app, calls } = createApp();

  assert.deepEqual(
    await (await app.request("http://localhost/health")).json(),
    {
      status: "ok",
    },
  );
  assert.deepEqual(
    await (await app.request("http://localhost/api/runs/latest")).json(),
    run,
  );
  assert.equal(calls.latestRun, 1);
  assert.equal(
    (await app.request("http://localhost/api/posts", { method: "POST" }))
      .status,
    404,
  );
});
