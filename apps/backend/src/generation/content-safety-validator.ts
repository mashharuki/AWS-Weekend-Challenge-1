import {
  type DraftPost,
  draftPostSchema,
  type SourceDocument,
  sourceDocumentSchema,
} from "../shared/contracts.js";
import type { GuardrailPort } from "./bedrock-guardrail.js";
import { GenerationFailure } from "./generation-error.js";

const hasUsefulEnglishContent = (markdown: string): boolean => {
  const letters = markdown.match(/[A-Za-z]/g)?.length ?? 0;
  return (
    letters >= 20 &&
    /\b(idea|build|create|develop|prototype|implement)\b/i.test(markdown) &&
    /^#\s+\S/m.test(markdown)
  );
};

export class ContentSafetyValidator {
  private readonly allowedOrigins: Set<string>;

  public constructor(
    allowedSourceOrigins: string[],
    private readonly guardrail: GuardrailPort,
  ) {
    this.allowedOrigins = new Set(
      allowedSourceOrigins.map((origin) => new URL(origin).origin),
    );
  }

  public async validateSource(source: SourceDocument): Promise<SourceDocument> {
    let validated: SourceDocument;
    try {
      validated = sourceDocumentSchema.parse(source);
    } catch {
      throw new GenerationFailure("CONTENT_INVALID", false);
    }
    this.validateSourceUrl(validated.url);
    const result = await this.guardrail.assess({
      source: "INPUT",
      content: validated.excerpt,
    });
    if (result.blocked) {
      throw new GenerationFailure("GUARDRAIL_REJECTED", false);
    }
    return validated;
  }

  public async validateDraft(draft: DraftPost): Promise<DraftPost> {
    let validated: DraftPost;
    try {
      validated = draftPostSchema.parse(draft);
    } catch {
      throw new GenerationFailure("CONTENT_INVALID", false);
    }
    if (!hasUsefulEnglishContent(validated.markdown)) {
      throw new GenerationFailure("CONTENT_INVALID", false);
    }
    for (const sourceUrl of validated.sourceUrls) {
      this.validateSourceUrl(sourceUrl);
    }
    const result = await this.guardrail.assess({
      source: "OUTPUT",
      content: validated.markdown,
    });
    if (result.blocked) {
      throw new GenerationFailure("GUARDRAIL_REJECTED", false);
    }
    return validated;
  }

  private validateSourceUrl(value: string): void {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new GenerationFailure("CONTENT_INVALID", false);
    }
    if (url.protocol !== "https:" || !this.allowedOrigins.has(url.origin)) {
      throw new GenerationFailure("CONTENT_INVALID", false);
    }
  }
}
