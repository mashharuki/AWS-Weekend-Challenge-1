#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import {
  challengeAppConfig,
  CreativeAgentStack,
} from "../lib/stacks/creative-agent-stack";

const app = new cdk.App();
cdk.Validations.of(app).addPlugins(
  new AwsSolutionsChecks(app, { writeSuppressionsToCloudFormation: true }),
);
new CreativeAgentStack(app, "CreativeAgentStack", {
  config: challengeAppConfig,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
});
