import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { api, body, seedUser } from "./helpers";

/** Simula a espera do intervalo de polling. */
async function rewindPoll() {
  await env.DB_ROOMS.prepare("UPDATE device_codes SET last_polled_at = '2000-01-01T00:00:00.000Z'").run();
}

describe("login do app por código", () => {
  it("fluxo completo: código → aprovação no site → token do wallpaper", async () => {
    const user = await seedUser(80);
    const start = await body(await api("/v1/device/code", { method: "POST" }));
    expect(start.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(start.verification_uri).toBe("https://theloom.com.br/ativar");
    expect(start.interval).toBe(5);

    let poll = await api("/v1/device/token", { body: { device_code: start.device_code } });
    expect((await body(poll)).error).toBe("authorization_pending");

    // Poll rápido demais.
    poll = await api("/v1/device/token", { body: { device_code: start.device_code } });
    expect((await body(poll)).error).toBe("slow_down");

    // A pessoa digita o código no site (aceita minúsculas e sem hífen).
    const typed = start.user_code.replace("-", "").toLowerCase();
    expect((await api("/v1/device/approve", { token: user.token, body: { user_code: typed } })).status).toBe(200);

    await rewindPoll();
    poll = await api("/v1/device/token", { body: { device_code: start.device_code } });
    expect(poll.status).toBe(200);
    const { access_token, token_type } = await body(poll);
    expect(token_type).toBe("Bearer");

    const me = await body(await api("/v1/me", { token: access_token }));
    expect(me.profile.loom_number).toBe(80);
    const session = await env.DB_ID.prepare("SELECT app FROM sessions WHERE account_id = ? AND app = 'wallpaper'").bind(user.id).first();
    expect(session).toEqual({ app: "wallpaper" });

    // Um código vale um token só.
    await rewindPoll();
    poll = await api("/v1/device/token", { body: { device_code: start.device_code } });
    expect((await body(poll)).error).toBe("invalid_grant");

    // O próprio app não aprova códigos.
    const other = await body(await api("/v1/device/code", { method: "POST" }));
    const res = await api("/v1/device/approve", { token: access_token, body: { user_code: other.user_code } });
    expect(res.status).toBe(403);

    // Sair no app revoga só a sessão do wallpaper.
    expect((await api("/v1/session/revoke", { method: "POST", token: access_token })).status).toBe(200);
    expect((await api("/v1/me", { token: access_token })).status).toBe(401);
    expect((await api("/v1/me", { token: user.token })).status).toBe(200);
  });

  it("código errado ou expirado", async () => {
    const user = await seedUser(81);
    expect((await api("/v1/device/approve", { token: user.token, body: { user_code: "AAAA-AAAA" } })).status).toBe(404);
    const start = await body(await api("/v1/device/code", { method: "POST" }));
    await env.DB_ROOMS.prepare("UPDATE device_codes SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await api("/v1/device/approve", { token: user.token, body: { user_code: start.user_code } })).status).toBe(404);
    const poll = await api("/v1/device/token", { body: { device_code: start.device_code } });
    expect((await body(poll)).error).toBe("expired_token");
    expect((await body(await api("/v1/device/token", { body: { device_code: "nao-existe" } }))).error).toBe("invalid_grant");
  });
});
