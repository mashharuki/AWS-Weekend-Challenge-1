import assert from "node:assert/strict";
import test from "node:test";
import { isSafeHref } from "./markdown.js";

test("Markdown リンクは許可プロトコルだけを通す", () => {
  assert.equal(isSafeHref("https://aws.amazon.com/"), true);
  assert.equal(isSafeHref("mailto:builder@example.com"), true);
  assert.equal(isSafeHref("javascript:alert(1)"), false);
  assert.equal(isSafeHref("data:text/html,unsafe"), false);
});
