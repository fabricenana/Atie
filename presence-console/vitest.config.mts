import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname), "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Les tests n'écrivent jamais dans .demo-data du projet.
    env: { ATIE_DEMO_DATA_DIR: path.join(os.tmpdir(), `atie-console-test-${process.pid}`) },
  },
});
