-- theloom-rooms: quartos, itens, convites, visitas e login do app My Loom.
-- account_id referencia accounts.id do banco theloom-id (sem FK: bancos separados).

CREATE TABLE rooms (
  account_id      TEXT PRIMARY KEY,
  visibility      TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  style           TEXT NOT NULL DEFAULT 'loft',
  character_base  TEXT NOT NULL DEFAULT 'masculino' CHECK (character_base IN ('masculino', 'feminino')),
  atmosphere_lock TEXT CHECK (atmosphere_lock IS NULL OR atmosphere_lock IN ('manha', 'tarde', 'fim_de_tarde', 'noite')),
  version         INTEGER NOT NULL DEFAULT 1,
  updated_at      TEXT NOT NULL
);

-- Catálogo de itens colecionáveis (inclui pets).
CREATE TABLE items (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  rarity      TEXT NOT NULL CHECK (rarity IN ('comum', 'raro', 'epico', 'lendario')),
  slot_type   TEXT NOT NULL CHECK (slot_type IN ('prateleira', 'mesa', 'parede', 'chao', 'vestivel', 'pet')),
  edition_max INTEGER CHECK (edition_max IS NULL OR edition_max > 0),
  model_key   TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

-- Cada exemplar numerado (#12/100) pertence a uma conta.
CREATE TABLE owned_items (
  item_id     TEXT NOT NULL REFERENCES items(id),
  serial      INTEGER NOT NULL CHECK (serial > 0),
  account_id  TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'experiencia',
  acquired_at TEXT NOT NULL,
  PRIMARY KEY (item_id, serial)
);
CREATE INDEX owned_items_account ON owned_items(account_id);

-- O que está exposto em cada slot do quarto.
CREATE TABLE room_items (
  account_id TEXT NOT NULL,
  slot       TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  serial     INTEGER NOT NULL,
  PRIMARY KEY (account_id, slot),
  UNIQUE (item_id, serial),
  FOREIGN KEY (item_id, serial) REFERENCES owned_items(item_id, serial)
);

-- Convite: o anfitrião chama alguém para o próprio quarto.
CREATE TABLE invites (
  id            TEXT PRIMARY KEY,
  host_account  TEXT NOT NULL,
  guest_account TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'canceled')),
  created_at    TEXT NOT NULL,
  responded_at  TEXT,
  CHECK (host_account <> guest_account)
);
CREATE INDEX invites_guest ON invites(guest_account, status);
CREATE INDEX invites_host ON invites(host_account, status);
CREATE UNIQUE INDEX invites_one_pending ON invites(host_account, guest_account) WHERE status = 'pending';

-- Visita: dura até o visitante sair ou o anfitrião retirar.
CREATE TABLE visits (
  id            TEXT PRIMARY KEY,
  host_account  TEXT NOT NULL,
  guest_account TEXT NOT NULL,
  invite_id     TEXT NOT NULL REFERENCES invites(id),
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  ended_by      TEXT CHECK (ended_by IS NULL OR ended_by IN ('guest', 'host'))
);
CREATE INDEX visits_host_active ON visits(host_account) WHERE ended_at IS NULL;
-- Um visitante está em no máximo um quarto por vez.
CREATE UNIQUE INDEX visits_guest_active ON visits(guest_account) WHERE ended_at IS NULL;

-- Login do app por código (RFC 8628, device authorization grant).
CREATE TABLE device_codes (
  device_code_hash TEXT PRIMARY KEY,
  user_code        TEXT NOT NULL UNIQUE,
  account_id       TEXT,
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  approved_at      TEXT,
  consumed_at      TEXT,
  last_polled_at   TEXT
);
