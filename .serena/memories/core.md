# Project Core

- pnpm workspace monorepo: `apps/frontend`, `apps/backend`, `apps/cdk`.
- Frontend, Lambda-style HTTP backend, and infrastructure are intentionally separate deploy/build units.
- Read `mem:frontend/core` for React/Vite app structure; `mem:backend/core` for Hono handler details; `mem:cdk/core` for AWS CDK structure.
- Read `mem:tech_stack` for pinned tooling; `mem:suggested_commands` and `mem:task_completion` before running validation.