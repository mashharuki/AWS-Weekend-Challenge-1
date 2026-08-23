import assert from "node:assert/strict";
import test from "node:test";
import type { SourceDocument } from "../shared/contracts.js";
import type { GuardrailPort } from "./bedrock-guardrail.js";
import { ContentSafetyValidator } from "./content-safety-validator.js";
import { GenerationFailure } from "./generation-error.js";
import { type DraftGeneratorPort, ResearchAgent } from "./research-agent.js";
import { type HttpTransport, SourceCollector } from "./source-collector.js";

const runId = "2026-08-23";
const generatedAt = "2026-08-23T00:00:00.000Z";
const sourceUrl = "https://aws.amazon.com/blogs/aws/example";

const source: SourceDocument = {
  url: sourceUrl,
  title: "AWS community update",
  excerpt: "A practical update for builders.",
  publishedAt: generatedAt,
};

class FakeHttpTransport implements HttpTransport {
  constructor(
    private readonly handler: (url: string) => Promise<{
      readonly ok: boolean;
      readonly status: number;
      readonly contentType: string | null;
      readonly body: string;
    }>,
  ) {}

  async fetch(url: string): Promise<{
    readonly ok: boolean;
    readonly status: number;
    readonly headers: { get(name: string): string | null };
    text(): Promise<string>;
  }> {
    const response = await this.handler(url);
    return {
      ok: response.ok,
      status: response.status,
      headers: { get: () => response.contentType },
      text: async () => response.body,
    };
  }
}

class FakeGuardrail implements GuardrailPort {
  readonly calls: Array<{ source: "INPUT" | "OUTPUT"; content: string }> = [];
  blockInput = false;
  blockOutput = false;

  async assess(input: {
    readonly source: "INPUT" | "OUTPUT";
    readonly content: string;
  }): Promise<{ readonly blocked: boolean }> {
    this.calls.push(input);
    return {
      blocked: input.source === "INPUT" ? this.blockInput : this.blockOutput,
    };
  }
}

class FakeDraftGenerator implements DraftGeneratorPort {
  calls: Array<{ systemInstruction: string; untrustedSourceContext: string }> =
    [];
  response = JSON.stringify({
    title: "Build an AWS community launch checklist",
    markdown:
      "# Launch checklist\n\nBuild a reusable checklist for a community launch.",
    sourceUrls: [sourceUrl],
  });
  failure: unknown;

  async generate(input: {
    readonly systemInstruction: string;
    readonly untrustedSourceContext: string;
  }): Promise<string> {
    this.calls.push(input);
    if (this.failure) {
      throw this.failure;
    }
    return this.response;
  }
}

test("許可済み HTTPS ソースだけを正規化して収集する", async () => {
  const collector = new SourceCollector(
    {
      allowedSourceOrigins: ["https://aws.amazon.com"],
      candidateUrls: [sourceUrl],
      timeoutMs: 100,
      maxResponseBytes: 10_000,
      minDocuments: 1,
    },
    new FakeHttpTransport(async () => ({
      ok: true,
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<html><head><title>AWS community update</title></head><body><p>A practical update for builders.</p></body></html>",
    })),
  );

  const documents = await collector.collect();

  assert.deepEqual(documents, [
    {
      url: sourceUrl,
      title: "AWS community update",
      excerpt: "AWS community update A practical update for builders.",
    },
  ]);
});

test("許可外 URL、タイムアウト、候補不足を分類済みエラーとして拒否する", async () => {
  const outsideOrigin = new SourceCollector(
    {
      allowedSourceOrigins: ["https://aws.amazon.com"],
      candidateUrls: ["https://example.com/post"],
      timeoutMs: 100,
      maxResponseBytes: 10_000,
      minDocuments: 1,
    },
    new FakeHttpTransport(async () => ({
      ok: true,
      status: 200,
      contentType: "text/html",
      body: "<title>ignored</title>",
    })),
  );
  await assert.rejects(
    () => outsideOrigin.collect(),
    hasCode("CONFIG_INVALID"),
  );

  const timeout = new SourceCollector(
    {
      allowedSourceOrigins: ["https://aws.amazon.com"],
      candidateUrls: [sourceUrl],
      timeoutMs: 100,
      maxResponseBytes: 10_000,
      minDocuments: 1,
    },
    new FakeHttpTransport(async () => {
      throw { name: "AbortError" };
    }),
  );
  await assert.rejects(() => timeout.collect(), hasCode("SOURCE_UNAVAILABLE"));
});

test("外部本文を非信頼コンテキストに隔離して Nova 用の草案を生成する", async () => {
  const guardrail = new FakeGuardrail();
  const generator = new FakeDraftGenerator();
  const agent = new ResearchAgent(
    generator,
    new ContentSafetyValidator(["https://aws.amazon.com"], guardrail),
    () => generatedAt,
  );

  const draft = await agent.generate(runId, [source]);

  assert.equal(draft.runId, runId);
  assert.equal(draft.title, "Build an AWS community launch checklist");
  assert.equal(generator.calls.length, 1);
  assert.equal(
    generator.calls[0]?.systemInstruction.includes(source.excerpt),
    false,
  );
  assert.equal(
    generator.calls[0]?.untrustedSourceContext.includes(source.excerpt),
    true,
  );
  assert.deepEqual(
    guardrail.calls.map((call) => call.source),
    ["INPUT", "OUTPUT"],
  );
});

test("Bedrock の一時障害と prompt attack を公開不能な分類済みエラーにする", async () => {
  const guardrail = new FakeGuardrail();
  const generator = new FakeDraftGenerator();
  generator.failure = { name: "ThrottlingException" };
  const agent = new ResearchAgent(
    generator,
    new ContentSafetyValidator(["https://aws.amazon.com"], guardrail),
    () => generatedAt,
  );
  await assert.rejects(
    () => agent.generate(runId, [source]),
    hasCode("MODEL_THROTTLED"),
  );

  const blockedGuardrail = new FakeGuardrail();
  blockedGuardrail.blockInput = true;
  const blockedAgent = new ResearchAgent(
    new FakeDraftGenerator(),
    new ContentSafetyValidator(["https://aws.amazon.com"], blockedGuardrail),
    () => generatedAt,
  );
  await assert.rejects(
    () => blockedAgent.generate(runId, [source]),
    hasCode("GUARDRAIL_REJECTED"),
  );
});

test("危険な HTML、英語でない本文、必須構造のない草案を公開前に拒否する", async () => {
  const validator = new ContentSafetyValidator(
    ["https://aws.amazon.com"],
    new FakeGuardrail(),
  );

  await assert.rejects(
    () =>
      validator.validateDraft({
        runId,
        title: "Unsafe",
        markdown: "# Unsafe\n<script>alert('x')</script>",
        sourceUrls: [sourceUrl],
        generatedAt,
      }),
    hasCode("CONTENT_INVALID"),
  );
  await assert.rejects(
    () =>
      validator.validateDraft({
        runId,
        title: "日本語の草案",
        markdown: "# アイデア\n\n新しいアプリを作る。",
        sourceUrls: [sourceUrl],
        generatedAt,
      }),
    hasCode("CONTENT_INVALID"),
  );
});

const hasCode =
  (code: string) =>
  (error: unknown): boolean =>
    error instanceof GenerationFailure && error.code === code;
