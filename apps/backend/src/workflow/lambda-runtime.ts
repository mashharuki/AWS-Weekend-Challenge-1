import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { BedrockGuardrail } from "../generation/bedrock-guardrail.js";
import { ContentSafetyValidator } from "../generation/content-safety-validator.js";
import { ResearchAgent } from "../generation/research-agent.js";
import { SourceCollector } from "../generation/source-collector.js";
import { StrandsBedrockDraftGenerator } from "../generation/strands-bedrock-agent.js";
import {
  AwsDynamoDbPersistencePort,
  DynamoDbRunPostRepository,
} from "../persistence/dynamodb-repository.js";
import {
  AwsS3ObjectStoragePort,
  MarkdownStore,
} from "../persistence/markdown-store.js";
import { PublishService } from "../persistence/publish-service.js";
import {
  createRecordFailureHandler,
  createResearchHandler,
  createStartRunHandler,
  createValidatePublishHandler,
} from "./handlers.js";
import { parseWorkflowRuntimeConfig } from "./runtime-config.js";
import type { DraftPost, PublishedPost } from "../shared/contracts.js";
import type {
  RecordFailureInput,
  ScheduledGenerationInput,
  StartRunOutput,
  WorkflowLogger,
} from "./handlers.js";

const now = (): string => new Date().toISOString();
const config = parseWorkflowRuntimeConfig(process.env);
const repository = new DynamoDbRunPostRepository(
  new AwsDynamoDbPersistencePort(config.contentTableName),
);
const validator = new ContentSafetyValidator(
  [...config.allowedSourceOrigins],
  new BedrockGuardrail(
    new BedrockRuntimeClient({}),
    config.guardrailIdentifier,
    config.guardrailVersion,
  ),
);
const researchHandlerFactory = (log: WorkflowLogger, elapsed: () => number) =>
  createResearchHandler(
    new SourceCollector({
      allowedSourceOrigins: [...config.allowedSourceOrigins],
      // community.aws redirects to a concise, public builder page; avoid passing
      // the much larger marketing homepages to the model context.
      candidateUrls: ["https://community.aws/"],
      maxResponseBytes: 100_000,
      minDocuments: 1,
      timeoutMs: 10_000,
    }),
    new ResearchAgent(
      new StrandsBedrockDraftGenerator({
        modelId: config.bedrockModelId,
        region: process.env.AWS_REGION ?? "ap-northeast-1",
      }),
      validator,
      now,
    ),
    log,
    elapsed,
  );

const emitLog = (event: Parameters<WorkflowLogger>[0]): void =>
  console.info(JSON.stringify(event));

const timed = <Input, Output>(
  factory: (
    log: WorkflowLogger,
    elapsed: () => number,
  ) => (input: Input) => Promise<Output>,
) => {
  return async (input: Input): Promise<Output> => {
    const startedAt = Date.now();
    return factory(emitLog, () => Date.now() - startedAt)(input);
  };
};

const start = timed(createStartRunHandler.bind(null, repository));
const publish = timed(
  createValidatePublishHandler.bind(
    null,
    new PublishService(
      repository,
      new MarkdownStore(config.contentBucketName, new AwsS3ObjectStoragePort()),
    ),
  ),
);
const recordFailure = timed(createRecordFailureHandler.bind(null, repository));

export const startRunHandler = async (
  input: Partial<ScheduledGenerationInput>,
): Promise<StartRunOutput> =>
  start({
    scheduleName: input.scheduleName ?? "daily-generation",
    scheduledAt: input.scheduledAt ?? now(),
  });

export const researchHandler = timed(researchHandlerFactory);
export const validatePublishHandler = publish as (
  draft: DraftPost,
) => Promise<PublishedPost>;
export const recordFailureHandler = recordFailure as (
  input: RecordFailureInput,
) => Promise<void>;
