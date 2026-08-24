import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import {
  type DraftPost,
  type FailureStage,
  type GenerationError,
  type GenerationErrorCode,
  type GenerationRun,
  generationRunSchema,
  type PostSummary,
  type PublishedPost,
  publishedPostSchema,
} from "../shared/contracts.js";

const runIdPattern = /^\d{4}-\d{2}-\d{2}$/;

const storedPublishedPostSchema = z.object({
  postId: z.uuid(),
  status: z.literal("PUBLISHED"),
  title: z.string(),
  publishedAt: z.string(),
  bodyKey: z.string().regex(/^posts\/[0-9a-f-]{36}\.md$/),
  sourceUrls: z.array(z.string()),
});

const storedPublishedPostWriteSchema = storedPublishedPostSchema.extend({
  GSI1PK: z.literal("PUBLISHED"),
  GSI1SK: z.string(),
  PK: z.string().regex(/^POST#[0-9a-f-]{36}$/),
  SK: z.literal("METADATA"),
  entity: z.literal("POST"),
});

type StoredPublishedPost = PublishedPost & { readonly bodyKey: string };

export interface DynamoDbPersistencePort {
  createRun(item: Record<string, unknown>): Promise<void>;
  getLatestRun(): Promise<readonly Record<string, unknown>[]>;
  listPublished(limit: number): Promise<readonly Record<string, unknown>[]>;
  getPost(postId: string): Promise<Record<string, unknown> | undefined>;
  recordFailure(
    runId: string,
    error: GenerationError,
    failureStage: FailureStage,
  ): Promise<void>;
  publish(post: Record<string, unknown>, runId: string): Promise<void>;
}

export class AwsDynamoDbPersistencePort implements DynamoDbPersistencePort {
  private readonly documentClient: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    documentClient?: DynamoDBDocumentClient,
  ) {
    this.documentClient =
      documentClient ??
      DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true },
      });
  }

  async createRun(item: Record<string, unknown>): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  }

  async getLatestRun(): Promise<readonly Record<string, unknown>[]> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :run",
        ExpressionAttributeValues: { ":run": "RUN" },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    return response.Items ?? [];
  }

  async listPublished(
    limit: number,
  ): Promise<readonly Record<string, unknown>[]> {
    const response = await this.documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :published",
        ExpressionAttributeValues: { ":published": "PUBLISHED" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return response.Items ?? [];
  }

  async getPost(postId: string): Promise<Record<string, unknown> | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `POST#${postId}`, SK: "METADATA" },
      }),
    );
    return response.Item;
  }

  async recordFailure(
    runId: string,
    error: GenerationError,
    failureStage: FailureStage,
  ): Promise<void> {
    await this.documentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `RUN#${runId}`, SK: "METADATA" },
        ConditionExpression: "#status = :running",
        UpdateExpression:
          "SET #status = :failed, completedAt = :completedAt, failureStage = :failureStage, errorCode = :errorCode",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":running": "RUNNING",
          ":failed": "FAILED",
          ":completedAt": new Date().toISOString(),
          ":failureStage": failureStage,
          ":errorCode": error.code,
        },
      }),
    );
  }

  async publish(post: Record<string, unknown>, runId: string): Promise<void> {
    console.info(
      JSON.stringify({
        event: "dynamodb-publish-metadata",
        attributes: Object.entries(post).map(([name, value]) => ({
          byteLength: Buffer.byteLength(JSON.stringify(value)),
          name,
          type: Array.isArray(value) ? "array" : typeof value,
        })),
      }),
    );
    await this.documentClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: post,
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: { PK: `RUN#${runId}`, SK: "METADATA" },
              ConditionExpression: "#status = :running",
              UpdateExpression:
                "SET #status = :succeeded, completedAt = :completedAt, postId = :postId",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":running": "RUNNING",
                ":succeeded": "SUCCEEDED",
                ":completedAt": post.publishedAt,
                ":postId": post.postId,
              },
            },
          },
        ],
      }),
    );
  }
}

export class PersistenceError extends Error {
  constructor(
    readonly code: GenerationErrorCode,
    readonly retriable: boolean,
  ) {
    super(code);
    this.name = "PersistenceError";
  }
}

export class DynamoDbRunPostRepository {
  constructor(private readonly port: DynamoDbPersistencePort) {}

  async start(input: {
    readonly scheduledAt: string;
    readonly scheduleName: string;
  }): Promise<{ readonly runId: string; readonly isDuplicate: boolean }> {
    const scheduledAt = requireUtcDate(input.scheduledAt);
    const runId = toJstRunId(scheduledAt);
    try {
      await this.port.createRun({
        PK: `RUN#${runId}`,
        SK: "METADATA",
        GSI2PK: "RUN",
        GSI2SK: scheduledAt,
        entity: "RUN",
        runId,
        status: "RUNNING",
        scheduledAt,
        scheduleName: input.scheduleName,
      });
      return { runId, isDuplicate: false };
    } catch (error: unknown) {
      if (errorName(error) === "ConditionalCheckFailedException") {
        return { runId, isDuplicate: true };
      }
      throw toPersistenceError(error);
    }
  }

