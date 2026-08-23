# Conventions

- Biome is the workspace formatter/linter: spaces for indentation, double quotes in JavaScript/TypeScript, recommended lint rules, and import organization enabled.
- Prefer module-local changes: browser UI in frontend, HTTP/Lambda contract in backend, cloud resources in CDK.
- Package modules are ESM; retain existing TypeScript module conventions.
- Do not assume backend deployment side effects are safe: Lambda name is currently hard-coded as `hello`.