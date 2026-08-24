import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import {
  challengeAppConfig,
  CreativeAgentStack,
} from "../lib/stacks/creative-agent-stack";

const synthesize = (): Template => {
  const app = new cdk.App();
  const stack = new CreativeAgentStack(app, "CreativeAgentStack", {
    config: challengeAppConfig,
  });
  return Template.fromStack(stack);
};

test("安全なコンテンツストアと分離された Lambda 権限を定義する", () => {
  const template = synthesize();

  template.hasResourceProperties("AWS::DynamoDB::Table", {
    BillingMode: "PAY_PER_REQUEST",
    PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    SSESpecification: { SSEEnabled: true },
  });
  template.resourceCountIs("AWS::S3::Bucket", 2);
  template.hasResourceProperties("AWS::S3::Bucket", {
    BucketEncryption: Match.anyValue(),
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
  template.hasResourceProperties("AWS::S3::BucketPolicy", {
    Bucket: Match.anyValue(),
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: "s3:*",
          Condition: { Bool: { "aws:SecureTransport": "false" } },
          Effect: "Deny",
        }),
      ]),
    }),
  });
});

test("生成ワークフロー、JST スケジュール、DLQ と監視を定義する", () => {
  const template = synthesize();

  const lambdaFunctions = template.findResources("AWS::Lambda::Function");
  expect(Object.keys(lambdaFunctions).length).toBeGreaterThanOrEqual(5);
  template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
    DefinitionString: Match.anyValue(),
    LoggingConfiguration: Match.objectLike({ IncludeExecutionData: false }),
  });
  const stateMachine = template.findResources(
    "AWS::StepFunctions::StateMachine",
  );
  expect(JSON.stringify(stateMachine)).toContain("RecordResearchFailure");
  expect(JSON.stringify(stateMachine)).toContain("RecordPublishFailure");
  template.hasResourceProperties("AWS::Scheduler::Schedule", {
    GroupName: Match.anyValue(),
    ScheduleExpressionTimezone: "Asia/Tokyo",
    Target: Match.objectLike({
      DeadLetterConfig: Match.anyValue(),
      RetryPolicy: Match.objectLike({ MaximumEventAgeInSeconds: 3600 }),
    }),
  });
  template.resourceCountIs("AWS::Scheduler::ScheduleGroup", 1);
  template.hasResourceProperties("AWS::CloudWatch::Alarm", {
    Metrics: Match.arrayWith([
      Match.objectLike({
        MetricStat: Match.objectLike({
          Metric: Match.objectLike({
            Dimensions: Match.arrayWith([
              Match.objectLike({ Name: "ScheduleGroup" }),
            ]),
            MetricName: "TargetErrorCount",
            Namespace: "AWS/Scheduler",
          }),
        }),
      }),
    ]),
  });
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith(["sqs:SendMessage"]),
          Effect: "Allow",
          Resource: Match.anyValue(),
        }),
      ]),
    }),
  });
  template.resourceCountIs("AWS::SQS::Queue", 1);
  template.resourceCountIs("AWS::CloudWatch::Alarm", 3);
});

test("GET 限定の公開 API と OAC を使う Web 配信を定義する", () => {
  const template = synthesize();

  template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
  template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
    RouteKey: "GET /api/posts",
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
    RouteKey: "GET /api/runs/latest",
  });
  template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
    DefaultRouteSettings: Match.objectLike({
      ThrottlingBurstLimit: 10,
      ThrottlingRateLimit: 5,
    }),
  });
  template.hasResourceProperties("AWS::CloudFront::OriginAccessControl", {
    OriginAccessControlConfig: Match.objectLike({
      SigningBehavior: "always",
      SigningProtocol: "sigv4",
    }),
  });
  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: Match.objectLike({
      DefaultCacheBehavior: Match.objectLike({
        TargetOriginId: Match.anyValue(),
      }),
    }),
  });
});
