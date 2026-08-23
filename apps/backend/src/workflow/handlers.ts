import { GenerationFailure } from "../generation/generation-error.js";
import { PersistenceError } from "../persistence/dynamodb-repository.js";
import type {
  DraftPost,
  FailureStage,
  GenerationError,
  GenerationErrorCode,
  PublishedPost,
  SourceDocument,
} from "../shared/contracts.js";

export interface WorkflowLogEvent {
  readonly runId: string;
  readonly stage: FailureStage;
  readonly status: "RUNNING" | "SUCCEEDED" | "FAILED" | "DUPLICATE";
  readonly durationMs: number;
  readonly errorCode?: GenerationErrorCode;
}

export type WorkflowLogger = (event: WorkflowLogEvent) => void;
type DurationMs = () => number;

export class WorkflowFailure extends Error {
  public constructor(public readonly error: GenerationError) {
    super(error.code);
    this.name = error.code;
  }
}

export interface StartRunRepository {
  start(input: {
    readonly scheduledAt: string;
    readonly scheduleName: string;
  }): Promise<{ readonly runId: string; readonly isDuplicate: boolean }>;
}

export interface FailureRepository {
  recordFailure(
    runId: string,
    error: GenerationError,
    failureStage: FailureStage,
  ): Promise<void>;
}

export interface SourceCollectionPort {
  collect(): Promise<SourceDocument[]>;
}

export interface ResearchPort {
  generate(runId: string, sources: SourceDocument[]): Promise<DraftPost>;
}

export interface PublishPort {
  publish(draft: DraftPost): Promise<PublishedPost>;
}

export interface ScheduledGenerationInput {
  readonly scheduledAt: string;
  readonly scheduleName: string;
}

export interface StartRunOutput extends ScheduledGenerationInput {
  readonly runId: string;
  readonly isDuplicate: boolean;
}

export interface RecordFailureInput {
  readonly runId: string;
  readonly failureStage: FailureStage;
  readonly error: GenerationError;
}

export const createStartRunHandler = (
  repository: StartRunRepository,
  log: WorkflowLogger,
  durationMs: DurationMs,
) => {
  return async (input: ScheduledGenerationInput): Promise<StartRunOutput> => {
    try {
      const result = await repository.start(input);
      log({
        runId: result.runId,
        stage: "START",
        status: result.isDuplicate ? "DUPLICATE" : "RUNNING",
        durationMs: durationMs(),
      });
      return { ...input, ...result };
    } catch (error: unknown) {
      const normalized = toGenerationError(error);
      log({
        runId: "unknown",
        stage: "START",
        status: "FAILED",
        durationMs: durationMs(),
        errorCode: normalized.code,
      });
      throw new WorkflowFailure(normalized);
    }
  };
};

export const createResearchHandler = (
  sourceCollector: SourceCollectionPort,
  researchAgent: ResearchPort,
  log: WorkflowLogger,
  durationMs: DurationMs,
) => {
  return async (input: StartRunOutput): Promise<DraftPost> => {
    try {
      const sources = await sourceCollector.collect();
      const draft = await researchAgent.generate(input.runId, sources);
      log({
        runId: input.runId,
        stage: "RESEARCH",
        status: "SUCCEEDED",
        durationMs: durationMs(),
      });
      return draft;
    } catch (error: unknown) {
      const normalized = toGenerationError(error);
      log({
        runId: input.runId,
        stage: "RESEARCH",
        status: "FAILED",
        durationMs: durationMs(),
        errorCode: normalized.code,
      });
      throw new WorkflowFailure(normalized);
    }
  };
};

export const createValidatePublishHandler = (
  publishService: PublishPort,
  log: WorkflowLogger,
  durationMs: DurationMs,
) => {
  return async (draft: DraftPost): Promise<PublishedPost> => {
    try {
      const post = await publishService.publish(draft);
      log({
        runId: draft.runId,
        stage: "VALIDATE_PUBLISH",
        status: "SUCCEEDED",
        durationMs: durationMs(),
      });
      return post;
    } catch (error: unknown) {
      const normalized = toGenerationError(error);
      log({
        runId: draft.runId,
        stage: "VALIDATE_PUBLISH",
        status: "FAILED",
        durationMs: durationMs(),
        errorCode: normalized.code,
      });
      throw new WorkflowFailure(normalized);
    }
  };
};

export const createRecordFailureHandler = (
  repository: FailureRepository,
  log: WorkflowLogger,
  durationMs: DurationMs,
) => {
  return async (input: RecordFailureInput): Promise<void> => {
    await repository.recordFailure(
      input.runId,
      input.error,
      input.failureStage,
    );
    log({
      runId: input.runId,
      stage: input.failureStage,
      status: "FAILED",
      durationMs: durationMs(),
      errorCode: input.error.code,
    });
  };
};

type StartRunHandler = (
  input: ScheduledGenerationInput,
) => Promise<StartRunOutput>;
type ResearchHandler = (input: StartRunOutput) => Promise<DraftPost>;
type ValidatePublishHandler = (draft: DraftPost) => Promise<PublishedPost>;
type RecordFailureHandler = (input: RecordFailureInput) => Promise<void>;

export interface GenerationWorkflowDependencies {
  readonly start: StartRunHandler;
  readonly research: ResearchHandler;
  readonly publish: ValidatePublishHandler;
  readonly recordFailure: RecordFailureHandler;
}

export class GenerationWorkflow {
  public constructor(
    private readonly dependencies: GenerationWorkflowDependencies,
  ) {}

  public async execute(input: ScheduledGenerationInput): Promise<
    | { readonly status: "PUBLISHED"; readonly post: PublishedPost }
    | { readonly status: "DUPLICATE"; readonly runId: string }
    | {
        readonly status: "FAILED";
        readonly runId: string;
        readonly errorCode: GenerationErrorCode;
      }
  > {
    const started = await this.dependencies.start(input);
    if (started.isDuplicate) {
      return { status: "DUPLICATE", runId: started.runId };
    }

    let failureStage: FailureStage = "RESEARCH";
    try {
      const draft = await this.dependencies.research(started);
      failureStage = "VALIDATE_PUBLISH";
      const post = await this.dependencies.publish(draft);
      return { status: "PUBLISHED", post };
    } catch (error: unknown) {
      const normalized = toGenerationError(error);
      await this.dependencies.recordFailure({
        runId: started.runId,
        failureStage,
        error: normalized,
      });
      return {
        status: "FAILED",
        runId: started.runId,
        errorCode: normalized.code,
      };
    }
  }
}

export const toGenerationError = (error: unknown): GenerationError => {
  if (error instanceof WorkflowFailure) {
    return error.error;
  }
  if (error instanceof GenerationFailure || error instanceof PersistenceError) {
    return {
      code: error.code,
      message: error.code,
      retriable: error.retriable,
    };
  }
  return {
    code: "MODEL_FAILURE",
    message: "MODEL_FAILURE",
    retriable: true,
  };
};
