# My Loom API

API do wallpaper **My Loom** e do editor de quarto no site, como Cloudflare Worker.
Quartos, itens, convites, visitas e login do app por código. Tempo real por Durable Objects.

> **Status (2026-10-17):** bancos prontos em produção: `theloom-rooms` criado com as tabelas, e coluna `handle`
> adicionada em `theloom-id.accounts`. **O Worker ainda não foi publicado** (falta a chave de API do Cloudflare).

## Rodar localmente
```bash
npm install          # usa legacy-peer-deps (ver .npmrc)
npm test             # 27 testes no runtime real do Workers (Miniflare), com D1 local
npm run typecheck
npm run dev          # servidor local em http://localhost:8787
```

## Rotas
| Método | Rota | Quem | O quê |
|---|---|---|---|
| GET | `/v1/loomers/{ref}` | público | perfil + visibilidade/versão do quarto. `ref` = `123`, `#000123` ou `@handle` |
| GET | `/v1/rooms/{ref}` | público / dono / visitante | **manifesto** do quarto (`myloom.room/1`): pessoas (até 4), itens por slot, atmosfera |
| GET | `/v1/rooms/{ref}/live` | idem | WebSocket: `room.updated`, `visit.started`, `visit.ended` |
| PUT | `/v1/rooms/me` | logado | salva o quarto (editor do site): `visibility`, `character_base`, `atmosphere_lock`, `items[]` |
| GET | `/v1/me` · `/v1/me/view` | logado | perfil e **qual quarto o wallpaper deve mostrar** (o próprio ou o do anfitrião) |
| GET | `/v1/me/live` | logado | WebSocket da conta: `invite.received`, `invite.declined/canceled`, `view.changed`… |
| PUT | `/v1/me/handle` | logado | escolhe o @handle (3–20, `a-z 0-9 _ .`, único) |
| GET/POST | `/v1/invites` | logado | lista pendentes / convida alguém para o **seu** quarto (`{ "to": ref }`) |
| POST | `/v1/invites/{id}/accept\|decline\|cancel` | convidado / convidado / anfitrião | |
| POST | `/v1/visits/{id}/leave\|remove` | visitante / anfitrião | encerra a visita |
| POST | `/v1/device/code` → `/v1/device/approve` → `/v1/device/token` | app → site → app | login do app por código (RFC 8628) |
| POST | `/v1/session/revoke` | app | sair (revoga só a sessão `wallpaper`) |
| GET | `/v1/weather` | público | clima da região pelo IP (`clear/cloudy/fog/rain/storm/snow`) |
| POST | `/v1/admin/items` · `/v1/admin/grants` | `ADMIN_TOKEN` | cria item no catálogo / entrega o próximo exemplar numerado |

Regras garantidas no banco e cobertas por testes: quarto privado só para dono e visitantes ativos;
**dono + até 3 visitantes**; visitante em **um quarto por vez**; um convite pendente por par;
itens só do dono e no tipo de slot certo; tiragem numerada (`#n/edição`) sem repetir número.

## Publicar (precisa da aprovação do dono, nesta ordem)
1. ✅ Banco `theloom-rooms` criado e migração `0001_init.sql` aplicada (registrada em `d1_migrations`).
2. ✅ `migrations/id/0001_handle.sql` aplicada em `theloom-id` (manual, fora do `d1_migrations` do site).
3. **Segredo:** `npx wrangler secret put ADMIN_TOKEN`.
4. **Publicar:** `npx wrangler deploy` e apontar `api.theloom.com.br` para o Worker.
5. **R2** (modelos 3D): ativar no painel quando os primeiros `.glb` existirem.

## Premissas a confirmar com o código do site
- O site guarda `sessions.token_hash` como **SHA-256 em hex** do token e `expires_at` em **ISO 8601 UTC**.
  Se for diferente, só `src/auth.ts` muda.
- A página `https://theloom.com.br/ativar` (onde a pessoa digita o código do app) ainda precisa ser criada no site.

## Pendências conhecidas
- Limite de taxa em `/v1/device/code` e `/v1/invites` (regra de rate limiting do Cloudflare) e limpeza
  periódica de `device_codes` expirados (Cron Trigger).
- Um WebSocket já aberto num quarto que vira privado continua recebendo os avisos (que só têm ids e perfis
  públicos) até reconectar. O manifesto em si sempre passa pela checagem de permissão.
