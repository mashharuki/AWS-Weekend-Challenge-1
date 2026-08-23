import {
  type SourceDocument,
  sourceDocumentSchema,
} from "../shared/contracts.js";
import { GenerationFailure } from "./generation-error.js";

export interface HttpTransport {
  fetch(
    url: string,
    init?: { signal?: AbortSignal },
  ): Promise<{
    ok: boolean;
    status: number;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
  }>;
}

export interface SourceCollectorConfig {
  allowedSourceOrigins: string[];
  candidateUrls: string[];
  timeoutMs: number;
  maxResponseBytes: number;
  minDocuments: number;
}

const normalizeText = (value: string): string =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sourceTitle = (html: string): string | undefined => {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = match ? normalizeText(match[1]) : "";
  return title || undefined;
};

const defaultHttpTransport: HttpTransport = {
  async fetch(url: string, init?: { signal?: AbortSignal }) {
    return globalThis.fetch(url, init);
  },
};

export class SourceCollector {
  public constructor(
    private readonly config: SourceCollectorConfig,
    private readonly http: HttpTransport = defaultHttpTransport,
  ) {}

  public async collect(): Promise<SourceDocument[]> {
    const allowedOrigins = this.allowedOrigins();
    const documents: SourceDocument[] = [];

    for (const candidateUrl of this.config.candidateUrls) {
      const url = this.validateUrl(candidateUrl, allowedOrigins);
      let response: Awaited<ReturnType<HttpTransport["fetch"]>>;

      try {
        response = await this.fetchWithTimeout(url.toString());
      } catch {
        throw new GenerationFailure("SOURCE_UNAVAILABLE", true);
      }

      if (!response.ok) {
        throw new GenerationFailure(
          "SOURCE_UNAVAILABLE",
          response.status >= 500,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (
        !contentType.startsWith("text/html") &&
        !contentType.startsWith("text/plain")
      ) {
        throw new GenerationFailure("SOURCE_UNAVAILABLE", false);
      }

      const body = await response.text();
      if (
        new TextEncoder().encode(body).byteLength > this.config.maxResponseBytes
      ) {
        throw new GenerationFailure("SOURCE_UNAVAILABLE", false);
      }

      const excerpt = normalizeText(body);
      if (!excerpt) {
        continue;
      }

      documents.push(
        sourceDocumentSchema.parse({
          url: url.toString(),
          ...(sourceTitle(body) ? { title: sourceTitle(body) } : {}),
          excerpt,
        }),
      );
    }

    if (documents.length < this.config.minDocuments) {
      throw new GenerationFailure("SOURCE_INSUFFICIENT", false);
    }

    return documents;
  }

  private allowedOrigins(): Set<string> {
    const origins = new Set<string>();
    for (const origin of this.config.allowedSourceOrigins) {
      const parsed = new URL(origin);
      if (parsed.protocol !== "https:") {
        throw new GenerationFailure("CONFIG_INVALID", false);
      }
      origins.add(parsed.origin);
    }
    return origins;
  }

  private validateUrl(value: string, allowedOrigins: Set<string>): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new GenerationFailure("CONFIG_INVALID", false);
    }
    if (url.protocol !== "https:" || !allowedOrigins.has(url.origin)) {
      throw new GenerationFailure("CONFIG_INVALID", false);
    }
    return url;
  }

  private async fetchWithTimeout(url: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await this.http.fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
