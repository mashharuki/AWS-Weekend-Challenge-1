# CDK

- `apps/cdk`: AWS CDK v2 TypeScript app.
- App entry: `bin/cdk.ts`; stack: `lib/cdk-stack.ts` (`CdkStack`).
- Stack currently contains scaffold comments only; tests live in `test/cdk.test.ts`.
- Use the package-local CDK script through pnpm filtering; validate with its TypeScript build and Jest test commands.