import * as path from "node:path";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Fn } from "aws-cdk-lib";
import { Construct } from "constructs";
import { resourceIds } from "../config/resource-ids";
import type { PublicApi } from "./public-api";
import type { ContentStore } from "./content-store";

interface WebDeliveryProps {
  readonly api: PublicApi;
  readonly store: ContentStore;
}

export class WebDelivery extends Construct {
  public readonly distribution: cloudfront.Distribution;

  public constructor(scope: Construct, id: string, props: WebDeliveryProps) {
    super(scope, id);

    const siteOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      props.store.siteBucket,
    );
    const apiOrigin = new origins.HttpOrigin(
      Fn.select(2, Fn.split("/", props.api.httpApi.apiEndpoint)),
      { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY },
    );
    this.distribution = new cloudfront.Distribution(
      this,
      resourceIds.webDistribution,
      {
        defaultBehavior: {
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          origin: siteOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        defaultRootObject: "index.html",
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
        additionalBehaviors: {
          "/api/*": {
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            origin: apiOrigin,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          },
        },
      },
    );
    new s3deploy.BucketDeployment(this, "DeployWebAssets", {
      destinationBucket: props.store.siteBucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../../frontend/dist")),
      ],
    });
  }
}
