export interface LambdaArns {
  readonly startRunArn: string;
  readonly researchArn: string;
  readonly validatePublishArn: string;
  readonly recordFailureArn: string;
}

interface RetryRule {
  readonly ErrorEquals: readonly string[];
  readonly IntervalSeconds: number;
  readonly MaxAttempts: number;
  readonly BackoffRate: number;
  readonly JitterStrategy: "FULL";
}

interface CatchRule {
  readonly ErrorEquals: readonly string[];
  readonly ResultPath?: string;
  readonly Next: string;
}

export interface StateDefinition {
  readonly Type: "Task" | "Choice" | "Pass" | "Fail";
  readonly Resource?: string;
  readonly Parameters?: Record<string, unknown>;
  readonly OutputPath?: string;
  readonly Next?: string;
  readonly End?: boolean;
  readonly Retry?: readonly RetryRule[];
  readonly Catch?: readonly CatchRule[];
  readonly Choices?: readonly {
    readonly Variable: string;
    readonly BooleanEquals: boolean;
    readonly Next: string;
  }[];
  readonly Default?: string;
  readonly Error?: string;
  readonly Cause?: string;
}

export interface StateMachineDefinition {
  readonly StartAt: string;
  readonly States: Record<string, StateDefinition>;
}

const retryableErrors = [
  "SOURCE_UNAVAILABLE",
  "MODEL_THROTTLED",
  "MODEL_FAILURE",
  "PERSISTENCE_FAILURE",
  "Lambda.ServiceException",
  "Lambda.AWSLambdaException",
  "Lambda.SdkClientException",
  "Lambda.TooManyRequestsException",
  "Lambda.Unknown",
  "Sandbox.Timedout",
];

const retry: RetryRule = {
  ErrorEquals: retryableErrors,
  IntervalSeconds: 1,
  MaxAttempts: 2,
  BackoffRate: 2,
  JitterStrategy: "FULL",
};

const lambdaTask = (functionArn: string, next: string): StateDefinition => ({
  Type: "Task",
  Resource: "arn:aws:states:::lambda:invoke",
  Parameters: {
    FunctionName: functionArn,
    "Payload.$": "$",
  },
  OutputPath: "$.Payload",
  Next: next,
});

const recordFailureTask = (
  functionArn: string,
  failureStage: "RESEARCH" | "VALIDATE_PUBLISH",
): StateDefinition => ({
  Type: "Task",
  Resource: "arn:aws:states:::lambda:invoke",
  Parameters: {
    FunctionName: functionArn,
    Payload: {
      "runId.$": "$.runId",
      failureStage,
      error: {
        "code.$": "$.failureContext.Error",
        message: "Workflow execution failed",
        retriable: false,
      },
    },
  },
  End: true,
});

export const createStateMachineDefinition = (
  arns: LambdaArns,
): StateMachineDefinition => ({
  StartAt: "StartRun",
  States: {
    StartRun: {
      ...lambdaTask(arns.startRunArn, "CheckDuplicate"),
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          Next: "StartFailed",
        },
      ],
    },
    CheckDuplicate: {
      Type: "Choice",
      Choices: [
        {
          Variable: "$.isDuplicate",
          BooleanEquals: true,
          Next: "DuplicateCompleted",
        },
      ],
      Default: "ResearchAgent",
    },
    DuplicateCompleted: { Type: "Pass", End: true },
    ResearchAgent: {
      ...lambdaTask(arns.researchArn, "ValidatePublish"),
      Retry: [retry],
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          ResultPath: "$.failureContext",
          Next: "RecordResearchFailure",
        },
      ],
    },
    ValidatePublish: {
      ...lambdaTask(arns.validatePublishArn, "Published"),
      Retry: [retry],
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          ResultPath: "$.failureContext",
          Next: "RecordPublishFailure",
        },
      ],
    },
    Published: { Type: "Pass", End: true },
    RecordResearchFailure: recordFailureTask(arns.recordFailureArn, "RESEARCH"),
    RecordPublishFailure: recordFailureTask(
      arns.recordFailureArn,
      "VALIDATE_PUBLISH",
    ),
    StartFailed: {
      Type: "Fail",
      Error: "START_FAILED",
      Cause: "The generation run could not be initialized.",
    },
  },
});
