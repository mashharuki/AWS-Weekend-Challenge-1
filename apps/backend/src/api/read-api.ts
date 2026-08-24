import { Hono } from "hono";
import {
  apiErrorSchema,
  type GenerationRun,
  type PostSummary,
  type PublishedPost,
  postDetailSchema,
  postIdPathParamsSchema,
  postListQuerySchema,
} from "../shared/contracts.js";

export interface PublishedPostReader {
  listPublished(limit: number): Promise<readonly PostSummary[]>;
  getPublished(postId: string): Promise<PublishedPost | null>;
}

export interface MarkdownReader {
  getPublished(postId: string): Promise<string>;
}

export interface LatestRunReader {
  getLatestRun(): Promise<GenerationRun | null>;
}

export interface ReadApiDependencies {
  readonly posts: PublishedPostReader;
  readonly markdown: MarkdownReader;
  readonly runs: LatestRunReader;
}

const errorResponse = (
  code: "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL_ERROR",
  message: string,
) => apiErrorSchema.parse({ code, message });

export const createReadApi = (dependencies: ReadApiDependencies): Hono => {
  const app = new Hono();

  app.get("/health", (context) => context.json({ status: "ok" }));

  app.get("/api/posts", async (context) => {
    const parsed = postListQuerySchema.safeParse(context.req.query());
    if (!parsed.success) {
      return context.json(
        errorResponse("BAD_REQUEST", "Invalid request."),
        400,
      );
    }
    try {
      return context.json(
        await dependencies.posts.listPublished(parsed.data.limit),
      );
    } catch (error: unknown) {
      console.info(
        JSON.stringify({
          errorName: error instanceof Error ? error.name : "unknown",
          event: "post-list-load-failed",
        }),
      );
      return context.json(
        errorResponse("INTERNAL_ERROR", "Unable to load posts."),
        500,
      );
    }
  });

  app.get("/api/posts/:postId", async (context) => {
    const parsed = postIdPathParamsSchema.safeParse({
      postId: context.req.param("postId"),
    });
    if (!parsed.success) {
      return context.json(errorResponse("NOT_FOUND", "Post not found."), 404);
    }
    try {
      const post = await dependencies.posts.getPublished(parsed.data.postId);
      if (!post) {
        return context.json(errorResponse("NOT_FOUND", "Post not found."), 404);
      }
      const markdown = await dependencies.markdown.getPublished(post.postId);
      return context.json(
        postDetailSchema.parse({
          markdown,
          postId: post.postId,
          publishedAt: post.publishedAt,
          sourceUrls: post.sourceUrls,
          title: post.title,
        }),
      );
    } catch (error: unknown) {
      console.info(
        JSON.stringify({
          errorName: error instanceof Error ? error.name : "unknown",
          event: "post-detail-load-failed",
          issues:
            typeof error === "object" &&
            error !== null &&
            "issues" in error &&
            Array.isArray(error.issues)
              ? error.issues.map((issue) =>
                  typeof issue === "object" && issue !== null
                    ? {
                        code:
                          "code" in issue && typeof issue.code === "string"
                            ? issue.code
                            : "unknown",
                        path:
                          "path" in issue && Array.isArray(issue.path)
                            ? issue.path
                            : [],
                      }
                    : { code: "unknown", path: [] },
                )
              : [],
        }),
      );
      return context.json(
        errorResponse("INTERNAL_ERROR", "Unable to load post."),
        500,
      );
    }
  });

  app.get("/api/runs/latest", async (context) => {
    try {
      const run = await dependencies.runs.getLatestRun();
      if (!run) {
        return context.json(errorResponse("NOT_FOUND", "Run not found."), 404);
      }
      return context.json(run);
    } catch {
      return context.json(
        errorResponse("INTERNAL_ERROR", "Unable to load run."),
        500,
      );
    }
  });

  return app;
};
