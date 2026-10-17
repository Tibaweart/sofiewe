import { sha256Hex, timingSafeEqual } from "./crypto";
import { HttpError, nowIso } from "./http";
import type { Env, Viewer } from "./types";

export const WALLPAPER_APP = "wallpaper";

function bearer(req: Request, url: URL): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;
  // WebSocket no navegador não envia cabeçalhos: aceita o token na query só nas rotas /live.
  if (url.pathname.endsWith("/live")) return url.searchParams.get("access_token");
  return null;
}

/**
 * Sessões vivem em theloom-id.sessions, com o token guardado como SHA-256 em hex.
 * Premissa a confirmar com o código do site: mesmo hash e expires_at em ISO 8601 (UTC).
 */
export async function authenticate(env: Env, req: Request, url: URL): Promise<Viewer | null> {
  const token = bearer(req, url);
  if (!token) return null;
  const hash = await sha256Hex(token);
  return env.DB_ID.prepare(
    `SELECT a.id, a.loom_number, a.handle, a.display_name, a.founder_number, s.app
       FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND a.status = 'ativa'`,
  )
    .bind(hash, nowIso())
    .first<Viewer>();
}

export async function requireViewer(env: Env, req: Request, url: URL): Promise<Viewer> {
  const viewer = await authenticate(env, req, url);
  if (!viewer) throw new HttpError(401, "unauthorized");
  return viewer;
}

export function requireAdmin(env: Env, req: Request): void {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.ADMIN_TOKEN || !token || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    throw new HttpError(401, "unauthorized");
  }
}
