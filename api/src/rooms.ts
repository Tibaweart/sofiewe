import { accountsById, publicProfile, type AccountRow } from "./accounts";
import { HttpError, nowIso } from "./http";
import { LOFT_SLOTS } from "./slots";
import type { Env, PublicProfile, Viewer } from "./types";

export const VISIBILITIES = ["public", "private"] as const;
export const CHARACTER_BASES = ["masculino", "feminino"] as const;
export const ATMOSPHERES = ["manha", "tarde", "fim_de_tarde", "noite"] as const;

export interface RoomRow {
  account_id: string;
  visibility: (typeof VISIBILITIES)[number];
  style: string;
  character_base: (typeof CHARACTER_BASES)[number];
  atmosphere_lock: (typeof ATMOSPHERES)[number] | null;
  version: number;
  updated_at: string;
}

/** Conta sem quarto salvo ainda: quarto padrão público. */
export function defaultRoom(accountId: string): RoomRow {
  return {
    account_id: accountId,
    visibility: "public",
    style: "loft",
    character_base: "masculino",
    atmosphere_lock: null,
    version: 0,
    updated_at: "1970-01-01T00:00:00.000Z",
  };
}

export async function getRoom(env: Env, accountId: string): Promise<RoomRow> {
  const row = await env.DB_ROOMS.prepare("SELECT * FROM rooms WHERE account_id = ?").bind(accountId).first<RoomRow>();
  return row ?? defaultRoom(accountId);
}

export interface ActiveVisit {
  id: string;
  host_account: string;
  guest_account: string;
  started_at: string;
}

export async function activeVisitsForHost(env: Env, hostId: string): Promise<ActiveVisit[]> {
  const { results } = await env.DB_ROOMS.prepare(
    `SELECT id, host_account, guest_account, started_at FROM visits
      WHERE host_account = ? AND ended_at IS NULL ORDER BY started_at, id`,
  )
    .bind(hostId)
    .all<ActiveVisit>();
  return results;
}

/** Quarto público: todos. Privado: só o dono e quem está visitando agora. */
export function canView(room: RoomRow, viewer: Viewer | null, visits: ActiveVisit[]): boolean {
  if (room.visibility === "public") return true;
  if (!viewer) return false;
  if (viewer.id === room.account_id) return true;
  return visits.some((v) => v.guest_account === viewer.id);
}

interface PlacedItemRow {
  slot: string;
  item_id: string;
  serial: number;
  name: string;
  rarity: string;
  slot_type: string;
  edition_max: number | null;
  model_key: string;
}

export interface Manifest {
  format: "myloom.room/1";
  owner: PublicProfile;
  version: number;
  updated_at: string;
  visibility: RoomRow["visibility"];
  style: string;
  atmosphere_lock: RoomRow["atmosphere_lock"];
  people: Array<{ position: number; role: "owner" | "guest"; character_base: string; profile: PublicProfile; visit_id?: string }>;
  items: Array<{
    slot: string;
    item: { id: string; name: string; rarity: string; slot_type: string; serial: number; edition_max: number | null; model_key: string };
  }>;
}

export async function buildManifest(env: Env, owner: AccountRow, room: RoomRow, visits: ActiveVisit[]): Promise<Manifest> {
  const { results: placed } = await env.DB_ROOMS.prepare(
    `SELECT ri.slot, ri.item_id, ri.serial, i.name, i.rarity, i.slot_type, i.edition_max, i.model_key
       FROM room_items ri JOIN items i ON i.id = ri.item_id
      WHERE ri.account_id = ? ORDER BY ri.slot`,
  )
    .bind(owner.id)
    .all<PlacedItemRow>();

  const guestIds = visits.map((v) => v.guest_account);
  const guests = await accountsById(env, guestIds);
  const guestRooms = new Map<string, string>();
  if (guestIds.length) {
    const placeholders = guestIds.map(() => "?").join(",");
    const { results } = await env.DB_ROOMS.prepare(
      `SELECT account_id, character_base FROM rooms WHERE account_id IN (${placeholders})`,
    )
      .bind(...guestIds)
      .all<{ account_id: string; character_base: string }>();
    for (const r of results) guestRooms.set(r.account_id, r.character_base);
  }

  const people: Manifest["people"] = [
    { position: 0, role: "owner", character_base: room.character_base, profile: publicProfile(owner) },
  ];
  for (const visit of visits) {
    const guest = guests.get(visit.guest_account);
    if (!guest) continue; // conta bloqueada: some do quarto
    people.push({
      position: people.length,
      role: "guest",
      character_base: guestRooms.get(guest.id) ?? "masculino",
      profile: publicProfile(guest),
      visit_id: visit.id,
    });
  }

  return {
    format: "myloom.room/1",
    owner: publicProfile(owner),
    version: room.version,
    updated_at: room.updated_at,
    visibility: room.visibility,
    style: room.style,
    atmosphere_lock: room.atmosphere_lock,
    people,
    items: placed.map((p) => ({
      slot: p.slot,
      item: {
        id: p.item_id,
        name: p.name,
        rarity: p.rarity,
        slot_type: p.slot_type,
        serial: p.serial,
        edition_max: p.edition_max,
        model_key: p.model_key,
      },
    })),
  };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], code: string): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new HttpError(400, code);
}

