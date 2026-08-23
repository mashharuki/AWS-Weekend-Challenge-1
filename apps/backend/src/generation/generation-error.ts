import type { GenerationErrorCode } from "../shared/contracts.js";

export class GenerationFailure extends Error {
  public constructor(
    public readonly code: GenerationErrorCode,
    public readonly retriable: boolean,
  ) {
    super(code);
    this.name = "GenerationFailure";
  }
}
