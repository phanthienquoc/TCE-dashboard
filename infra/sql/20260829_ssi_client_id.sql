-- SSI clientId is a credential and must never be stored in plaintext.
alter table if exists platform_credentials
  add column if not exists ssi_client_id_encrypted text;

-- platform_credentials is accessed by the NestJS service-role connection only.
-- RLS remains enabled with no browser-facing policy, so authenticated clients
-- cannot read or write encrypted credential material directly.
alter table if exists platform_credentials enable row level security;
