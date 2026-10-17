-- theloom-id: @handle escolhido pela pessoa (estilo Instagram).
-- ATENÇÃO: banco de produção compartilhado com o site. Aplicar só com aprovação do dono.
-- Guardado sempre em minúsculas; a unicidade vale para o valor normalizado.
ALTER TABLE accounts ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX accounts_handle ON accounts(handle) WHERE handle IS NOT NULL;
