# Backend

- `apps/backend`: Node 20-targeted, esbuild-bundled Hono service intended for Lambda deployment.
- Entry: `src/index.ts`; creates a Hono app, exposes `GET /`, and exports Lambda-compatible `handler = handle(app)`.
- Build output is `dist/index.js`; packaging flattens it to `lambda.zip`; deploy script updates Lambda function named `hello`.
- AWS update is a material external action; run only when explicitly requested.