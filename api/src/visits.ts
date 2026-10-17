import { accountsById, findAccount, publicProfile } from "./accounts";
import { HttpError, nowIso } from "./http";
import { MAX_GUESTS } from "./slots";
import type { Env, PublicProfile, Viewer } from "./types";

interface InviteRow {
  id: string;
  host_account: string;
  guest_account: string;
  status: "pending" | "accepted" | "declined" | "canceled";
  created_at: string;
  responded_at: string | null;
}

interface VisitRow {
  id: string;
  host_account: string;
  guest_account: string;
  invite_id: string;
  started_at: string;
  ended_at: string | null;
  ended_by: "guest" | "host" | null;
}

/** Eventos para os canais de tempo real, entregues depois da resposta HTTP. */
export interface Notice {
  channel: string;
  event: Record<string, unknown>;
}

export const roomChannel = (accountId: string) => `room:${accountId}`;
export const userChannel = (accountId: string) => `user:${accountId}`;

/** O anfitrião (quem convida) chama alguém para o próprio quarto. */
export async function createInvite(env: Env, host: Viewer, to: unknown): Promise<{ invite: InviteRow; notices: Notice[] }> {
  if (typeof to !== "string") throw new HttpError(400, "invalid_ref");
  const guest = await findAccount(env, to);
  if (guest.id === host.id) throw new HttpError(400, "cannot_invite_self");

  const already = await env.DB_ROOMS.prepare(
    "SELECT 1 FROM visits WHERE host_account = ? AND guest_account = ? AND ended_at IS NULL",
  )
    .bind(host.id, guest.id)
    .first();
  if (already) throw new HttpError(409, "already_visiting");

  const invite: InviteRow = {
    id: crypto.randomUUID(),
    host_account: host.id,
    guest_account: guest.id,
    status: "pending",
    created_at: nowIso(),
    responded_at: null,
  };
  try {
    await env.DB_ROOMS.prepare(
      "INSERT INTO invites (id, host_account, guest_account, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
    )
      .bind(invite.id, invite.host_account, invite.guest_account, invite.created_at)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new HttpError(409, "invite_already_pending");
    throw err;
  }
  return {
    invite,
    notices: [{ channel: userChannel(guest.id), event: { type: "invite.received", invite_id: invite.id, from: publicProfile(host) } }],
  };
}

async function getInvite(env: Env, id: string): Promise<InviteRow> {
  const invite = await env.DB_ROOMS.prepare("SELECT * FROM invites WHERE id = ?").bind(id).first<InviteRow>();
  if (!invite) throw new HttpError(404, "invite_not_found");
  return invite;
}

/**
 * Aceitar cria a visita numa única transação: só entra se o convite ainda estiver pendente,
 * o quarto tiver vaga (dono + 3) e o visitante não estiver em outro quarto.
 */
export async function acceptInvite(env: Env, guest: Viewer, inviteId: string): Promise<{ visit: VisitRow; notices: Notice[] }> {
  const invite = await getInvite(env, inviteId);
  if (invite.guest_account !== guest.id) throw new HttpError(404, "invite_not_found");
  if (invite.status !== "pending") throw new HttpError(409, "invite_not_pending");

  const busy = await env.DB_ROOMS.prepare("SELECT 1 FROM visits WHERE guest_account = ? AND ended_at IS NULL")
    .bind(guest.id)
    .first();
  if (busy) throw new HttpError(409, "already_visiting", "Saia do quarto atual antes de aceitar outro convite.");

  const now = nowIso();
  const visitId = crypto.randomUUID();
  let results: D1Result[];
  try {
    results = await env.DB_ROOMS.batch([
      env.DB_ROOMS.prepare(
        `INSERT INTO visits (id, host_account, guest_account, invite_id, started_at)
         SELECT ?, ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM invites WHERE id = ? AND status = 'pending' AND guest_account = ?)
            AND (SELECT COUNT(*) FROM visits WHERE host_account = ? AND ended_at IS NULL) < ?`,
      ).bind(visitId, invite.host_account, guest.id, invite.id, now, invite.id, guest.id, invite.host_account, MAX_GUESTS),
      env.DB_ROOMS.prepare(
        `UPDATE invites SET status = 'accepted', responded_at = ?
          WHERE id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM visits WHERE id = ?)`,
      ).bind(now, invite.id, visitId),
    ]);
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new HttpError(409, "already_visiting");
    throw err;
  }
  if (!results[0]?.meta.changes) {
    const fresh = await getInvite(env, inviteId);
    if (fresh.status !== "pending") throw new HttpError(409, "invite_not_pending");
    throw new HttpError(409, "room_full", "O quarto já está com 4 pessoas.");
  }

  const visit: VisitRow = {
    id: visitId,
    host_account: invite.host_account,
    guest_account: guest.id,
    invite_id: invite.id,
    started_at: now,
    ended_at: null,
    ended_by: null,
  };
  const event = { type: "visit.started", visit_id: visitId, guest: publicProfile(guest) };
  return {
    visit,
    notices: [
      { channel: roomChannel(invite.host_account), event },
      { channel: userChannel(invite.host_account), event },
      { channel: userChannel(guest.id), event: { type: "view.changed", reason: "visit_started", visit_id: visitId } },
    ],
  };
}

