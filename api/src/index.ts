import { findAccount, publicProfile } from "./accounts";
import { createItem, grantItem } from "./admin";
import { authenticate, requireAdmin, requireViewer } from "./auth";
import { approveDeviceLogin, pollDeviceLogin, revokeSession, startDeviceLogin } from "./device";
import { setHandle } from "./handle";
import { corsHeaders, errorResponse, HttpError, json, readJson } from "./http";
import { channelStub, publish } from "./live";
import { activeVisitsForHost, buildManifest, canView, getRoom, saveRoom } from "./rooms";
import type { Ctx, Env } from "./types";
import { acceptInvite, closeInvite, createInvite, currentView, endVisit, listInvites, roomChannel, userChannel } from "./visits";
import { weatherFor } from "./weather";

export { Channel } from "./live";

type Handler = (c: Ctx) => Promise<Response>;
const routes: Array<[method: string, pattern: RegExp, handler: Handler]> = [];
const route = (method: string, path: string, handler: Handler) =>
  routes.push([method, new RegExp(`^${path.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`), handler]);

function isWebSocket(req: Request): boolean {
  return req.headers.get("upgrade")?.toLowerCase() === "websocket";
}

route("GET", "/health", async () => json({ ok: true }));

// ---- Perfis e quartos (leitura pública) ----

route("GET", "/v1/loomers/:ref", async ({ env, params }) => {
  const account = await findAccount(env, params.ref!);
  const room = await getRoom(env, account.id);
  return json({ profile: publicProfile(account), room: { visibility: room.visibility, version: room.version } });
});

route("GET", "/v1/rooms/:ref", async ({ env, req, url, params }) => {
  const owner = await findAccount(env, params.ref!);
  const [room, visits, viewer] = await Promise.all([
    getRoom(env, owner.id),
    activeVisitsForHost(env, owner.id),
    authenticate(env, req, url),
  ]);
  // Quarto privado responde 404 para quem não pode ver: não revela o conteúdo.
  if (!canView(room, viewer, visits)) throw new HttpError(viewer ? 404 : 401, viewer ? "room_not_found" : "login_required");
  return json(await buildManifest(env, owner, room, visits));
});

route("GET", "/v1/rooms/:ref/live", async ({ env, req, url, params }) => {
  if (!isWebSocket(req)) throw new HttpError(426, "upgrade_required");
  const owner = await findAccount(env, params.ref!);
  const [room, visits, viewer] = await Promise.all([
    getRoom(env, owner.id),
    activeVisitsForHost(env, owner.id),
    authenticate(env, req, url),
  ]);
  if (!canView(room, viewer, visits)) throw new HttpError(viewer ? 404 : 401, viewer ? "room_not_found" : "login_required");
  return channelStub(env, roomChannel(owner.id)).fetch(req);
});

// ---- Conta logada ----

route("GET", "/v1/me", async ({ env, req, url }) => {
  const viewer = await requireViewer(env, req, url);
  return json({ profile: publicProfile(viewer), view: await currentView(env, viewer) });
});

route("GET", "/v1/me/view", async ({ env, req, url }) => json(await currentView(env, await requireViewer(env, req, url))));

route("GET", "/v1/me/live", async ({ env, req, url }) => {
  if (!isWebSocket(req)) throw new HttpError(426, "upgrade_required");
  const viewer = await requireViewer(env, req, url);
  return channelStub(env, userChannel(viewer.id)).fetch(req);
});

route("PUT", "/v1/me/handle", async ({ env, req, url }) => {
  const viewer = await requireViewer(env, req, url);
  const body = await readJson(req);
  return json({ handle: await setHandle(env, viewer, body.handle) });
});

route("PUT", "/v1/rooms/me", async ({ env, req, url, exec }) => {
  const viewer = await requireViewer(env, req, url);
  const room = await saveRoom(env, viewer, await readJson(req));
  publish(env, exec, [{ channel: roomChannel(viewer.id), event: { type: "room.updated", version: room.version } }]);
  return json({ version: room.version, updated_at: room.updated_at });
});

// ---- Convites e visitas ----

route("GET", "/v1/invites", async ({ env, req, url }) => json(await listInvites(env, await requireViewer(env, req, url))));

route("POST", "/v1/invites", async ({ env, req, url, exec }) => {
  const viewer = await requireViewer(env, req, url);
  const { invite, notices } = await createInvite(env, viewer, (await readJson(req)).to);
  publish(env, exec, notices);
  return json({ id: invite.id, status: invite.status }, 201);
});

route("POST", "/v1/invites/:id/accept", async ({ env, req, url, exec, params }) => {
  const viewer = await requireViewer(env, req, url);
  const { visit, notices } = await acceptInvite(env, viewer, params.id!);
  publish(env, exec, notices);
  return json({ visit_id: visit.id });
});

for (const action of ["decline", "cancel"] as const) {
  route("POST", `/v1/invites/:id/${action}`, async ({ env, req, url, exec, params }) => {
    const viewer = await requireViewer(env, req, url);
    publish(env, exec, await closeInvite(env, viewer, params.id!, action));
    return json({ ok: true });
  });
}

for (const action of ["leave", "remove"] as const) {
  route("POST", `/v1/visits/:id/${action}`, async ({ env, req, url, exec, params }) => {
    const viewer = await requireViewer(env, req, url);
    publish(env, exec, await endVisit(env, viewer, params.id!, action));
    return json({ ok: true });
  });
}

// ---- Login do app por código ----

route("POST", "/v1/device/code", async ({ env }) => json(await startDeviceLogin(env)));
route("POST", "/v1/device/token", async ({ env, req }) => pollDeviceLogin(env, (await readJson(req)).device_code));
route("POST", "/v1/device/approve", async ({ env, req, url }) => {
  const viewer = await requireViewer(env, req, url);
  await approveDeviceLogin(env, viewer, (await readJson(req)).user_code);
  return json({ ok: true });
});
route("POST", "/v1/session/revoke", async ({ env, req }) => {
  await revokeSession(env, req);
  return json({ ok: true });
});

// ---- Clima ----

route("GET", "/v1/weather", async ({ req, exec }) => weatherFor(req, exec));

// ---- Interno ----

route("POST", "/v1/admin/items", async ({ env, req }) => {
  requireAdmin(env, req);
  return json(await createItem(env, await readJson(req)), 201);
});
route("POST", "/v1/admin/grants", async ({ env, req }) => {
  requireAdmin(env, req);
  return json(await grantItem(env, await readJson(req)), 201);
});

export default {
  async fetch(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const cors = corsHeaders(req.headers.get("origin"), env.ALLOWED_ORIGINS);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    let res: Response;
    try {
      res = await dispatch({ env, req, url, exec, params: {} });
    } catch (err) {
      if (err instanceof HttpError) res = errorResponse(err);
      else {
        console.error(err);
        res = errorResponse(new HttpError(500, "internal_error"));
      }
    }
    if (res.status === 101 || Object.keys(cors).length === 0) return res;
    const withCors = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) withCors.headers.set(k, v);
    return withCors;
  },
} satisfies ExportedHandler<Env>;

async function dispatch(c: Ctx): Promise<Response> {
  let pathMatched = false;
  for (const [method, pattern, handler] of routes) {
    const m = pattern.exec(c.url.pathname);
    if (!m) continue;
    pathMatched = true;
    if (method !== c.req.method) continue;
    return handler({ ...c, params: { ...m.groups } });
  }
  throw pathMatched ? new HttpError(405, "method_not_allowed") : new HttpError(404, "not_found");
}
