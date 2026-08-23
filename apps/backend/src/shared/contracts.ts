import { z } from "zod";

const isoUtcDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .refine(
    (value) => value.endsWith("Z"),
    "日時は UTC の ISO 8601 形式で指定します",
  );

const httpsUrlSchema = z
  .url()
  .refine(
    (value) => new URL(value).protocol === "https:",
    "URL は HTTPS で指定します",
  );

const allowedSourceOriginSchema = httpsUrlSchema.refine((value) => {
  const url = new URL(value);
  return url.pathname === "/" && url.search === "" && url.hash === "";
}, "許可ソースは HTTPS オリジンで指定します");

const markdownSchema = z
  .string()
  .trim()
  .min(1, "Markdown 本文は空にできません")
  .max(100_000, "Markdown 本文が長すぎます")
  .refine((value) => !value.includes("<"), "Markdown に HTML は含められません");

export const runStatusSchema = z.enum([
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "DUPLICATE",
]);

export const failureStageSchema = z.enum([
  "START",
  "RESEARCH",
  "VALIDATE_PUBLISH",
]);

export const generationRunSchema = z
  .object({
    runId: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "runId は YYYY-MM-DD 形式です"),
    status: runStatusSchema,
    scheduledAt: isoUtcDateTimeSchema,
    completedAt: isoUtcDateTimeSchema.optional(),
    postId: z.uuid().optional(),
    failureStage: failureStageSchema.optional(),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.status === "SUCCEEDED" && !run.postId) {
      context.addIssue({
        code: "custom",
        message: "成功した実行には postId が必要です",
        path: ["postId"],
      });
    }
    if (run.status === "FAILED" && !run.failureStage) {
      context.addIssue({
        code: "custom",
        message: "失敗した実行には failureStage が必要です",
        path: ["failureStage"],
      });
    }
  });

export const sourceDocumentSchema = z
  .object({
    url: httpsUrlSchema,
    title: z.string().trim().min(1).max(500),
    excerpt: z.string().trim().min(1).max(20_000),
    publishedAt: isoUtcDateTimeSchema.optional(),
  })
  .strict();

export const draftPostSchema = z
  .object({
    runId: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().trim().min(1).max(160),
    markdown: markdownSchema,
    sourceUrls: z.array(httpsUrlSchema).min(1).max(20),
    generatedAt: isoUtcDateTimeSchema,
  })
  .strict();

export const publishedPostSchema = z
  .object({
    postId: z.uuid(),
    title: z.string().trim().min(1).max(160),
    publishedAt: isoUtcDateTimeSchema,
    sourceUrls: z.array(httpsUrlSchema).min(1).max(20),
  })
  .strict();

export const postSummarySchema = publishedPostSchema.pick({
  postId: true,
  title: true,
  publishedAt: true,
});

export const postDetailSchema = publishedPostSchema.extend({
  markdown: markdownSchema,
});

export const postListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  .strict();

export const postIdPathParamsSchema = z.object({ postId: z.uuid() }).strict();

export const generationErrorCodeSchema = z.enum([
  "CONFIG_INVALID",
  "SOURCE_UNAVAILABLE",
  "SOURCE_INSUFFICIENT",
  "MODEL_THROTTLED",
  "MODEL_FAILURE",
  "GUARDRAIL_REJECTED",
  "CONTENT_INVALID",
  "PERSISTENCE_FAILURE",
  "TRANSACTION_CONFLICT",
  "DUPLICATE_RUN",
  "STATE_TRANSITION_INVALID",
]);

export const generationErrorSchema = z
  .object({
    code: generationErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    retriable: z.boolean(),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    code: z.enum(["BAD_REQUEST", "NOT_FOUND", "INTERNAL_ERROR"]),
    message: z.string().trim().min(1).max(200),
  })
  .strict();

export const appConfigSchema = z
  .object({
    environment: z.literal("challenge"),
    timezone: z.literal("Asia/Tokyo"),
    scheduleExpression: z.string().regex(/^cron\(.+\)$/),
    bedrockModelId: z.string().trim().min(1),
    allowedSourceOrigins: z.array(allowedSourceOriginSchema).min(1),
    logRetentionDays: z.number().int().positive(),
  })
  .strict();

export type RunStatus = z.infer<typeof runStatusSchema>;
export type FailureStage = z.infer<typeof failureStageSchema>;
export type GenerationRun = z.infer<typeof generationRunSchema>;
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type DraftPost = z.infer<typeof draftPostSchema>;
export type PublishedPost = z.infer<typeof publishedPostSchema>;
export type PostSummary = z.infer<typeof postSummarySchema>;
export type PostDetail = z.infer<typeof postDetailSchema>;
export type PostListQuery = z.infer<typeof postListQuerySchema>;
export type PostIdPathParams = z.infer<typeof postIdPathParamsSchema>;
export type GenerationErrorCode = z.infer<typeof generationErrorCodeSchema>;
export type GenerationError = z.infer<typeof generationErrorSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
