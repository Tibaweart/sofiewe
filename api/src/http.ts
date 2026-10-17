const MAX_BODY_BYTES = 64 * 1024;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function errorResponse(err: HttpError): Response {
  return json({ error: err.code, message: err.message }, err.status);
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large");
  if (!text) return {} as T;
  try {
    const value = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error();
    return value as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

/** Origem permitida para o site (o app desktop não usa CORS). */
export function corsHeaders(origin: string | null, allowed: string): Record<string, string> {
  if (!origin) return {};
  const list = allowed.split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export const nowIso = (): string => new Date().toISOString();
