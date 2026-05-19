-- =============================================================================
-- E2 — Conexão Meta (Embedded Signup)
-- Cria: workspace_meta_connection, workspace_phone_number + RLS
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Tabela: workspace_meta_connection (1:1 com workspace)
-- ----------------------------------------------------------------------------
create table if not exists public.workspace_meta_connection (
  workspace_id    uuid primary key references public.workspace(id) on delete cascade,
  waba_id         text not null,
  business_id     text,
  business_name   text,
  access_token    text not null,
  connected_at    timestamptz not null default now(),
  connected_by    uuid references public.profile(user_id) on delete set null,
  updated_at      timestamptz not null default now()
);

create index if not exists meta_connection_waba_id_idx
  on public.workspace_meta_connection(waba_id);

drop trigger if exists meta_connection_set_updated_at on public.workspace_meta_connection;
create trigger meta_connection_set_updated_at
  before update on public.workspace_meta_connection
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Tabela: workspace_phone_number (N por workspace)
-- ----------------------------------------------------------------------------
create table if not exists public.workspace_phone_number (
  id                          uuid primary key default gen_random_uuid(),
  workspace_id                uuid not null references public.workspace(id) on delete cascade,
  phone_number_id             text not null,
  display_phone_number        text not null,
  verified_name               text,
  quality_rating              text,
  code_verification_status    text,
  is_registered               boolean not null default false,
  last_synced_at              timestamptz not null default now(),
  created_at                  timestamptz not null default now(),
  unique(workspace_id, phone_number_id)
);

create index if not exists phone_number_workspace_id_idx
  on public.workspace_phone_number(workspace_id);

-- ----------------------------------------------------------------------------
-- RLS — habilitar
-- ----------------------------------------------------------------------------
alter table public.workspace_meta_connection enable row level security;
alter table public.workspace_phone_number enable row level security;

-- ----------------------------------------------------------------------------
-- RLS policies: workspace_meta_connection
-- ----------------------------------------------------------------------------
drop policy if exists "meta_connection_select_member" on public.workspace_meta_connection;
create policy "meta_connection_select_member"
  on public.workspace_meta_connection for select
  using (public.is_workspace_member(workspace_id));

-- INSERT/UPDATE/DELETE via server action (admin client). RLS bloqueia acesso direto.
drop policy if exists "meta_connection_owner_only_mutate" on public.workspace_meta_connection;
create policy "meta_connection_owner_only_mutate"
  on public.workspace_meta_connection for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- ----------------------------------------------------------------------------
-- RLS policies: workspace_phone_number
-- ----------------------------------------------------------------------------
drop policy if exists "phone_number_select_member" on public.workspace_phone_number;
create policy "phone_number_select_member"
  on public.workspace_phone_number for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "phone_number_owner_only_mutate" on public.workspace_phone_number;
create policy "phone_number_owner_only_mutate"
  on public.workspace_phone_number for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- ============================================================================
-- Fim — E2 init
-- ============================================================================
