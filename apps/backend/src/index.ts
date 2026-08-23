import { handle } from "hono/aws-lambda";
import { createReadApi, type ReadApiDependencies } from "./api/read-api.js";
import {
  AwsDynamoDbPersistencePort,
  DynamoDbRunPostRepository,
} from "./persistence/dynamodb-repository.js";
import {
  AwsS3ObjectStoragePort,
  MarkdownStore,
} from "./persistence/markdown-store.js";

const unavailableDependencies: ReadApiDependencies = {
  posts: {
    async listPublished() {
      throw new Error("Read API is not configured.");
    },
    async getPublished() {
      throw new Error("Read API is not configured.");
    },
  },
  markdown: {
    async getPublished() {
      throw new Error("Read API is not configured.");
    },
  },
  runs: {
    async getLatestRun() {
      throw new Error("Read API is not configured.");
    },
  },
};

const createConfiguredDependencies = (): ReadApiDependencies => {
  const tableName = process.env.CONTENT_TABLE_NAME;
  const bucketName = process.env.CONTENT_BUCKET_NAME;
  if (!tableName || !bucketName) {
    return unavailableDependencies;
  }
  const repository = new DynamoDbRunPostRepository(
    new AwsDynamoDbPersistencePort(tableName),
  );
  return {
    posts: repository,
    markdown: new MarkdownStore(bucketName, new AwsS3ObjectStoragePort()),
    runs: repository,
  };
};

export const app = createReadApi(createConfiguredDependencies());

export const handler = handle(app);
