import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { type DraftPost, draftPostSchema } from "../shared/contracts.js";
import { PersistenceError } from "./dynamodb-repository.js";

export const maxMarkdownBytes = 100_000;
const markdownContentType = "text/markdown; charset=utf-8";
const draftContentType = "application/json; charset=utf-8";

export interface ObjectStoragePort {
  putObject(input: {
    readonly bucket: string;
    readonly key: string;
    readonly body: string;
    readonly contentType: string;
  }): Promise<void>;
  getObject(input: {
    readonly bucket: string;
    readonly key: string;
  }): Promise<{ readonly body: string; readonly contentType?: string }>;
}

export class AwsS3ObjectStoragePort implements ObjectStoragePort {
  private readonly client: S3Client;

  constructor(client?: S3Client) {
    this.client = client ?? new S3Client({});
  }

  async putObject(input: {
    readonly bucket: string;
    readonly key: string;
    readonly body: string;
    readonly contentType: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async getObject(input: {
    readonly bucket: string;
    readonly key: string;
  }): Promise<{ readonly body: string; readonly contentType?: string }> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
    );
    if (!response.Body) {
      throw new PersistenceError("PERSISTENCE_FAILURE", true);
    }
    return {
      body: await response.Body.transformToString(),
      contentType: response.ContentType,
    };
  }
}

export class MarkdownStore {
  constructor(
    private readonly bucket: string,
    private readonly storage: ObjectStoragePort,
  ) {}

  async putPublished(postId: string, markdown: string): Promise<string> {
    validateMarkdown(postId, markdown);
    const key = `posts/${postId}.md`;
    try {
      await this.storage.putObject({
        bucket: this.bucket,
        key,
        body: markdown,
        contentType: markdownContentType,
      });
      return key;
    } catch (error: unknown) {
      throw toStorageError(error);
    }
  }

  async getPublished(postId: string): Promise<string> {
    const key = `posts/${postId}.md`;
    try {
      const object = await this.storage.getObject({ bucket: this.bucket, key });
      if (!object.contentType?.startsWith("text/markdown")) {
        throw new PersistenceError("PERSISTENCE_FAILURE", false);
      }
      validateMarkdown(postId, object.body);
      return object.body;
    } catch (error: unknown) {
      throw toStorageError(error);
    }
  }

  async putDraft(draft: DraftPost): Promise<string> {
    const verifiedDraft = draftPostSchema.parse(draft);
    const key = `artifacts/${verifiedDraft.runId}/draft.json`;
    try {
      await this.storage.putObject({
        bucket: this.bucket,
        key,
        body: JSON.stringify(verifiedDraft),
        contentType: draftContentType,
      });
      return key;
    } catch (error: unknown) {
      throw toStorageError(error);
    }
  }
}

const validateMarkdown = (postId: string, markdown: string): void => {
  if (!/^[0-9a-f-]{36}$/.test(postId)) {
    throw new PersistenceError("CONTENT_INVALID", false);
  }
  if (!markdown.trim() || markdown.includes("<")) {
    throw new PersistenceError("CONTENT_INVALID", false);
  }
  if (new TextEncoder().encode(markdown).byteLength > maxMarkdownBytes) {
    throw new PersistenceError("CONTENT_INVALID", false);
  }
};

const toStorageError = (error: unknown): PersistenceError => {
  if (error instanceof PersistenceError) {
    return error;
  }
  return new PersistenceError("PERSISTENCE_FAILURE", true);
};
