import type { GenerationRun, PostDetail, PostSummary } from "../types/api.js";

export type Fetcher = (path: string) => Promise<Response>;

export interface ReadApiClient {
  listPosts(): Promise<readonly PostSummary[]>;
  getPost(postId: string): Promise<PostDetail>;
  getLatestRun(): Promise<GenerationRun | null>;
}

export class ApiClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isPostSummary = (value: unknown): value is PostSummary =>
  isRecord(value) &&
  isString(value.postId) &&
  isString(value.title) &&
  isString(value.publishedAt);

const isPostDetail = (value: unknown): value is PostDetail =>
  isRecord(value) &&
  isString(value.postId) &&
  isString(value.title) &&
  isString(value.publishedAt) &&
  Array.isArray(value.sourceUrls) &&
  value.sourceUrls.every(isString) &&
  isString(value.markdown);

const isGenerationRun = (value: unknown): value is GenerationRun =>
  isRecord(value) &&
  isString(value.runId) &&
  isString(value.scheduledAt) &&
  (value.status === "RUNNING" ||
    value.status === "SUCCEEDED" ||
    value.status === "FAILED" ||
    value.status === "DUPLICATE");

const getJson = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    throw new ApiClientError("The service is unavailable.");
  }
  try {
    return await response.json();
  } catch {
    throw new ApiClientError("The service returned an invalid response.");
  }
};

export const createApiClient = (fetcher: Fetcher): ReadApiClient => ({
  async listPosts() {
    const payload = await getJson(await fetcher("/api/posts"));
    if (!Array.isArray(payload) || !payload.every(isPostSummary)) {
      throw new ApiClientError("The service returned an invalid response.");
    }
    return payload;
  },
  async getPost(postId: string) {
    const payload = await getJson(await fetcher(`/api/posts/${postId}`));
    if (!isPostDetail(payload)) {
      throw new ApiClientError("The service returned an invalid response.");
    }
    return payload;
  },
  async getLatestRun() {
    const response = await fetcher("/api/runs/latest");
    if (response.status === 404) {
      return null;
    }
    const payload = await getJson(response);
    if (!isGenerationRun(payload)) {
      throw new ApiClientError("The service returned an invalid response.");
    }
    return payload;
  },
});

export const apiClient = createApiClient((path) => globalThis.fetch(path));
