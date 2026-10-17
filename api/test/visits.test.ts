import { describe, expect, it } from "vitest";
import { api, body, seedUser, type TestUser } from "./helpers";

async function invite(host: TestUser, guest: TestUser): Promise<string> {
  const res = await api("/v1/invites", { token: host.token, body: { to: `#${guest.loom_number}` } });
  expect(res.status).toBe(201);
  return (await body(res)).id;
}

async function accept(guest: TestUser, inviteId: string) {
  return api(`/v1/invites/${inviteId}/accept`, { method: "POST", token: guest.token });
}

describe("convites e visitas", () => {
  it("convite → aceite: o visitante aparece no quarto e o wallpaper dele mostra o quarto do anfitrião", async () => {
    const host = await seedUser(20);
    const guest = await seedUser(21);
    await api("/v1/rooms/me", { method: "PUT", token: host.token, body: { visibility: "private" } });

    const id = await invite(host, guest);
    const list = await body(await api("/v1/invites", { token: guest.token }));
    expect(list.incoming).toEqual([{ id, from: expect.objectContaining({ loom_number: 20 }), created_at: expect.any(String) }]);
    expect((await body(await api("/v1/invites", { token: host.token }))).outgoing).toHaveLength(1);

    // Antes de aceitar, o quarto privado continua fechado para o convidado.
    expect((await api("/v1/rooms/20", { token: guest.token })).status).toBe(404);

    const res = await accept(guest, id);
    expect(res.status).toBe(200);
    const visitId = (await body(res)).visit_id;

    const view = await body(await api("/v1/me/view", { token: guest.token }));
    expect(view).toEqual({ role: "guest", room_owner: expect.objectContaining({ loom_number: 20 }), visit_id: visitId });

    // Durante a visita, o visitante vê o quarto privado, com as 2 pessoas.
    const m = await body(await api("/v1/rooms/20", { token: guest.token }));
    expect(m.people.map((p: any) => [p.position, p.role, p.profile.loom_number])).toEqual([
      [0, "owner", 20],
      [1, "guest", 21],
    ]);
    expect(m.people[1].visit_id).toBe(visitId);
  });

  it("convite vale nos dois sentidos", async () => {
    const a = await seedUser(22);
    const b = await seedUser(23);
    const toB = await invite(a, b);
    const toA = await invite(b, a);
    expect(toA).not.toBe(toB);
    // Não dá para duplicar um convite pendente.
    const dup = await api("/v1/invites", { token: a.token, body: { to: "23" } });
    expect((await body(dup)).error).toBe("invite_already_pending");
  });

  it("até 4 pessoas no quarto (dono + 3)", async () => {
    const host = await seedUser(30);
    const guests = await Promise.all([31, 32, 33, 34].map((n) => seedUser(n)));
    const ids = [];
    for (const g of guests) ids.push(await invite(host, g));
    for (let i = 0; i < 3; i++) expect((await accept(guests[i]!, ids[i]!)).status).toBe(200);
    const full = await accept(guests[3]!, ids[3]!);
    expect(full.status).toBe(409);
    expect((await body(full)).error).toBe("room_full");
    expect((await body(await api("/v1/rooms/30"))).people).toHaveLength(4);
  });

  it("visitante está em um quarto por vez", async () => {
    const h1 = await seedUser(40);
    const h2 = await seedUser(41);
    const g = await seedUser(42);
    const i1 = await invite(h1, g);
    const i2 = await invite(h2, g);
    expect((await accept(g, i1)).status).toBe(200);
    const res = await accept(g, i2);
    expect((await body(res)).error).toBe("already_visiting");
  });

  it("visitante sai, ou o dono retira", async () => {
    const host = await seedUser(50);
    const g1 = await seedUser(51);
    const g2 = await seedUser(52);
    const v1 = (await body(await accept(g1, await invite(host, g1)))).visit_id;
    const v2 = (await body(await accept(g2, await invite(host, g2)))).visit_id;

    // Só o próprio visitante pode "sair"; só o dono pode "retirar".
    expect((await api(`/v1/visits/${v1}/leave`, { method: "POST", token: host.token })).status).toBe(404);
    expect((await api(`/v1/visits/${v2}/remove`, { method: "POST", token: g2.token })).status).toBe(404);

    expect((await api(`/v1/visits/${v1}/leave`, { method: "POST", token: g1.token })).status).toBe(200);
    expect((await api(`/v1/visits/${v2}/remove`, { method: "POST", token: host.token })).status).toBe(200);
    expect((await api(`/v1/visits/${v2}/remove`, { method: "POST", token: host.token })).status).toBe(409);

    expect((await body(await api("/v1/rooms/50"))).people).toHaveLength(1);
    expect((await body(await api("/v1/me/view", { token: g1.token }))).role).toBe("owner");
  });

  it("recusar, cancelar e não mexer no convite dos outros", async () => {
    const host = await seedUser(60);
    const guest = await seedUser(61);
    const stranger = await seedUser(62);
    const i1 = await invite(host, guest);
    expect((await accept(stranger, i1)).status).toBe(404);
    expect((await api(`/v1/invites/${i1}/decline`, { method: "POST", token: guest.token })).status).toBe(200);
    expect((await accept(guest, i1)).status).toBe(409);

    const i2 = await invite(host, guest);
    expect((await api(`/v1/invites/${i2}/cancel`, { method: "POST", token: guest.token })).status).toBe(404);
    expect((await api(`/v1/invites/${i2}/cancel`, { method: "POST", token: host.token })).status).toBe(200);
  });

  it("não convida a si mesmo nem quem não existe", async () => {
    const u = await seedUser(70);
    expect((await body(await api("/v1/invites", { token: u.token, body: { to: "70" } }))).error).toBe("cannot_invite_self");
    expect((await api("/v1/invites", { token: u.token, body: { to: "@ninguem" } })).status).toBe(404);
  });
});
