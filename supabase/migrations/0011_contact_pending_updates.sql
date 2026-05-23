-- =============================================================================
-- E4.2 — contact_pending_update
-- Fila de solicitações externas (IA) para alterar custom_fields do contato.
-- Tabela separada pra inserts atômicos (sem race em múltiplos POSTs paralelos)
-- e auditoria. Cliente aprova/rejeita item por item na aplicação.
-- =============================================================================

create table if not exists public.contact_pending_update (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  contact_id      uuid not null references public.contact(id) on delete cascade,
  field           text not null,
  value           text not null,
  source          text,
  created_at      timestamptz not null default now()
);

create index if not exists contact_pending_update_contact_idx
  on public.contact_pending_update(contact_id, created_at);

create index if not exists contact_pending_update_workspace_idx
  on public.contact_pending_update(workspace_id, created_at desc);

alter table public.contact_pending_update enable row level security;

drop policy if exists "contact_pending_update_select_member" on public.contact_pending_update;
create policy "contact_pending_update_select_member"
  on public.contact_pending_update for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "contact_pending_update_member_mutate" on public.contact_pending_update;
create policy "contact_pending_update_member_mutate"
  on public.contact_pending_update for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
