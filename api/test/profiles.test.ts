import { describe, expect, it } from "vitest";
import { parseRef } from "../src/accounts";
import { normalizeHandle } from "../src/handle";
import { api, body, seedUser } from "./helpers";

describe("refs e @handle", () => {
  it("aceita número, #número com zeros e @handle", () => {
    expect(parseRef("1")).toEqual({ kind: "number", value: 1 });
    expect(parseRef("#000001")).toEqual({ kind: "number", value: 1 });
    expect(parseRef("%23000042")).toEqual({ kind: "number", value: 42 });
    expect(parseRef("@Tiba")).toEqual({ kind: "handle", value: "tiba" });
    expect(() => parseRef("tiba")).toThrow();
  });

  it("valida o formato do handle", () => {
    expect(normalizeHandle("@Tiba.Art")).toBe("tiba.art");
    for (const bad of ["ab", ".tiba", "tiba.", "ti..ba", "tí ba", "a".repeat(21)]) {
      expect(() => normalizeHandle(bad), bad).toThrow();
    }
    expect(() => normalizeHandle("theloom")).toThrow(/handle_reserved/);
  });

  it("a pessoa escolhe o handle e ele é único", async () => {
    const a = await seedUser(1);
    const b = await seedUser(2);
    let res = await api("/v1/me/handle", { method: "PUT", token: a.token, body: { handle: "@Tiba" } });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ handle: "tiba" });

    res = await api("/v1/me/handle", { method: "PUT", token: b.token, body: { handle: "TIBA" } });
    expect(res.status).toBe(409);
    expect((await body(res)).error).toBe("handle_taken");

    res = await api("/v1/loomers/@tiba");
    expect(res.status).toBe(200);
    const data = await body(res);
    expect(data.profile).toEqual({ loom_number: 1, handle: "tiba", display_name: "Loomer 1", founder_number: null });
    expect(data.profile).not.toHaveProperty("email");
    expect(data.room).toEqual({ visibility: "public", version: 0 });
  });

  it("conta bloqueada não aparece", async () => {
    await seedUser(3, { status: "bloqueada" });
    expect((await api("/v1/loomers/3")).status).toBe(404);
  });

  it("rotas exigem login quando precisam", async () => {
    expect((await api("/v1/me")).status).toBe(401);
    expect((await api("/v1/me", { token: "inexistente" })).status).toBe(401);
  });

  it("rota desconhecida e método errado", async () => {
    expect((await api("/nada")).status).toBe(404);
    expect((await api("/v1/me", { method: "DELETE" })).status).toBe(405);
  });

  it("CORS só para o site", async () => {
    const ok = await api("/health", { headers: { origin: "https://theloom.com.br" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://theloom.com.br");
    const other = await api("/health", { headers: { origin: "https://evil.example" } });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });
});
