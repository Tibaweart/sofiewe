import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

await applyD1Migrations(env.DB_ID, env.ID_MIGRATIONS);
await applyD1Migrations(env.DB_ROOMS, env.ROOMS_MIGRATIONS);
