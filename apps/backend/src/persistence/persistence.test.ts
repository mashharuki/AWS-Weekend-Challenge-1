import assert from "node:assert/strict";
import test from "node:test";
import type { DraftPost, GenerationError } from "../shared/contracts.js";
import {
  type DynamoDbPersistencePort,
  DynamoDbRunPostRepository,
} from "./dynamodb-repository.js";
import { MarkdownStore, type ObjectStoragePort } from "./markdown-store.js";
import { PublishService } from "./publish-service.js";

const runId = "2026-08-23";
const postId = "6c55db8d-dfc6-4271-9a13-7a4f8f35d4f8";
const occurredAt = "2026-08-23T00:00:00.000Z";

const draft: DraftPost = {
  runId,
  title: "A practical idea",
  markdown: "# A practical idea\n\nBuild a useful demo.",
  sourceUrls: ["https://aws.amazon.com/blogs/aws/"],
  generatedAt: occurredAt,
};

class FakeDynamoDbPort implements DynamoDbPersistencePort {
  readonly runs = new Map<string, Record<string, unknown>>();
  readonly posts = new Map<string, Record<string, unknown>>();
  createRunCalls = 0;
  publishCalls = 0;
  failPublish = false;

  async createRun(item: Record<string, unknown>): Promise<void> {
    this.createRunCalls += 1;
    const itemRunId = String(item.runId);
    if (this.runs.has(itemRunId)) {
      throw { name: "ConditionalCheckFailedException" };
    }
    this.runs.set(itemRunId, item);
  }

  async getLatestRun(): Promise<readonly Record<string, unknown>[]> {
    return [...this.runs.values()];
  }

  async listPublished(): Promise<readonly Record<string, unknown>[]> {
    return [...this.posts.values()];
  }

  async getPost(
    postIdToFind: string,
  ): Promise<Record<string, unknown> | undefined> {
    return this.posts.get(postIdToFind);
  }

  async recordFailure(
    runIdToUpdate: string,
    error: GenerationError,
  ): Promise<void> {
    const run = this.runs.get(runIdToUpdate);
    if (!run) {
      throw { name: "ConditionalCheckFailedException" };
    }
    this.runs.set(runIdToUpdate, {
      ...run,
      status: "FAILED",
      failureStage: "RESEARCH",
      errorCode: error.code,
      completedAt: occurredAt,
    });
  }

  async publish(
    post: Record<string, unknown>,
    runIdToComplete: string,
  ): Promise<void> {
    this.publishCalls += 1;
    if (this.failPublish) {
      throw { name: "TransactionCanceledException" };
    }
    const run = this.runs.get(runIdToComplete);
    if (run?.status !== "RUNNING") {
      throw { name: "ConditionalCheckFailedException" };
    }
    this.posts.set(String(post.postId), post);
    this.runs.set(runIdToComplete, {
      ...run,
      status: "SUCCEEDED",
      completedAt: post.publishedAt,
      postId: post.postId,
    });
  }
}

class FakeObjectStoragePort implements ObjectStoragePort {
  readonly objects = new Map<string, { body: string; contentType: string }>();
  failPut = false;

  async putObject(input: {
    readonly bucket: string;
    readonly key: string;
    readonly body: string;
    readonly contentType: string;
  }): Promise<void> {
    if (this.failPut) {
      throw new Error("S3 unavailable");
    }
    this.objects.set(input.key, {
      body: input.body,
      contentType: input.contentType,
    });
  }

  async getObject(input: {
    readonly bucket: string;
    readonly key: string;
  }): Promise<{ readonly body: string; readonly contentType?: string }> {
    const object = this.objects.get(input.key);
    if (!object) {
      throw { name: "NoSuchKey" };
    }
    return object;
  }
}

test("同じ日付の開始は実行記録を一つだけ作り、重複として返す", async () => {
  const port = new FakeDynamoDbPort();
  const repository = new DynamoDbRunPostRepository(port);

  const first = await repository.start({
    scheduledAt: occurredAt,
    scheduleName: "daily-generation",
  });
  const duplicate = await repository.start({
    scheduledAt: occurredAt,
    scheduleName: "daily-generation",
  });

  assert.deepEqual(first, { runId, isDuplicate: false });
  assert.deepEqual(duplicate, { runId, isDuplicate: true });
  assert.equal(port.createRunCalls, 2);
  assert.equal(port.runs.size, 1);
});

