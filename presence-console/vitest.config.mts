import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname), "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PostgreSQL en WASM (PGlite) : démarrage et migrations prennent quelques secondes par fichier.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Valeurs factices : aucun appel réseau réel (fetch simulé), aucune vraie base.
    env: {
      SUPABASE_URL: "https://auth.test.invalid",
      SUPABASE_ANON_KEY: "cle-anon-de-test",
      SUPABASE_SERVICE_ROLE_KEY: "cle-service-de-test",
      ATIE_SESSION_SECRET: "secret-de-session-de-test-0123456789abcdef",
      ATIE_CONSOLE_URL: "https://console.test.invalid",
      DATABASE_URL: "",
    },
  },
});
