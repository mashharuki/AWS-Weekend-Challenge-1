import { RetentionDays } from "aws-cdk-lib/aws-logs";

export interface CreativeAgentConfig {
  readonly environment: "challenge";
  readonly timezone: "Asia/Tokyo";
  readonly scheduleExpression: string;
  readonly bedrockModelId: "amazon.nova-lite-v1:0";
  readonly allowedSourceOrigins: readonly string[];
  readonly logRetention: RetentionDays;
}

export const challengeAppConfig: CreativeAgentConfig = {
  environment: "challenge",
  timezone: "Asia/Tokyo",
  scheduleExpression: "cron(0 9 * * ? *)",
  bedrockModelId: "amazon.nova-lite-v1:0",
  allowedSourceOrigins: ["https://aws.amazon.com", "https://community.aws"],
  logRetention: RetentionDays.ONE_WEEK,
};
