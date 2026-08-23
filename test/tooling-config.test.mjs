import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readPackageJson = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

const assertDependency = (packageJson, dependency) => {
  assert.ok(
    packageJson.dependencies?.[dependency] ||
      packageJson.devDependencies?.[dependency],
    `${packageJson.name} must declare ${dependency}`,
  );
};

test("root scripts provide a complete local verification workflow", async () => {
  const root = await readPackageJson("../package.json");

  for (const script of [
    "format",
    "lint",
    "test",
    "build",
    "verify",
    "cdk:synth",
  ]) {
    assert.ok(root.scripts?.[script], `root package must define ${script}`);
  }
});

test("workspace packages declare the feature dependencies", async () => {
  const backend = await readPackageJson("../apps/backend/package.json");
  const frontend = await readPackageJson("../apps/frontend/package.json");
  const cdk = await readPackageJson("../apps/cdk/package.json");

  for (const dependency of [
    "@aws-sdk/client-bedrock-runtime",
    "@aws-sdk/client-dynamodb",
    "@aws-sdk/client-s3",
    "@aws-sdk/client-secrets-manager",
    "@aws-sdk/lib-dynamodb",
    "@strands-agents/sdk",
    "zod",
  ]) {
    assertDependency(backend, dependency);
  }

  for (const dependency of [
    "@tailwindcss/vite",
    "react-markdown",
    "remark-gfm",
    "tailwindcss",
  ]) {
    assertDependency(frontend, dependency);
  }

  for (const dependency of ["cdk-nag", "esbuild"]) {
    assertDependency(cdk, dependency);
  }
});
