-- =============================================================================
-- E4 — Contatos
-- Cria: contact, contact_import + RLS
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Tabela: contact (N por workspace, único por phone_e164)
-- ----------------------------------------------------------------------------
create table if not exists public.contact (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  phone_e164      text not null,
  full_name       text,
  custom_fields   jsonb not null default '{}'::jsonb,
  opt_out         boolean not null default false,
  opt_out_at      timestamptz,
  tags            text[] not null default '{}'::text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profile(user_id) on delete set null,
  unique(workspace_id, phone_e164)
);

create index if not exists contact_workspace_opt_out_idx
  on public.contact(workspace_id, opt_out);

create index if not exists contact_workspace_created_at_idx
  on public.contact(workspace_id, created_at desc);

create index if not exists contact_tags_gin_idx
  on public.contact using gin(tags);

drop trigger if exists contact_set_updated_at on public.contact;
create trigger contact_set_updated_at
  before update on public.contact
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Tabela: contact_import (audit metadata; não persiste arquivo)
-- ----------------------------------------------------------------------------
create table if not exists public.contact_import (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  filename        text,
  mapping         jsonb not null,
  stats           jsonb not null,
  created_by      uuid references public.profile(user_id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists contact_import_workspace_created_at_idx
  on public.contact_import(workspace_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.contact enable row level security;
alter table public.contact_import enable row level security;

-- contact: member pode tudo
drop policy if exists "contact_select_member" on public.contact;
create policy "contact_select_member"
  on public.contact for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "contact_member_mutate" on public.contact;
create policy "contact_member_mutate"
  on public.contact for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- contact_import: member pode tudo
drop policy if exists "contact_import_select_member" on public.contact_import;
create policy "contact_import_select_member"
  on public.contact_import for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "contact_import_member_mutate" on public.contact_import;
create policy "contact_import_member_mutate"
  on public.contact_import for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================================
-- Fim — E4 init
-- ============================================================================
