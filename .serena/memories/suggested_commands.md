# Suggested Commands

- Install workspace dependencies: `pnpm install`.
- Root formatting: `pnpm format`; root Biome check/fix: `pnpm check`.
- Frontend: `pnpm --filter frontend dev`, `pnpm --filter frontend build`, `pnpm --filter frontend lint`, `pnpm --filter frontend preview`.
- Backend: `pnpm --filter backend build`; package: `pnpm --filter backend zip`; AWS deploy: `pnpm --filter backend deploy`.
- CDK: `pnpm --filter cdk build`, `pnpm --filter cdk test`, `pnpm --filter cdk cdk -- <subcommand>`.
- Structural checks: `pnpm knip`; duplication scan: `pnpm jscpd`.
- macOS shell is zsh; no project-specific Darwin command variants identified.