  async getLatestRun(): Promise<GenerationRun | null> {
    try {
      const [item] = await this.port.getLatestRun();
      return item ? toGenerationRun(item) : null;
    } catch (error: unknown) {
      throw toPersistenceError(error);
    }
  }

  async listPublished(limit: number): Promise<readonly PostSummary[]> {
    try {
      const items = await this.port.listPublished(limit);
      return items.flatMap((item) => {
        const post = toStoredPublishedPost(item);
        return post
          ? [
              {
                postId: post.postId,
                title: post.title,
                publishedAt: post.publishedAt,
              },
            ]
          : [];
      });
    } catch (error: unknown) {
      throw toPersistenceError(error);
    }
  }

  async getPublished(postId: string): Promise<StoredPublishedPost | null> {
    try {
      const item = await this.port.getPost(postId);
      return item ? toStoredPublishedPost(item) : null;
    } catch (error: unknown) {
      throw toPersistenceError(error);
    }
  }

  async recordFailure(
    runId: string,
    error: GenerationError,
    failureStage: FailureStage = "RESEARCH",
  ): Promise<void> {
    try {
      await this.port.recordFailure(runId, error, failureStage);
    } catch (cause: unknown) {
      throw toPersistenceError(cause);
    }
  }

  async publish(input: {
    readonly draft: DraftPost;
    readonly postId: string;
    readonly bodyKey: string;
    readonly publishedAt: string;
  }): Promise<PublishedPost> {
    const post = storedPublishedPostWriteSchema.parse({
      PK: `POST#${input.postId}`,
      SK: "METADATA",
      GSI1PK: "PUBLISHED",
      GSI1SK: input.publishedAt,
      entity: "POST",
      postId: input.postId,
      status: "PUBLISHED",
      title: input.draft.title,
      publishedAt: input.publishedAt,
      bodyKey: input.bodyKey,
      sourceUrls: input.draft.sourceUrls,
    });
    try {
      await this.port.publish(post, input.draft.runId);
      return publishedPostSchema.parse({
        postId: post.postId,
        title: post.title,
        publishedAt: post.publishedAt,
        sourceUrls: post.sourceUrls,
      });
    } catch (error: unknown) {
      throw toPersistenceError(error);
    }
  }
}

const requireUtcDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !value.endsWith("Z")) {
    throw new PersistenceError("CONFIG_INVALID", false);
  }
  return parsed.toISOString();
};

const toJstRunId = (scheduledAt: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(scheduledAt));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const runId = `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
  if (!runIdPattern.test(runId)) {
    throw new PersistenceError("CONFIG_INVALID", false);
  }
  return runId;
};

const toGenerationRun = (item: Record<string, unknown>): GenerationRun => {
  const result = generationRunSchema.safeParse({
    runId: item.runId,
    status: item.status,
    scheduledAt: item.scheduledAt,
    ...(item.completedAt === undefined
      ? {}
      : { completedAt: item.completedAt }),
    ...(item.postId === undefined ? {} : { postId: item.postId }),
    ...(item.failureStage === undefined
      ? {}
      : { failureStage: item.failureStage }),
  });
  if (!result.success) {
    throw new PersistenceError("PERSISTENCE_FAILURE", false);
  }
  return result.data;
};

const toStoredPublishedPost = (
  item: Record<string, unknown>,
): StoredPublishedPost | null => {
  if (item.status !== "PUBLISHED") {
    return null;
  }
  const result = storedPublishedPostSchema.safeParse({
    postId: item.postId,
    status: item.status,
    title: item.title,
    publishedAt: item.publishedAt,
    bodyKey: item.bodyKey,
    sourceUrls: item.sourceUrls,
  });
  if (!result.success) {
    throw new PersistenceError("PERSISTENCE_FAILURE", false);
  }
  return result.data;
};

const errorName = (error: unknown): string | undefined =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  typeof error.name === "string"
    ? error.name
    : undefined;

const toPersistenceError = (error: unknown): PersistenceError => {
  if (error instanceof PersistenceError) {
    return error;
  }
  switch (errorName(error)) {
    case "ConditionalCheckFailedException":
      return new PersistenceError("STATE_TRANSITION_INVALID", false);
    case "TransactionCanceledException":
      if (
        typeof error === "object" &&
        error !== null &&
        "CancellationReasons" in error &&
        Array.isArray(error.CancellationReasons)
      ) {
        console.info(
          JSON.stringify({
            event: "dynamodb-transaction-cancelled",
            reasons: error.CancellationReasons.map((reason) =>
              typeof reason === "object" &&
              reason !== null &&
              "Code" in reason &&
              typeof reason.Code === "string"
                ? reason.Code
                : "Unknown",
            ),
          }),
        );
      }
      return new PersistenceError("TRANSACTION_CONFLICT", true);
    default:
      return new PersistenceError("PERSISTENCE_FAILURE", true);
  }
};
