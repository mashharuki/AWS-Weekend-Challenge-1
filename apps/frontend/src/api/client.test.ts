import assert from "node:assert/strict";
import test from "node:test";
import { loadDashboard } from "../state/dashboard.js";
import { ApiClientError, createApiClient } from "./client.js";

const postId = "018a9f3a-5d6e-7f80-9a0b-1c2d3e4f5a6b";
const publishedAt = "2026-08-23T00:00:00.000Z";

test("API クライアントは読み取り API を型付き DTO に変換する", async () => {
  const requests: string[] = [];
  const client = createApiClient(async (path) => {
    requests.push(path);
    return Response.json([{ postId, title: "Build a checklist", publishedAt }]);
  });

  assert.deepEqual(await client.listPosts(), [
    { postId, title: "Build a checklist", publishedAt },
  ]);
  assert.deepEqual(requests, ["/api/posts"]);
});

test("API クライアントは不正な応答と HTTP 失敗を公開 DTO として扱わない", async () => {
  const invalid = createApiClient(async () =>
    Response.json({ title: "missing id" }),
  );
  await assert.rejects(() => invalid.getPost(postId), ApiClientError);

  const unavailable = createApiClient(async () =>
    Response.json({ code: "INTERNAL_ERROR" }, { status: 500 }),
  );
  await assert.rejects(() => unavailable.getLatestRun(), ApiClientError);
});

test("投稿成功時は実行状態の失敗にかかわらず ready を返し、空・失敗を分離する", async () => {
  const ready = await loadDashboard({
    listPosts: async () => [
      { postId, title: "Build a checklist", publishedAt },
    ],
    getPost: async () => {
      throw new Error("not used");
    },
    getLatestRun: async () => {
      throw new ApiClientError("Unavailable");
    },
  });
  assert.deepEqual(ready, {
    posts: {
      status: "ready",
      posts: [{ postId, title: "Build a checklist", publishedAt }],
    },
    latestRun: null,
  });

  const empty = await loadDashboard({
    listPosts: async () => [],
    getPost: async () => {
      throw new Error("not used");
    },
    getLatestRun: async () => null,
  });
  assert.deepEqual(empty, {
    posts: { status: "empty" },
    latestRun: null,
  });

  const failed = await loadDashboard({
    listPosts: async () => {
      throw new ApiClientError("Unavailable");
    },
    getPost: async () => {
      throw new Error("not used");
    },
    getLatestRun: async () => null,
  });
  assert.deepEqual(failed, {
    posts: { status: "error", message: "Unable to load posts." },
    latestRun: null,
  });
});
