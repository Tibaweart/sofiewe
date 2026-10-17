export interface Env {
  DB_ID: D1Database;
  DB_ROOMS: D1Database;
  CHANNEL: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
  VERIFICATION_URI: string;
  ADMIN_TOKEN?: string;
}

/** Perfil público de um Loomer (nunca inclui e-mail, telefone ou id interno). */
export interface PublicProfile {
  loom_number: number;
  handle: string | null;
  display_name: string;
  founder_number: number | null;
}

/** Conta autenticada pela sessão. */
export interface Viewer extends PublicProfile {
  id: string;
  app: string;
}

export interface Ctx {
  env: Env;
  req: Request;
  url: URL;
  exec: ExecutionContext;
  params: Record<string, string>;
}
