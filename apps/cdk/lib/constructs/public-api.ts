import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import type { CreativeAgentConfig } from "../config/app-config";
import { resourceIds } from "../config/resource-ids";
import type { ContentStore } from "./content-store";

interface PublicApiProps {
  readonly config: CreativeAgentConfig;
  readonly store: ContentStore;
}

export class PublicApi extends Construct {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly readFunction: NodejsFunction;

  public constructor(scope: Construct, id: string, props: PublicApiProps) {
    super(scope, id);

    const logGroup = new logs.LogGroup(this, "ReadFunctionLogGroup", {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: props.config.logRetention,
    });
    this.readFunction = new NodejsFunction(this, resourceIds.readFunction, {
      bundling: {
        // Keep the S3 and DynamoDB SDK dependency graph consistent with the
        // application bundle instead of relying on the Lambda runtime copy.
        externalModules: [],
        target: "node20",
      },
      entry: path.join(__dirname, "../../../backend/src/index.ts"),
      environment: {
        CONTENT_BUCKET_NAME: props.store.contentBucket.bucketName,
        CONTENT_TABLE_NAME: props.store.table.tableName,
      },
      handler: "handler",
      logGroup,
      reservedConcurrentExecutions: 5,
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: Duration.seconds(15),
    });
    props.store.table.grantReadData(this.readFunction);
    props.store.contentBucket.grantRead(this.readFunction);

    this.httpApi = new apigwv2.HttpApi(this, resourceIds.publicApi, {
      createDefaultStage: false,
      description: "Public read-only API for published creative-agent posts.",
    });
    const integration = new HttpLambdaIntegration(
      "ReadIntegration",
      this.readFunction,
    );
    this.httpApi.addRoutes({
      integration,
      methods: [apigwv2.HttpMethod.GET],
      path: "/health",
    });
    this.httpApi.addRoutes({
      integration,
      methods: [apigwv2.HttpMethod.GET],
      path: "/api/posts",
    });
    this.httpApi.addRoutes({
      integration,
      methods: [apigwv2.HttpMethod.GET],
      path: "/api/posts/{postId}",
    });
    this.httpApi.addRoutes({
      integration,
      methods: [apigwv2.HttpMethod.GET],
      path: "/api/runs/latest",
    });
    new apigwv2.HttpStage(this, "PublicApiStage", {
      autoDeploy: true,
      httpApi: this.httpApi,
      stageName: "$default",
      throttle: { burstLimit: 10, rateLimit: 5 },
    });
  }
}
