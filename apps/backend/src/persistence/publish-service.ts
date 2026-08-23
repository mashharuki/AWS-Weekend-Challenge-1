import { randomUUID } from "node:crypto";
import {
  type DraftPost,
  draftPostSchema,
  type PublishedPost,
} from "../shared/contracts.js";
import type { DynamoDbRunPostRepository } from "./dynamodb-repository.js";
import type { MarkdownStore } from "./markdown-store.js";

export class PublishService {
  constructor(
    private readonly repository: DynamoDbRunPostRepository,
    private readonly markdownStore: MarkdownStore,
    private readonly createPostId: () => string = randomUUID,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async publish(draftInput: DraftPost): Promise<PublishedPost> {
    const draft = draftPostSchema.parse(draftInput);
    const postId = this.createPostId();
    const publishedAt = this.now();
    const bodyKey = await this.markdownStore.putPublished(
      postId,
      draft.markdown,
    );
    return this.repository.publish({ draft, postId, bodyKey, publishedAt });
  }
}
