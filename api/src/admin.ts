import { findAccount, publicProfile } from "./accounts";
import { HttpError, nowIso } from "./http";
import type { Env } from "./types";

// Rotas internas, usadas pelo backoffice/experiências para criar itens e entregá-los.
const RARITIES = ["comum", "raro", "epico", "lendario"];
const SLOT_TYPES = ["prateleira", "mesa", "parede", "chao", "vestivel", "pet"];
const ITEM_ID_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export async function createItem(env: Env, body: Record<string, unknown>) {
  const { id, name, rarity, slot_type, edition_max, model_key } = body;
  if (typeof id !== "string" || !ITEM_ID_RE.test(id)) throw new HttpError(400, "invalid_item_id");
  if (typeof name !== "string" || !name.trim() || name.length > 80) throw new HttpError(400, "invalid_name");
  if (typeof rarity !== "string" || !RARITIES.includes(rarity)) throw new HttpError(400, "invalid_rarity");
  if (typeof slot_type !== "string" || !SLOT_TYPES.includes(slot_type)) throw new HttpError(400, "invalid_slot_type");
  if (edition_max !== undefined && edition_max !== null && (!Number.isInteger(edition_max) || (edition_max as number) < 1)) {
    throw new HttpError(400, "invalid_edition_max");
  }
  if (typeof model_key !== "string" || !model_key) throw new HttpError(400, "invalid_model_key");
  try {
    await env.DB_ROOMS.prepare(
      "INSERT INTO items (id, name, rarity, slot_type, edition_max, model_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, name.trim(), rarity, slot_type, edition_max ?? null, model_key, nowIso())
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE") || String(err).includes("PRIMARY")) throw new HttpError(409, "item_exists");
    throw err;
  }
  return { id };
}

/** Entrega o próximo exemplar numerado (#n/edição) de um item a um Loomer. */
export async function grantItem(env: Env, body: Record<string, unknown>) {
  const { item_id, to, source } = body;
  if (typeof item_id !== "string" || typeof to !== "string") throw new HttpError(400, "invalid_request");
  const account = await findAccount(env, to);
  const item = await env.DB_ROOMS.prepare("SELECT id, edition_max FROM items WHERE id = ?")
    .bind(item_id)
    .first<{ id: string; edition_max: number | null }>();
  if (!item) throw new HttpError(404, "item_not_found");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await env.DB_ROOMS.prepare(
        `INSERT INTO owned_items (item_id, serial, account_id, source, acquired_at)
         SELECT ?, next, ?, ?, ? FROM (SELECT COALESCE(MAX(serial), 0) + 1 AS next FROM owned_items WHERE item_id = ?)
          WHERE ? IS NULL OR next <= ?
         RETURNING serial`,
      )
        .bind(item.id, account.id, typeof source === "string" ? source.slice(0, 40) : "experiencia", nowIso(), item.id, item.edition_max, item.edition_max)
        .first<{ serial: number }>();
      if (!row) throw new HttpError(409, "edition_sold_out", "Todos os exemplares deste item já foram entregues.");
      return { item_id: item.id, serial: row.serial, edition_max: item.edition_max, to: publicProfile(account) };
    } catch (err) {
      // Duas entregas simultâneas podem disputar o mesmo número: tenta de novo.
      if (err instanceof HttpError || !String(err).includes("UNIQUE")) throw err;
    }
  }
  throw new HttpError(503, "busy_try_again");
}
