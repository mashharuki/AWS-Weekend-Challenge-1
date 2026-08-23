export interface PostSummary {
  readonly postId: string;
  readonly title: string;
  readonly publishedAt: string;
}

export interface PostDetail extends PostSummary {
  readonly sourceUrls: readonly string[];
  readonly markdown: string;
}

export type RunStatus = "RUNNING" | "SUCCEEDED" | "FAILED" | "DUPLICATE";

export interface GenerationRun {
  readonly runId: string;
  readonly status: RunStatus;
  readonly scheduledAt: string;
  readonly completedAt?: string;
  readonly postId?: string;
  readonly failureStage?: "START" | "RESEARCH" | "VALIDATE_PUBLISH";
}