test("公開済み以外の投稿は一覧・詳細から取得できない", async () => {
  const port = new FakeDynamoDbPort();
  const repository = new DynamoDbRunPostRepository(port);
  port.posts.set(postId, {
    postId,
    status: "DRAFT",
    title: draft.title,
    publishedAt: occurredAt,
    bodyKey: `posts/${postId}.md`,
    sourceUrls: draft.sourceUrls,
  });

  assert.deepEqual(await repository.listPublished(10), []);
  assert.equal(await repository.getPublished(postId), null);
});

test("公開成功時は Markdown を適切な content type で保存して公開状態を確定する", async () => {
  const dynamo = new FakeDynamoDbPort();
  const storage = new FakeObjectStoragePort();
  const repository = new DynamoDbRunPostRepository(dynamo);
  const store = new MarkdownStore("content-bucket", storage);
  const service = new PublishService(
    repository,
    store,
    () => postId,
    () => occurredAt,
  );

  await repository.start({
    scheduledAt: occurredAt,
    scheduleName: "daily-generation",
  });
  const published = await service.publish(draft);

  assert.equal(published.postId, postId);
  assert.deepEqual(await repository.listPublished(10), [
    { postId, title: draft.title, publishedAt: occurredAt },
  ]);
  assert.deepEqual(storage.objects.get(`posts/${postId}.md`), {
    body: draft.markdown,
    contentType: "text/markdown; charset=utf-8",
  });
});

test("本文ストアは不正な content type とサイズ超過の本文を返さない", async () => {
  const storage = new FakeObjectStoragePort();
  const store = new MarkdownStore("content-bucket", storage);
  storage.objects.set(`posts/${postId}.md`, {
    body: draft.markdown,
    contentType: "text/plain",
  });
  await assert.rejects(() => store.getPublished(postId));

  storage.objects.set(`posts/${postId}.md`, {
    body: "a".repeat(100_001),
    contentType: "text/markdown; charset=utf-8",
  });
  await assert.rejects(() => store.getPublished(postId));
});

test("草案は公開本文と別の非公開プレフィックスへ保存する", async () => {
  const storage = new FakeObjectStoragePort();
  const store = new MarkdownStore("content-bucket", storage);

  const key = await store.putDraft(draft);

  assert.equal(key, `artifacts/${runId}/draft.json`);
  assert.equal(storage.objects.has(`posts/${postId}.md`), false);
  assert.equal(
    storage.objects.get(key)?.contentType,
    "application/json; charset=utf-8",
  );
});

test("失敗した実行は分類済みエラーと完了状態を記録する", async () => {
  const port = new FakeDynamoDbPort();
  const repository = new DynamoDbRunPostRepository(port);
  await repository.start({
    scheduledAt: occurredAt,
    scheduleName: "daily-generation",
  });

  await repository.recordFailure(
    runId,
    {
      code: "SOURCE_UNAVAILABLE",
      message: "source unavailable",
      retriable: true,
    },
    "RESEARCH",
  );

  assert.deepEqual(await repository.getLatestRun(), {
    runId,
    status: "FAILED",
    scheduledAt: occurredAt,
    completedAt: occurredAt,
    failureStage: "RESEARCH",
  });
  assert.equal(port.runs.get(runId)?.errorCode, "SOURCE_UNAVAILABLE");
});

test("S3 保存または公開トランザクションが失敗しても公開投稿を残さない", async () => {
  const dynamo = new FakeDynamoDbPort();
  const storage = new FakeObjectStoragePort();
  const repository = new DynamoDbRunPostRepository(dynamo);
  const store = new MarkdownStore("content-bucket", storage);
  const service = new PublishService(
    repository,
    store,
    () => postId,
    () => occurredAt,
  );

  await repository.start({
    scheduledAt: occurredAt,
    scheduleName: "daily-generation",
  });

  storage.failPut = true;
  await assert.rejects(() => service.publish(draft));
  assert.equal(dynamo.publishCalls, 0);
  assert.deepEqual(await repository.listPublished(10), []);

  storage.failPut = false;
  dynamo.failPublish = true;
  await assert.rejects(() => service.publish(draft));
  assert.equal(dynamo.publishCalls, 1);
  assert.deepEqual(await repository.listPublished(10), []);
});
