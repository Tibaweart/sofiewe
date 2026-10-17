import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { api, body, seedUser } from "./helpers";

async function connect(path: string, token?: string) {
  const headers: Record<string, string> = { upgrade: "websocket" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await exports.default.fetch(new Request(`https://api.test${path}`, { headers }));
  return res;
}

function collect(ws: WebSocket) {
  const messages: any[] = [];
  ws.addEventListener("message", (e) => {
    messages.push(e.data === "pong" ? "pong" : JSON.parse(e.data as string));
  });
  ws.accept();
  const waitFor = async (pred: (m: any) => boolean, ms = 2000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = messages.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`mensagem não chegou: ${JSON.stringify(messages)}`);
  };
  return { messages, waitFor };
}

describe("tempo real", () => {
  it("convite chega no app do convidado e a visita no canal do quarto", async () => {
    const host = await seedUser(90);
    const guest = await seedUser(91);

    const userRes = await connect("/v1/me/live", guest.token);
    expect(userRes.status).toBe(101);
    const guestWs = userRes.webSocket!;
    const guestInbox = collect(guestWs);
    await guestInbox.waitFor((m) => m.type === "hello");

    const roomRes = await connect("/v1/rooms/90/live");
    expect(roomRes.status).toBe(101);
    const roomWs = roomRes.webSocket!;
    const roomInbox = collect(roomWs);
    await roomInbox.waitFor((m) => m.type === "hello");

    const inviteId = (await body(await api("/v1/invites", { token: host.token, body: { to: "91" } }))).id;
    const received = await guestInbox.waitFor((m) => m.type === "invite.received");
    expect(received).toEqual({ type: "invite.received", invite_id: inviteId, from: expect.objectContaining({ loom_number: 90 }) });

    await api(`/v1/invites/${inviteId}/accept`, { method: "POST", token: guest.token });
    await roomInbox.waitFor((m) => m.type === "visit.started");
    await guestInbox.waitFor((m) => m.type === "view.changed" && m.reason === "visit_started");

    await api("/v1/rooms/me", { method: "PUT", token: host.token, body: { atmosphere_lock: "noite" } });
    expect(await roomInbox.waitFor((m) => m.type === "room.updated")).toEqual({ type: "room.updated", version: 1 });

    roomWs.send("ping");
    await roomInbox.waitFor((m) => m === "pong");

    guestWs.close();
    roomWs.close();
  });

  it("canal de quarto privado exige permissão; canal da conta exige login", async () => {
    const owner = await seedUser(92);
    await api("/v1/rooms/me", { method: "PUT", token: owner.token, body: { visibility: "private" } });
    expect((await connect("/v1/rooms/92/live")).status).toBe(401);
    expect((await connect("/v1/me/live")).status).toBe(401);
    expect((await api("/v1/me/live", { token: owner.token })).status).toBe(426);
    const ok = await connect("/v1/rooms/92/live", owner.token);
    expect(ok.status).toBe(101);
    ok.webSocket!.accept();
    ok.webSocket!.close();
  });
});
