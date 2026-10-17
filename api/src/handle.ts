import { HttpError, nowIso } from "./http";
import type { Env, Viewer } from "./types";

const HANDLE_RE = /^[a-z0-9_](?:[a-z0-9_]|\.(?!\.)){1,18}[a-z0-9_]$/;

const RESERVED = new Set([
  "admin", "administrador", "api", "app", "ativar", "help", "ajuda", "loom", "loomer", "me", "myloom",
  "null", "root", "staff", "suporte", "support", "system", "theloom", "undefined", "wallpaper", "www",
]);

/** 3–20 caracteres: letras minúsculas, números, `_` e `.` (sem ponto no início, no fim ou repetido). */
export function normalizeHandle(raw: unknown): string {
  if (typeof raw !== "string") throw new HttpError(400, "invalid_handle");
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  if (!HANDLE_RE.test(handle)) {
    throw new HttpError(400, "invalid_handle", "Use de 3 a 20 caracteres: letras, números, _ e ponto.");
  }
  if (RESERVED.has(handle)) throw new HttpError(409, "handle_reserved");
  return handle;
}

export async function setHandle(env: Env, viewer: Viewer, raw: unknown): Promise<string> {
  const handle = normalizeHandle(raw);
  try {
    await env.DB_ID.prepare("UPDATE accounts SET handle = ?, updated_at = ? WHERE id = ?")
      .bind(handle, nowIso(), viewer.id)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new HttpError(409, "handle_taken");
    throw err;
  }
  return handle;
}
