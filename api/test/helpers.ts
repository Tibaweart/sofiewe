import { env, exports } from "cloudflare:workers";
import { sha256Hex } from "../src/crypto";

export interface TestUser {
  id: string;
  loom_number: number;
  token: string;
}

const now = () => new Date().toISOString();

/** Cria uma conta e uma sessão do site (como o theloom.com.br faria). */
export async function seedUser(loomNumber: number, opts: { app?: string; status?: string } = {}): Promise<TestUser> {
  const id = `acc-${loomNumber}`;
  await env.DB_ID.prepare(
    `INSERT INTO accounts (id, loom_number, email, display_name, password_hash, password_salt, password_iter, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'x', 'x', 1, ?, ?, ?)`,
  )
    .bind(id, loomNumber, `u${loomNumber}@test.dev`, `Loomer ${loomNumber}`, opts.status ?? "ativa", now(), now())
    .run();
  const token = `token-${loomNumber}-${crypto.randomUUID()}`;
  await env.DB_ID.prepare("INSERT INTO sessions (token_hash, account_id, app, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256Hex(token), id, opts.app ?? "site", now(), new Date(Date.now() + 86400_000).toISOString())
    .run();
  return { id, loom_number: loomNumber, token };
}

export async function api(
  path: string,
  init: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...init.headers };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  return exports.default.fetch(
    new Request(`https://api.test${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

export async function body<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export const ADMIN = "test-admin-token";

export async function createItem(id: string, slot_type: string, edition_max: number | null = 100) {
  const res = await api("/v1/admin/items", {
    token: ADMIN,
    body: { id, name: id, rarity: "raro", slot_type, edition_max, model_key: `items/${id}.glb` },
  });
  if (res.status !== 201) throw new Error(`createItem ${res.status} ${await res.text()}`);
}

export async function grant(item_id: string, to: number): Promise<number> {
  const res = await api("/v1/admin/grants", { token: ADMIN, body: { item_id, to: String(to) } });
  if (res.status !== 201) throw new Error(`grant ${res.status} ${await res.text()}`);
  return (await body(res)).serial;
}
