import { DurableObject } from "cloudflare:workers";
import type { Notice } from "./visits";
import type { Env } from "./types";

/**
 * Um canal por nome (`room:<id>` ou `user:<id>`). Usa a API de WebSocket hibernável:
 * com o app conectado e nada acontecendo, o objeto dorme e não cobra CPU.
 * O ping/pong é respondido pelo próprio runtime, sem acordar o objeto.
 */
export class Channel extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const { 0: client, 1: server } = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "hello" }));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (req.method === "POST") {
      const payload = await req.text();
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload);
        } catch {
          // conexão já fechada: o runtime remove na próxima limpeza
        }
      }
      return new Response(null, { status: 204 });
    }
    return new Response("not found", { status: 404 });
  }

  async webSocketMessage(): Promise<void> {
    // O cliente só escuta; qualquer mensagem além do ping é ignorada.
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    ws.close(code === 1005 ? 1000 : code, "bye");
  }
}

export function channelStub(env: Env, name: string): DurableObjectStub {
  return env.CHANNEL.get(env.CHANNEL.idFromName(name));
}

/** Entrega os eventos depois de responder, sem atrasar a requisição. */
export function publish(env: Env, exec: ExecutionContext, notices: Notice[]): void {
  for (const n of notices) {
    exec.waitUntil(
      channelStub(env, n.channel)
        .fetch("https://channel/notify", { method: "POST", body: JSON.stringify(n.event) })
        .catch(() => undefined),
    );
  }
}
