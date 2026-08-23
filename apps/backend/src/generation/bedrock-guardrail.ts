import {
  ApplyGuardrailCommand,
  type BedrockRuntimeClient,
} from "@aws-sdk/client-bedrock-runtime";
import { GenerationFailure } from "./generation-error.js";

export type GuardrailSource = "INPUT" | "OUTPUT";

export interface GuardrailPort {
  assess(input: {
    source: GuardrailSource;
    content: string;
  }): Promise<{ blocked: boolean }>;
}

export class BedrockGuardrail implements GuardrailPort {
  public constructor(
    private readonly client: BedrockRuntimeClient,
    private readonly guardrailIdentifier: string,
    private readonly guardrailVersion: string,
  ) {}

  public async assess(input: {
    source: GuardrailSource;
    content: string;
  }): Promise<{ blocked: boolean }> {
    try {
      const result = await this.client.send(
        new ApplyGuardrailCommand({
          guardrailIdentifier: this.guardrailIdentifier,
          guardrailVersion: this.guardrailVersion,
          source: input.source,
          content: [{ text: { text: input.content } }],
        }),
      );
      return { blocked: result.action === "GUARDRAIL_INTERVENED" };
    } catch {
      throw new GenerationFailure("GUARDRAIL_REJECTED", false);
    }
  }
}