interface PlacementInput {
  slot: string;
  item_id: string;
  serial: number;
}

function parsePlacements(raw: unknown): PlacementInput[] {
  if (!Array.isArray(raw) || raw.length > LOFT_SLOTS.size) throw new HttpError(400, "invalid_items");
  const slots = new Set<string>();
  const copies = new Set<string>();
  return raw.map((entry) => {
    if (typeof entry !== "object" || entry === null) throw new HttpError(400, "invalid_items");
    const { slot, item_id, serial } = entry as Record<string, unknown>;
    if (typeof slot !== "string" || !LOFT_SLOTS.has(slot)) throw new HttpError(400, "invalid_slot", `Slot inválido: ${String(slot)}`);
    if (typeof item_id !== "string" || !Number.isInteger(serial) || (serial as number) < 1) throw new HttpError(400, "invalid_items");
    const copy = `${item_id}#${serial}`;
    if (slots.has(slot) || copies.has(copy)) throw new HttpError(400, "duplicate_placement");
    slots.add(slot);
    copies.add(copy);
    return { slot, item_id, serial: serial as number };
  });
}

/** Salva o quarto (chamado pelo editor do site). Retorna a nova versão. */
export async function saveRoom(env: Env, viewer: Viewer, body: Record<string, unknown>): Promise<RoomRow> {
  const current = await getRoom(env, viewer.id);
  const next: RoomRow = {
    ...current,
    visibility: body.visibility === undefined ? current.visibility : oneOf(body.visibility, VISIBILITIES, "invalid_visibility"),
    character_base:
      body.character_base === undefined ? current.character_base : oneOf(body.character_base, CHARACTER_BASES, "invalid_character_base"),
    atmosphere_lock:
      body.atmosphere_lock === undefined
        ? current.atmosphere_lock
        : body.atmosphere_lock === null
          ? null
          : oneOf(body.atmosphere_lock, ATMOSPHERES, "invalid_atmosphere"),
    version: current.version + 1,
    updated_at: nowIso(),
  };

  const statements: D1PreparedStatement[] = [
    env.DB_ROOMS.prepare(
      `INSERT INTO rooms (account_id, visibility, style, character_base, atmosphere_lock, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (account_id) DO UPDATE SET visibility = excluded.visibility, character_base = excluded.character_base,
         atmosphere_lock = excluded.atmosphere_lock, version = rooms.version + 1, updated_at = excluded.updated_at`,
    ).bind(next.account_id, next.visibility, next.style, next.character_base, next.atmosphere_lock, next.version, next.updated_at),
  ];

  if (body.items !== undefined) {
    const placements = parsePlacements(body.items);
    if (placements.length) {
      // Confere posse e tipo de slot de uma vez.
      const conditions = placements.map(() => "(o.item_id = ? AND o.serial = ?)").join(" OR ");
      const { results } = await env.DB_ROOMS.prepare(
        `SELECT o.item_id, o.serial, i.slot_type FROM owned_items o JOIN items i ON i.id = o.item_id
          WHERE o.account_id = ? AND (${conditions})`,
      )
        .bind(viewer.id, ...placements.flatMap((p) => [p.item_id, p.serial]))
        .all<{ item_id: string; serial: number; slot_type: string }>();
      const owned = new Map(results.map((r) => [`${r.item_id}#${r.serial}`, r.slot_type]));
      for (const p of placements) {
        const slotType = owned.get(`${p.item_id}#${p.serial}`);
        if (!slotType) throw new HttpError(403, "item_not_owned", `Item ${p.item_id} #${p.serial} não é seu.`);
        if (slotType !== LOFT_SLOTS.get(p.slot)) throw new HttpError(400, "slot_type_mismatch", `${p.item_id} não cabe em ${p.slot}.`);
      }
    }
    statements.push(env.DB_ROOMS.prepare("DELETE FROM room_items WHERE account_id = ?").bind(viewer.id));
    for (const p of placements) {
      statements.push(
        env.DB_ROOMS.prepare("INSERT INTO room_items (account_id, slot, item_id, serial) VALUES (?, ?, ?, ?)").bind(
          viewer.id,
          p.slot,
          p.item_id,
          p.serial,
        ),
      );
    }
  }

  await env.DB_ROOMS.batch(statements);
  return getRoom(env, viewer.id);
}
