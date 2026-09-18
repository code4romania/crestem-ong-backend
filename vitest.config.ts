import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `@strapi/*` packages ship an ESM entry (`dist/index.mjs`) that
    // re-exports `lodash/fp` as a bare directory import. Node's native ESM
    // resolver (which Vitest defers to for externalized deps) rejects that
    // with ERR_UNSUPPORTED_DIR_IMPORT. Inlining these packages routes them
    // through Vite's own, more lenient module resolution instead.
    server: {
      deps: {
        inline: [/@strapi\//],
      },
    },
  },
});
