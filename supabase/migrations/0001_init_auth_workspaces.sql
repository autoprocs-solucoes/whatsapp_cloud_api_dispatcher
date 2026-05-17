-- =============================================================================
-- E1 — Auth + Workspaces
-- Cria: profile, workspace, workspace_member + RLS + triggers
-- Aplica via: Supabase Dashboard > SQL Editor (cola o conteúdo todo)
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Enum: workspace_role
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_role') then
    create type public.workspace_role as enum ('owner', 'member');
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- Tabela: profile
-- Cada linha = 1 user (espelho de auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Tabela: workspace
-- ----------------------------------------------------------------------------
create table if not exists public.workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  owner_id uuid not null references public.profile(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_owner_id_idx on public.workspace(owner_id);

-- ----------------------------------------------------------------------------
-- Tabela: workspace_member
-- ----------------------------------------------------------------------------
create table if not exists public.workspace_member (
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  user_id uuid not null references public.profile(user_id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_member_user_id_idx on public.workspace_member(user_id);

-- ----------------------------------------------------------------------------
-- Função utilitária: updated_at automático
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profile_set_updated_at on public.profile;
create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

drop trigger if exists workspace_set_updated_at on public.workspace;
create trigger workspace_set_updated_at
  before update on public.workspace
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Trigger: cria profile ao criar user em auth.users
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profile (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Trigger: insere owner como membro ao criar workspace
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.workspace_member (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspace;
create trigger on_workspace_created
  after insert on public.workspace
  for each row execute function public.handle_new_workspace();

-- ----------------------------------------------------------------------------
-- RLS — habilitar
-- ----------------------------------------------------------------------------
alter table public.profile enable row level security;
alter table public.workspace enable row level security;
alter table public.workspace_member enable row level security;

-- ----------------------------------------------------------------------------
-- Função helper: usuário é membro do workspace?
-- (security definer pra evitar recursão de RLS)
-- ----------------------------------------------------------------------------
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_member
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_member
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS policies: profile
-- ----------------------------------------------------------------------------
drop policy if exists "profile_select_self" on public.profile;
create policy "profile_select_self"
  on public.profile for select
  using (user_id = auth.uid());

drop policy if exists "profile_update_self" on public.profile;
create policy "profile_update_self"
  on public.profile for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT via trigger handle_new_user (security definer) — não precisa policy.

-- ----------------------------------------------------------------------------
-- RLS policies: workspace
-- ----------------------------------------------------------------------------
drop policy if exists "workspace_select_member" on public.workspace;
create policy "workspace_select_member"
  on public.workspace for select
  using (public.is_workspace_member(id));

drop policy if exists "workspace_insert_authenticated" on public.workspace;
create policy "workspace_insert_authenticated"
  on public.workspace for insert
  with check (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists "workspace_update_owner" on public.workspace;
create policy "workspace_update_owner"
  on public.workspace for update
  using (public.is_workspace_owner(id))
  with check (public.is_workspace_owner(id));

drop policy if exists "workspace_delete_owner" on public.workspace;
create policy "workspace_delete_owner"
  on public.workspace for delete
  using (public.is_workspace_owner(id));

-- ----------------------------------------------------------------------------
-- RLS policies: workspace_member
-- ----------------------------------------------------------------------------
drop policy if exists "workspace_member_select_member" on public.workspace_member;
create policy "workspace_member_select_member"
  on public.workspace_member for select
  using (public.is_workspace_member(workspace_id));

-- INSERT é feito via trigger (owner inicial) e via server action com service_role (convite).
-- Não permitimos insert direto de cliente.
drop policy if exists "workspace_member_insert_owner" on public.workspace_member;
create policy "workspace_member_insert_owner"
  on public.workspace_member for insert
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "workspace_member_delete_owner" on public.workspace_member;
create policy "workspace_member_delete_owner"
  on public.workspace_member for delete
  using (public.is_workspace_owner(workspace_id) and user_id <> auth.uid());

-- ============================================================================
-- Fim — E1 init
-- ============================================================================