/** Recusar (convidado) ou cancelar (anfitrião) um convite pendente. */
export async function closeInvite(env: Env, viewer: Viewer, inviteId: string, action: "decline" | "cancel"): Promise<Notice[]> {
  const invite = await getInvite(env, inviteId);
  const isGuest = invite.guest_account === viewer.id;
  const isHost = invite.host_account === viewer.id;
  if ((action === "decline" && !isGuest) || (action === "cancel" && !isHost)) throw new HttpError(404, "invite_not_found");
  const status = action === "decline" ? "declined" : "canceled";
  const res = await env.DB_ROOMS.prepare("UPDATE invites SET status = ?, responded_at = ? WHERE id = ? AND status = 'pending'")
    .bind(status, nowIso(), inviteId)
    .run();
  if (!res.meta.changes) throw new HttpError(409, "invite_not_pending");
  const other = action === "decline" ? invite.host_account : invite.guest_account;
  return [{ channel: userChannel(other), event: { type: `invite.${status}`, invite_id: inviteId } }];
}

/** Visitante sai (`leave`) ou anfitrião retira (`remove`). */
export async function endVisit(env: Env, viewer: Viewer, visitId: string, action: "leave" | "remove"): Promise<Notice[]> {
  const visit = await env.DB_ROOMS.prepare("SELECT * FROM visits WHERE id = ?").bind(visitId).first<VisitRow>();
  const allowed = visit && (action === "leave" ? visit.guest_account === viewer.id : visit.host_account === viewer.id);
  if (!visit || !allowed) throw new HttpError(404, "visit_not_found");
  const endedBy = action === "leave" ? "guest" : "host";
  const res = await env.DB_ROOMS.prepare("UPDATE visits SET ended_at = ?, ended_by = ? WHERE id = ? AND ended_at IS NULL")
    .bind(nowIso(), endedBy, visitId)
    .run();
  if (!res.meta.changes) throw new HttpError(409, "visit_already_ended");
  const event = { type: "visit.ended", visit_id: visitId, ended_by: endedBy };
  return [
    { channel: roomChannel(visit.host_account), event },
    { channel: userChannel(visit.host_account), event },
    { channel: userChannel(visit.guest_account), event: { type: "view.changed", reason: "visit_ended", visit_id: visitId, ended_by: endedBy } },
  ];
}

export async function listInvites(env: Env, viewer: Viewer) {
  const { results } = await env.DB_ROOMS.prepare(
    `SELECT * FROM invites WHERE status = 'pending' AND (guest_account = ? OR host_account = ?) ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(viewer.id, viewer.id)
    .all<InviteRow>();
  const people = await accountsById(env, results.flatMap((r) => [r.host_account, r.guest_account]));
  const profile = (id: string): PublicProfile | null => {
    const row = people.get(id);
    return row ? publicProfile(row) : null;
  };
  return {
    incoming: results
      .filter((r) => r.guest_account === viewer.id)
      .map((r) => ({ id: r.id, from: profile(r.host_account), created_at: r.created_at })),
    outgoing: results
      .filter((r) => r.host_account === viewer.id)
      .map((r) => ({ id: r.id, to: profile(r.guest_account), created_at: r.created_at })),
  };
}

/**
 * Qual quarto o wallpaper desta pessoa deve mostrar agora:
 * o do anfitrião durante uma visita, senão o próprio.
 */
export async function currentView(env: Env, viewer: Viewer) {
  const visit = await env.DB_ROOMS.prepare("SELECT * FROM visits WHERE guest_account = ? AND ended_at IS NULL")
    .bind(viewer.id)
    .first<VisitRow>();
  if (visit) {
    const host = (await accountsById(env, [visit.host_account])).get(visit.host_account);
    if (host) return { role: "guest" as const, room_owner: publicProfile(host), visit_id: visit.id };
  }
  return { role: "owner" as const, room_owner: publicProfile(viewer) };
}
