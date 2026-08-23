# Task Completion

- For frontend changes: run `pnpm --filter frontend build`; also run `pnpm --filter frontend lint` when changing frontend source.
- For backend changes: run `pnpm --filter backend build`.
- For CDK changes: run `pnpm --filter cdk build` and `pnpm --filter cdk test`.
- For shared TypeScript/config/style changes: run `pnpm check` (Biome check with writes) only when formatting changes are acceptable; otherwise use the relevant package builds.
- Consider `pnpm knip` for dependency/configuration changes and `pnpm jscpd` for substantial additions.