import { WALLPAPER_APP } from "./auth";
import { randomToken, sha256Hex, userCode } from "./crypto";
import { HttpError, json, nowIso } from "./http";
import type { Env, Viewer } from "./types";

// Login do app My Loom por código (RFC 8628). Só é necessário para quarto privado e visitas.
const CODE_TTL_SECONDS = 10 * 60;
const POLL_INTERVAL_SECONDS = 5;
const SESSION_TTL_DAYS = 180;

interface DeviceRow {
  device_code_hash: string;
  user_code: string;
  account_id: string | null;
  expires_at: string;
  approved_at: string | null;
  consumed_at: string | null;
  last_polled_at: string | null;
}

const addSeconds = (iso: string, s: number) => new Date(Date.parse(iso) + s * 1000).toISOString();

/** Passo 1 (app): pede um par de códigos. O app mostra o `user_code` e abre o `verification_uri`. */
export async function startDeviceLogin(env: Env) {
  const deviceCode = randomToken();
  const code = userCode();
  const now = nowIso();
  await env.DB_ROOMS.prepare(
    "INSERT INTO device_codes (device_code_hash, user_code, created_at, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(await sha256Hex(deviceCode), code, now, addSeconds(now, CODE_TTL_SECONDS))
    .run();
  return {
    device_code: deviceCode,
    user_code: code,
    verification_uri: env.VERIFICATION_URI,
    verification_uri_complete: `${env.VERIFICATION_URI}?code=${encodeURIComponent(code)}`,
    expires_in: CODE_TTL_SECONDS,
    interval: POLL_INTERVAL_SECONDS,
  };
}

/** Passo 2 (site, logado): a pessoa confirma o código que está vendo na tela do PC. */
export async function approveDeviceLogin(env: Env, viewer: Viewer, raw: unknown) {
  if (viewer.app === WALLPAPER_APP) throw new HttpError(403, "approve_from_site");
  if (typeof raw !== "string") throw new HttpError(400, "invalid_code");
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2");
  const res = await env.DB_ROOMS.prepare(
    `UPDATE device_codes SET account_id = ?, approved_at = ?
      WHERE user_code = ? AND approved_at IS NULL AND expires_at > ?`,
  )
    .bind(viewer.id, nowIso(), code, nowIso())
    .run();
  if (!res.meta.changes) throw new HttpError(404, "invalid_code", "Código inválido ou expirado.");
}

/** Passo 3 (app): consulta a cada `interval` segundos até receber o token. */
export async function pollDeviceLogin(env: Env, raw: unknown): Promise<Response> {
  if (typeof raw !== "string" || !raw) return json({ error: "invalid_request" }, 400);
  const hash = await sha256Hex(raw);
  const row = await env.DB_ROOMS.prepare("SELECT * FROM device_codes WHERE device_code_hash = ?").bind(hash).first<DeviceRow>();
  const now = nowIso();
  if (!row || row.consumed_at) return json({ error: "invalid_grant" }, 400);
  if (row.expires_at <= now) return json({ error: "expired_token" }, 400);

  const tooSoon = row.last_polled_at && Date.parse(now) - Date.parse(row.last_polled_at) < (POLL_INTERVAL_SECONDS - 1) * 1000;
  await env.DB_ROOMS.prepare("UPDATE device_codes SET last_polled_at = ? WHERE device_code_hash = ?").bind(now, hash).run();
  if (tooSoon) return json({ error: "slow_down" }, 400);
  if (!row.approved_at || !row.account_id) return json({ error: "authorization_pending" }, 400);

  // Marca como usado antes de emitir a sessão: um código vale um token só.
  const consumed = await env.DB_ROOMS.prepare(
    "UPDATE device_codes SET consumed_at = ? WHERE device_code_hash = ? AND consumed_at IS NULL",
  )
    .bind(now, hash)
    .run();
  if (!consumed.meta.changes) return json({ error: "invalid_grant" }, 400);

  const token = randomToken();
  const expiresIn = SESSION_TTL_DAYS * 24 * 3600;
  await env.DB_ID.prepare(
    "INSERT INTO sessions (token_hash, account_id, app, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(await sha256Hex(token), row.account_id, WALLPAPER_APP, now, addSeconds(now, expiresIn))
    .run();
  return json({ access_token: token, token_type: "Bearer", expires_in: expiresIn });
}

/** Sair no app: revoga só a sessão do wallpaper. */
export async function revokeSession(env: Env, req: Request) {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new HttpError(401, "unauthorized");
  await env.DB_ID.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL AND app = ?")
    .bind(nowIso(), await sha256Hex(header.slice(7).trim()), WALLPAPER_APP)
    .run();
}
