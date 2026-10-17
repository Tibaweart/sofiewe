import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const roomsMigrations = await readD1Migrations("./migrations/rooms");
  const idMigrations = [
    ...(await readD1Migrations("./test/fixtures")),
    ...(await readD1Migrations("./migrations/id")),
  ];
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            ROOMS_MIGRATIONS: roomsMigrations,
            ID_MIGRATIONS: idMigrations,
            ADMIN_TOKEN: "test-admin-token",
          },
        },
      }),
    ],
    test: { setupFiles: ["./test/apply-migrations.ts"] },
  };
});
