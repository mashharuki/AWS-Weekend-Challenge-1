import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import type { CreativeAgentConfig } from "../config/app-config";
import { resourceIds } from "../config/resource-ids";
import type { ContentStore } from "./content-store";

const workflowEntry = path.join(
  __dirname,
  "../../../backend/src/workflow/lambda-runtime.ts",
);

interface GenerationWorkflowProps {
  readonly config: CreativeAgentConfig;
  readonly store: ContentStore;
}

export class GenerationWorkflow extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  public constructor(
    scope: Construct,
    id: string,
    props: GenerationWorkflowProps,
  ) {
    super(scope, id);

    const guardrail = new bedrock.CfnGuardrail(this, "ContentGuardrail", {
      blockedInputMessaging: "Unsafe input was blocked.",
      blockedOutputsMessaging: "Unsafe generated content was blocked.",
      contentPolicyConfig: {
        filtersConfig: [
          {
            inputStrength: "HIGH",
            outputStrength: "HIGH",
            type: "HATE",
          },
        ],
      },
      name: `${Stack.of(this).stackName.toLowerCase()}-content-guardrail`,
    });
    const workflowEnvironment = {
      CONTENT_BUCKET_NAME: props.store.contentBucket.bucketName,
      CONTENT_TABLE_NAME: props.store.table.tableName,
      GUARDRAIL_IDENTIFIER: guardrail.attrGuardrailId,
      GUARDRAIL_VERSION: "DRAFT",
    };

    const startRun = this.createFunction(
      resourceIds.startRunFunction,
      props.config,
      workflowEnvironment,
      "startRunHandler",
    );
    const research = this.createFunction(
      resourceIds.researchFunction,
      props.config,
      workflowEnvironment,
      "researchHandler",
    );
    const publish = this.createFunction(
      resourceIds.publishFunction,
      props.config,
      workflowEnvironment,
      "validatePublishHandler",
    );
    const recordFailure = this.createFunction(
      resourceIds.recordFailureFunction,
      props.config,
      workflowEnvironment,
      "recordFailureHandler",
    );

    props.store.table.grantReadWriteData(startRun);
    props.store.table.grantReadWriteData(research);
    props.store.table.grantReadWriteData(publish);
    props.store.table.grantReadWriteData(recordFailure);
    props.store.contentBucket.grantReadWrite(research);
    props.store.contentBucket.grantReadWrite(publish);
    research.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          `arn:${Stack.of(scope).partition}:bedrock:${Stack.of(scope).region}::foundation-model/${props.config.bedrockModelId}`,
        ],
      }),
    );
    research.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:ApplyGuardrail"],
        resources: [guardrail.attrGuardrailArn],
      }),
    );

    const workflowLogGroup = new logs.LogGroup(
      this,
      resourceIds.workflowLogGroup,
      {
        removalPolicy: RemovalPolicy.DESTROY,
        retention: props.config.logRetention,
      },
    );
    const recordResearchFailure = new tasks.LambdaInvoke(
      this,
      "RecordResearchFailure",
      {
        lambdaFunction: recordFailure,
        payload: sfn.TaskInput.fromObject({
          "runId.$": "$.runId",
          failureStage: "RESEARCH",
          error: {
            "code.$": "$.failureContext.Error",
            message: "Workflow execution failed",
            retriable: false,
          },
        }),
      },
    );
    const recordPublishFailure = new tasks.LambdaInvoke(
      this,
      "RecordPublishFailure",
      {
        lambdaFunction: recordFailure,
        payload: sfn.TaskInput.fromObject({
          "runId.$": "$.runId",
          failureStage: "VALIDATE_PUBLISH",
          error: {
            "code.$": "$.failureContext.Error",
            message: "Workflow execution failed",
            retriable: false,
          },
        }),
      },
    );
    const definition = sfn.Chain.start(
      new tasks.LambdaInvoke(this, "StartRun", {
        lambdaFunction: startRun,
        outputPath: "$.Payload",
      }).next(
        new sfn.Choice(this, "CheckDuplicate")
          .when(
            sfn.Condition.booleanEquals("$.isDuplicate", true),
            new sfn.Succeed(this, "DuplicateCompleted"),
          )
          .otherwise(
            new tasks.LambdaInvoke(this, "ResearchAgent", {
              lambdaFunction: research,
              outputPath: "$.Payload",
              retryOnServiceExceptions: true,
            })
              .addRetry({
                errors: [
                  "SOURCE_UNAVAILABLE",
                  "MODEL_THROTTLED",
                  "MODEL_FAILURE",
                ],
                interval: Duration.seconds(1),
                maxAttempts: 2,
                backoffRate: 2,
              })
              .addCatch(recordResearchFailure, {
                resultPath: "$.failureContext",
              })
              .next(
                new tasks.LambdaInvoke(this, "ValidatePublish", {
                  lambdaFunction: publish,
                  outputPath: "$.Payload",
                })
                  .addRetry({
                    errors: ["PERSISTENCE_FAILURE"],
                    interval: Duration.seconds(1),
                    maxAttempts: 2,
                    backoffRate: 2,
                  })
                  .addCatch(recordPublishFailure, {
                    resultPath: "$.failureContext",
                  })
                  .next(new sfn.Succeed(this, "Published")),
              ),
          ),
      ),
    );
    this.stateMachine = new sfn.StateMachine(this, resourceIds.workflow, {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      logs: {
        destination: workflowLogGroup,
        includeExecutionData: false,
        level: sfn.LogLevel.ALL,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      tracingEnabled: true,
    });

    const dlq = new sqs.Queue(this, resourceIds.schedulerDlq, {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const schedulerRole = new iam.Role(this, "SchedulerRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    this.stateMachine.grantStartExecution(schedulerRole);
    dlq.grantSendMessages(schedulerRole);
    const scheduleGroup = new scheduler.CfnScheduleGroup(this, "ScheduleGroup");
    new scheduler.CfnSchedule(this, resourceIds.scheduler, {
      flexibleTimeWindow: { mode: "OFF" },
      groupName: scheduleGroup.ref,
      scheduleExpression: props.config.scheduleExpression,
      scheduleExpressionTimezone: props.config.timezone,
      target: {
        arn: this.stateMachine.stateMachineArn,
        deadLetterConfig: { arn: dlq.queueArn },
        input: JSON.stringify({ scheduleName: "daily-generation" }),
        retryPolicy: {
          maximumEventAgeInSeconds: 3600,
          maximumRetryAttempts: 2,
        },
        roleArn: schedulerRole.roleArn,
      },
    });
    dlq.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["sqs:SendMessage"],
        conditions: {
          ArnLike: {
            "aws:SourceArn": Stack.of(this).formatArn({
              resource: "schedule/*",
              service: "scheduler",
            }),
          },
        },
        principals: [new iam.ServicePrincipal("scheduler.amazonaws.com")],
        resources: [dlq.queueArn],
      }),
    );

    new cloudwatch.Alarm(this, resourceIds.schedulerFailureAlarm, {
      alarmDescription: "Scheduler target delivery failures",
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      metric: new cloudwatch.Metric({
        dimensionsMap: { ScheduleGroup: scheduleGroup.ref },
        metricName: "TargetErrorCount",
        namespace: "AWS/Scheduler",
        period: Duration.minutes(5),
        statistic: "Sum",
      }),
      threshold: 1,
    });
    new cloudwatch.Alarm(this, resourceIds.schedulerDlqAlarm, {
      alarmDescription: "Scheduler DLQ received an event",
      evaluationPeriods: 1,
      metric: dlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
    });
    new cloudwatch.Alarm(this, resourceIds.workflowFailureAlarm, {
      alarmDescription: "Generation workflow failed",
      evaluationPeriods: 1,
      metric: this.stateMachine.metricFailed({
        period: Duration.minutes(5),
        statistic: "Sum",
      }),
      threshold: 1,
    });
  }

  private createFunction(
    id: string,
    config: CreativeAgentConfig,
    environment: Record<string, string>,
    handler: string,
  ): NodejsFunction {
    const logGroup = new logs.LogGroup(this, `${id}LogGroup`, {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: config.logRetention,
    });
    return new NodejsFunction(this, id, {
      bundling: {
        // The application uses a newer AWS SDK than the Lambda runtime bundle.
        // Keep the SDK and its Smithy dependencies in the function artifact.
        externalModules: [],
        target: "node20",
      },
      entry: workflowEntry,
      environment: {
        ...environment,
        ALLOWED_SOURCE_ORIGINS: config.allowedSourceOrigins.join(","),
        BEDROCK_MODEL_ID: config.bedrockModelId,
      },
      handler,
      logGroup,
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: Duration.minutes(1),
    });
  }
}
