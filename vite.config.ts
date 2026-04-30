// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
//
// Path alias single source of truth: tsconfig.json `compilerOptions.paths`.
// vite-tsconfig-paths (bundled) reads tsconfig at build/dev time, and ESLint reads
// the same file via eslint-import-resolver-typescript. Do NOT add `resolve.alias`
// here — it would cause drift between TS, Vite, and ESLint.
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig();
