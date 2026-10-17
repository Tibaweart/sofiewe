# Integração com o The Loom (theloom.com.br)

Levantamento feito em 2026-10-17 na conta Cloudflare (somente leitura).

## O que já existe
| Peça | Onde | Observação |
|---|---|---|
| Site | Worker `theloom` (Cloudflare) | theloom.com.br |
| Sala de Controle | Worker `theloom-sc` + D1 `theloom-sc` | sc.theloom.com.br |
| **Contas (The Loom ID)** | D1 `theloom-id` | tabelas `accounts`, `sessions`, `login_attempts` |
| Arquivos (R2) | — | **R2 não está ativado** na conta. Precisa ativar para guardar modelos 3D |

### Tabela `accounts` (campos relevantes)
| Campo | Uso no wallpaper |
|---|---|
| `id` (TEXT) | chave interna, não exposta |
| `loom_number` (INTEGER, único) | **ID público** do Loomer (`#000001`) |
| `nick` | **@handle** (❓ confirmar) |
| `display_name` | nome exibido |
| `founder_number`, `founder_since` | selo "Founder" |
| `status` | `ativa` / `bloqueada` (conta bloqueada = quarto indisponível) |

### Tabela `sessions`
`token_hash`, `account_id`, **`app`**, `expires_at`, `revoked_at`. O login já separa sessões por app,
então o wallpaper usa `app = 'wallpaper'` e pode ser revogado sozinho, sem derrubar o site.

## O que falta criar (proposta)
Tudo na mesma plataforma (Cloudflare), para não espalhar infraestrutura.

### Banco: novas tabelas (no D1 `theloom-id` ou num D1 `theloom-rooms` novo)
```
rooms        (account_id PK, visibility 'public'|'private', atmosphere, version, updated_at)
room_items   (account_id, slot, item_id, transform_json)
items        (id, name, rarity, edition_max, model_key, slot_type)      -- catálogo
owned_items  (item_id, serial, account_id)                              -- ex.: #12/100
invites      (id, from_account, to_account, room_owner, status, created_at)
visits       (room_owner, guest_account, started_at, ended_at, ended_by) -- sai ou é retirado
device_codes (code, account_id NULL, expires_at, approved_at)           -- login do app
```

### API (Worker `theloom-api` ou rotas no `theloom`)
| Rota | Função |
|---|---|
| `GET /v1/loomers/{loom_number}` · `GET /v1/loomers/@{nick}` | perfil público + versão do quarto |
| `GET /v1/rooms/{loom_number}` | manifesto do quarto (público, ou privado com token) |
| `POST /v1/device/code` → `POST /v1/device/token` | login do app por código (quarto privado e visitas) |
| `POST /v1/invites` · `POST /v1/invites/{id}/accept` | convites nos dois sentidos |
| `POST /v1/visits/{id}/leave` · `POST /v1/visits/{id}/remove` | visitante sai / dono retira |
| `GET /v1/rooms/{loom_number}/live` (WebSocket) | avisos em tempo real: quarto mudou, visita entrou/saiu |

### Tempo real
**Durable Objects** (um por quarto): mantêm as conexões WebSocket dos apps conectados àquele quarto
e avisam na hora quando o dono salva no site ou quando uma visita começa ou termina. É o padrão do Cloudflare para isso
e custa quase nada com o app parado.

### Arquivos 3D
**R2** (precisa ativar) + cache da CDN. Modelos `.glb` endereçados por hash, então o app só baixa o que mudou.

## Perguntas
1. `nick` é o @handle?
2. As novas tabelas vão no `theloom-id` ou num banco separado de quartos? (Recomendado: separado, `theloom-rooms`.)
3. Pode ativar o R2 na conta Cloudflare? (O plano grátis inclui 10 GB.)
