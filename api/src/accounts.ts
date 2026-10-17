import { HttpError } from "./http";
import type { Env, PublicProfile } from "./types";

export interface AccountRow extends PublicProfile {
  id: string;
}

const PUBLIC_COLUMNS = "id, loom_number, handle, display_name, founder_number";

export type AccountRef = { kind: "number"; value: number } | { kind: "handle"; value: string };

/** Aceita `123`, `#000123` ou `@handle`. */
export function parseRef(raw: string): AccountRef {
  const ref = decodeURIComponent(raw).trim();
  const num = /^#?(\d{1,9})$/.exec(ref);
  if (num) return { kind: "number", value: Number(num[1]) };
  const handle = /^@([A-Za-z0-9_.]{3,20})$/.exec(ref);
  if (handle) return { kind: "handle", value: handle[1]!.toLowerCase() };
  throw new HttpError(400, "invalid_ref", "Use o ID (ex.: 123 ou #000123) ou o @handle.");
}

export async function findAccount(env: Env, raw: string): Promise<AccountRow> {
  const ref = parseRef(raw);
  const column = ref.kind === "number" ? "loom_number" : "handle";
  const row = await env.DB_ID.prepare(
    `SELECT ${PUBLIC_COLUMNS} FROM accounts WHERE ${column} = ? AND status = 'ativa'`,
  )
    .bind(ref.value)
    .first<AccountRow>();
  if (!row) throw new HttpError(404, "loomer_not_found");
  return row;
}

export async function accountsById(env: Env, ids: string[]): Promise<Map<string, AccountRow>> {
  const unique = [...new Set(ids)];
  const map = new Map<string, AccountRow>();
  if (unique.length === 0) return map;
  const placeholders = unique.map(() => "?").join(",");
  const { results } = await env.DB_ID.prepare(
    `SELECT ${PUBLIC_COLUMNS} FROM accounts WHERE id IN (${placeholders}) AND status = 'ativa'`,
  )
    .bind(...unique)
    .all<AccountRow>();
  for (const row of results) map.set(row.id, row);
  return map;
}

export function publicProfile(row: AccountRow): PublicProfile {
  return {
    loom_number: row.loom_number,
    handle: row.handle,
    display_name: row.display_name,
    founder_number: row.founder_number,
  };
}
