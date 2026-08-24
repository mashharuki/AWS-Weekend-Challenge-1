export interface WorkflowRuntimeConfig {
  readonly allowedSourceOrigins: readonly string[];
  readonly bedrockModelId: string;
  readonly contentBucketName: string;
  readonly contentTableName: string;
  readonly guardrailIdentifier: string;
  readonly guardrailVersion: string;
}

const required = (environment: NodeJS.ProcessEnv, key: string): string => {
  const configured = environment[key]?.trim();
  if (!configured) {
    throw new Error(`Missing ${key}`);
  }
  return configured;
};

export const parseWorkflowRuntimeConfig = (
  environment: NodeJS.ProcessEnv,
): WorkflowRuntimeConfig => {
  const allowedSourceOrigins = required(environment, "ALLOWED_SOURCE_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (allowedSourceOrigins.length === 0) {
    throw new Error("Missing ALLOWED_SOURCE_ORIGINS");
  }

  return {
    allowedSourceOrigins,
    bedrockModelId: required(environment, "BEDROCK_MODEL_ID"),
    contentBucketName: required(environment, "CONTENT_BUCKET_NAME"),
    contentTableName: required(environment, "CONTENT_TABLE_NAME"),
    guardrailIdentifier: required(environment, "GUARDRAIL_IDENTIFIER"),
    guardrailVersion: required(environment, "GUARDRAIL_VERSION"),
  };
};
