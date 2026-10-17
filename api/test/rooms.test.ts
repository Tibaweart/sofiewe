import { describe, expect, it } from "vitest";
import { api, body, createItem, grant, seedUser } from "./helpers";

describe("quartos", () => {
  it("conta sem quarto salvo tem o loft padrão público", async () => {
    await seedUser(10);
    const res = await api("/v1/rooms/10");
    expect(res.status).toBe(200);
    const m = await body(res);
    expect(m.format).toBe("myloom.room/1");
    expect(m.style).toBe("loft");
    expect(m.visibility).toBe("public");
    expect(m.people).toEqual([
      { position: 0, role: "owner", character_base: "masculino", profile: expect.objectContaining({ loom_number: 10 }) },
    ]);
    expect(m.items).toEqual([]);
  });

  it("salvar aumenta a versão e muda personagem/atmosfera", async () => {
    const u = await seedUser(11);
    let res = await api("/v1/rooms/me", { method: "PUT", token: u.token, body: { character_base: "feminino", atmosphere_lock: "noite" } });
    expect(res.status).toBe(200);
    expect((await body(res)).version).toBe(1);
    res = await api("/v1/rooms/me", { method: "PUT", token: u.token, body: { atmosphere_lock: null } });
    expect((await body(res)).version).toBe(2);
    const m = await body(await api("/v1/rooms/11"));
    expect(m.people[0].character_base).toBe("feminino");
    expect(m.atmosphere_lock).toBeNull();
    expect(m.version).toBe(2);
  });

  it("valida valores", async () => {
    const u = await seedUser(12);
    const bad = await api("/v1/rooms/me", { method: "PUT", token: u.token, body: { visibility: "amigos" } });
    expect(bad.status).toBe(400);
    expect((await body(bad)).error).toBe("invalid_visibility");
  });

  it("quarto privado: só o dono vê", async () => {
    const owner = await seedUser(13);
    const other = await seedUser(14);
    await api("/v1/rooms/me", { method: "PUT", token: owner.token, body: { visibility: "private" } });
    expect((await api("/v1/rooms/13")).status).toBe(401);
    expect((await api("/v1/rooms/13", { token: other.token })).status).toBe(404);
    expect((await api("/v1/rooms/13", { token: owner.token })).status).toBe(200);
    // O perfil continua público (sem o conteúdo do quarto).
    expect((await body(await api("/v1/loomers/13"))).room.visibility).toBe("private");
  });

  it("expõe itens próprios nos slots certos", async () => {
    const u = await seedUser(15);
    const thief = await seedUser(16);
    await createItem("capacete-neon", "prateleira", 100);
    await createItem("gato-laranja", "pet", null);
    const s1 = await grant("capacete-neon", 15);
    const s2 = await grant("capacete-neon", 15);
    expect([s1, s2]).toEqual([1, 2]);
    const pet = await grant("gato-laranja", 15);

    let res = await api("/v1/rooms/me", {
      method: "PUT",
      token: u.token,
      body: {
        items: [
          { slot: "prateleira-1", item_id: "capacete-neon", serial: 2 },
          { slot: "pet", item_id: "gato-laranja", serial: pet },
        ],
      },
    });
    expect(res.status).toBe(200);
    const m = await body(await api("/v1/rooms/15"));
    expect(m.items).toEqual([
      { slot: "pet", item: expect.objectContaining({ id: "gato-laranja", serial: 1, edition_max: null }) },
      {
        slot: "prateleira-1",
        item: { id: "capacete-neon", name: "capacete-neon", rarity: "raro", slot_type: "prateleira", serial: 2, edition_max: 100, model_key: "items/capacete-neon.glb" },
      },
    ]);

    res = await api("/v1/rooms/me", { method: "PUT", token: u.token, body: { items: [{ slot: "mesa-1", item_id: "gato-laranja", serial: pet }] } });
    expect((await body(res)).error).toBe("slot_type_mismatch");

    res = await api("/v1/rooms/me", { method: "PUT", token: thief.token, body: { items: [{ slot: "prateleira-1", item_id: "capacete-neon", serial: 1 }] } });
    expect(res.status).toBe(403);

    res = await api("/v1/rooms/me", { method: "PUT", token: u.token, body: { items: [{ slot: "teto", item_id: "capacete-neon", serial: 1 }] } });
    expect((await body(res)).error).toBe("invalid_slot");

    res = await api("/v1/rooms/me", {
      method: "PUT",
      token: u.token,
      body: { items: [{ slot: "prateleira-1", item_id: "capacete-neon", serial: 1 }, { slot: "prateleira-2", item_id: "capacete-neon", serial: 1 }] },
    });
    expect((await body(res)).error).toBe("duplicate_placement");

    // Lista vazia tira tudo do quarto.
    await api("/v1/rooms/me", { method: "PUT", token: u.token, body: { items: [] } });
    expect((await body(await api("/v1/rooms/15"))).items).toEqual([]);
  });
});

describe("itens (interno)", () => {
  it("exige o token de admin", async () => {
    expect((await api("/v1/admin/items", { body: {} })).status).toBe(401);
    expect((await api("/v1/admin/items", { token: "errado", body: {} })).status).toBe(401);
  });

  it("numera exemplares e respeita a tiragem", async () => {
    await seedUser(17);
    await createItem("trofeu-nexus", "prateleira", 2);
    expect(await grant("trofeu-nexus", 17)).toBe(1);
    expect(await grant("trofeu-nexus", 17)).toBe(2);
    const res = await api("/v1/admin/grants", { token: "test-admin-token", body: { item_id: "trofeu-nexus", to: "17" } });
    expect(res.status).toBe(409);
    expect((await body(res)).error).toBe("edition_sold_out");
  });
});
