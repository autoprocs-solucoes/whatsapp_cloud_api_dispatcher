-- =============================================================================
-- E4.1 — contact.phone_number_id
-- Qual número WABA (phone_number_id Meta) esse contato pertence/foi disparado.
-- =============================================================================

alter table public.contact
  add column if not exists phone_number_id text;

create index if not exists contact_workspace_phone_number_id_idx
  on public.contact(workspace_id, phone_number_id);
