-- Cópia do esquema atual de theloom-id (lido em 2026-10-17), só para testes locais.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  loom_number INTEGER NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  email_verified_at TEXT,
  display_name TEXT NOT NULL,
  nick TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iter INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'bloqueada')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  founder_number INTEGER CHECK (founder_number IS NULL OR founder_number BETWEEN 1 AND 2000),
  founder_since TEXT
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  app TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX sessions_account ON sessions(account_id);
