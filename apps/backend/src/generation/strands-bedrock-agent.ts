import { Agent, BedrockModel } from "@strands-agents/sdk";
import type { DraftGeneratorPort } from "./research-agent.js";

export interface StrandsBedrockDraftGeneratorOptions {
  region: string;
  modelId: string;
}

export class StrandsBedrockDraftGenerator implements DraftGeneratorPort {
  private readonly model: BedrockModel;

  public constructor(options: StrandsBedrockDraftGeneratorOptions) {
    this.model = new BedrockModel({
      region: options.region,
      modelId: options.modelId,
      maxTokens: 1_200,
      temperature: 0.2,
      // The workflow expects a complete JSON response, not a stream iterator.
      stream: false,
    });
  }

  public async generate(input: {
    systemInstruction: string;
    untrustedSourceContext: string;
  }): Promise<string> {
    const agent = new Agent({
      model: this.model,
      systemPrompt: input.systemInstruction,
      tools: [],
      printer: false,
    });
    const result = await agent.invoke(input.untrustedSourceContext);
    return result.toString();
  }
}
