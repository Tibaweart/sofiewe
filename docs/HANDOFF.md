# Handoff: publicar a API do My Loom e ligar o site

Para a sessão que já tem acesso ao Cloudflare (com wrangler logado) e ao código do theloom.com.br.

**Repositório:** `Tibaweart/sofiewe` · **branch:** `claude/reverse-engineering-skill-kmugbp` · **pasta:** `api/`

## Já feito (não repetir)
- [x] D1 **`theloom-rooms`** criado (`8f1e48b6-268a-43f5-9ccd-405b107d0892`, ENAM). Tabelas aplicadas e registradas em `d1_migrations` (`0001_init.sql`). O `wrangler.toml` já tem o id.
- [x] Coluna **`handle`** + índice único `accounts_handle` adicionados em **`theloom-id.accounts`**.
  Uma consulta de conferência foi bloqueada. Confirme com:
  `npx wrangler d1 execute theloom-id --remote --command "SELECT name FROM pragma_table_info('accounts') WHERE name='handle'"`
- [x] Código da API com 27 testes passando (`npm test` dentro de `api/`).

## 1. Publicar a API
```bash
git clone https://github.com/Tibaweart/sofiewe && cd sofiewe && git checkout claude/reverse-engineering-skill-kmugbp
cd api && npm install && npm test && npm run typecheck
npx wrangler secret put ADMIN_TOKEN        # gere um valor forte e guarde no cofre de senhas
npx wrangler deploy
```
- Domínio: em **Workers → myloom-api → Settings → Domains & Routes**, adicionar o custom domain **`api.theloom.com.br`**.
- Teste rápido: `curl https://api.theloom.com.br/health` deve responder `{"ok":true}`, e
  `curl https://api.theloom.com.br/v1/loomers/1` deve trazer o perfil #000001.

## 2. Autenticação: confirmada, com um ajuste de integração
Lido no código publicado da Sala de Controle (`theloom-sc`, `worker/identidade.ts`) em 2026-10-17:
- O token da sessão é guardado como **SHA-256 em hex** (`sha256(token)`), igual à API. ✅ Nada a mudar em `api/src/auth.ts`.
- Senhas: PBKDF2-SHA256 com 100 mil iterações. Sessões de 14 dias, `app = 'sc'`.
- **O token fica num cookie `HttpOnly`** (`__Host-sc_sessao`, preso ao próprio host). Consequências:
  o JavaScript do site **não consegue ler o token**, e o navegador **não envia** esse cookie para `api.theloom.com.br`.

**Como ligar (recomendado):** o Worker do site faz de ponte. Rota same-origin `/{site}/api/myloom/*` →
**service binding** para o Worker `myloom-api`, lendo o cookie da sessão e repassando como `Authorization: Bearer <token>`.
Assim o token continua invisível ao JavaScript, não precisa de CORS e a API não muda.
```toml
# wrangler.toml do site
[[services]]
binding = "MYLOOM"
service = "myloom-api"
```
```ts
// no fetch do site, antes do handleApi:
if (url.pathname.startsWith("/api/myloom/")) {
  const token = readCookie(req);               // a mesma função de identidade.ts
  const target = new URL(url.pathname.replace("/api/myloom", "") + url.search, "https://myloom-api");
  const headers = new Headers(req.headers);
  headers.delete("cookie");
  if (token) headers.set("authorization", `Bearer ${token}`);
  return env.MYLOOM.fetch(new Request(target, { method: req.method, headers, body: req.body }));
}
```
WebSocket do sininho: passa pela mesma ponte (`/api/myloom/v1/me/live`). Repassar a requisição com o header
`Upgrade` funciona com service binding.

O **app desktop** continua falando direto com `api.theloom.com.br`, com o token próprio (`app = 'wallpaper'`)
obtido pelo login por código.

## 3. No site theloom.com.br
| Peça | O que fazer | Rotas da API |
|---|---|---|
| **Página `/ativar`** | Campo para o código `XXXX-XXXX` (aceitar `?code=` na URL). Pessoa logada confirma | `POST /v1/device/approve {user_code}` |
| **Escolher @handle** | No perfil/cadastro: campo com validação 3–20 `a-z 0-9 _ .` | `PUT /v1/me/handle {handle}` → 409 `handle_taken` / `handle_reserved` |
| **Editor do quarto (My Loom)** | Público/privado, personagem masculino/feminino, travar atmosfera, itens nos slots | `GET /v1/rooms/{id}` · `PUT /v1/rooms/me {visibility, character_base, atmosphere_lock, items:[{slot,item_id,serial}]}` |
| **Visitas** | Convidar por @handle/ID, lista de convites, aceitar/recusar/cancelar, sair/retirar | `POST /v1/invites {to}` · `GET /v1/invites` · `POST /v1/invites/{id}/accept\|decline\|cancel` · `POST /v1/visits/{id}/leave\|remove` |
| **Sininho** | Ouvir convites em tempo real | WebSocket pela ponte: `/api/myloom/v1/me/live` |

Slots do loft: `prateleira-1..4`, `mesa-1..2`, `parede-1..2`, `chao-1..2`, `vestivel-cabeca`, `vestivel-pes`, `pet` (`api/src/slots.ts`).
No site, chame as rotas pela ponte (`/api/myloom/v1/...`). O CORS da API fica só como alternativa.

## 4. Itens das experiências
Criar item: `POST /v1/admin/items` · entregar exemplar numerado: `POST /v1/admin/grants {item_id, to}`, ambos com `Authorization: Bearer <ADMIN_TOKEN>`.
Itens próprios/genéricos, sem marcas reais (decisão do produto).

## 5. Depois
- Rate limiting (regra do Cloudflare) em `/v1/device/code` e `/v1/invites`.
- Cron para limpar `device_codes` expirados.
- Ativar **R2** quando os primeiros modelos `.glb` existirem.

Referência completa: [`api/README.md`](../api/README.md) · decisões: [`produto-quarto-geek.md`](produto-quarto-geek.md) · integração: [`integracao-theloom.md`](integracao-theloom.md).
