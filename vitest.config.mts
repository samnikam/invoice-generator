import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Unit tests live next to the code they test: src/**/foo.test.ts
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
