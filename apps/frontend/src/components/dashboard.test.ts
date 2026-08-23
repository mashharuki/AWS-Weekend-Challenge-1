import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PostHistory, PostViewer, RunStatus } from "./dashboard.js";

const postId = "018a9f3a-5d6e-7f80-9a0b-1c2d3e4f5a6b";
const publishedAt = "2026-08-23T00:00:00.000Z";

test("投稿履歴は最新投稿を選択可能な一覧として表示する", () => {
  const markup = renderToStaticMarkup(
    createElement(PostHistory, {
      onSelect: () => undefined,
      posts: [
        { postId, title: "Build an AWS checklist", publishedAt },
        {
          postId: "018a9f3a-5d6e-7f80-9a0b-1c2d3e4f5a6c",
          title: "Design a local meetup",
          publishedAt: "2026-08-22T00:00:00.000Z",
        },
      ],
      selectedPostId: postId,
    }),
  );

  assert.match(markup, /Build an AWS checklist/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /Design a local meetup/);
});

test("本文と実行証跡は安全な Markdown と失敗段階を表示する", () => {
  const postMarkup = renderToStaticMarkup(
    createElement(PostViewer, {
      content: {
        status: "ready",
        post: {
          postId,
          title: "Build an AWS checklist",
          publishedAt,
          sourceUrls: ["https://aws.amazon.com/blogs/aws/example"],
          markdown:
            "# Checklist\n\n- Build a demo\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))",
        },
      },
    }),
  );
  assert.match(postMarkup, /Checklist/);
  assert.doesNotMatch(postMarkup, /<script>/);
  assert.doesNotMatch(postMarkup, /href="javascript:/);

  const runMarkup = renderToStaticMarkup(
    createElement(RunStatus, {
      run: {
        runId: "2026-08-23",
        status: "FAILED",
        scheduledAt: publishedAt,
        completedAt: publishedAt,
        failureStage: "RESEARCH",
      },
    }),
  );
  assert.match(runMarkup, /RESEARCH/);
  assert.match(runMarkup, /FAILED/);
});
