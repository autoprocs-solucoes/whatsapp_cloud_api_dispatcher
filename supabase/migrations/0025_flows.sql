-- =============================================================================
-- E12 — Fluxos de conversa
-- Cria: flow_folder, flow + RLS
--
-- O desenho do fluxo (nós e ligações) vive num único jsonb `graph`. O canvas
-- salva o grafo inteiro a cada gravação, então normalizar nó a nó em tabela
-- própria só traria junção pra ler e transação pra escrever, sem ganho — as
-- consultas sempre querem o fluxo completo.
-- =============================================================================

create table if not exists public.flow_folder (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  name          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists flow_folder_workspace_idx
  on public.flow_folder(workspace_id, name);

create table if not exists public.flow (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  -- Fluxo sem pasta aparece solto em "Todos os fluxos"; apagar a pasta não
  -- apaga o fluxo, só tira ele de lá.
  folder_id     uuid references public.flow_folder(id) on delete set null,
  name          text not null,
  description   text,
  status        text not null default 'draft'
                  check (status in ('draft', 'published')),
  graph         jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_by    uuid references public.profile(user_id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);

create index if not exists flow_workspace_updated_idx
  on public.flow(workspace_id, updated_at desc);

create index if not exists flow_workspace_folder_idx
  on public.flow(workspace_id, folder_id);

drop trigger if exists flow_set_updated_at on public.flow;
create trigger flow_set_updated_at
  before update on public.flow
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — mesmo padrão das outras tabelas do workspace: membro lê e escreve,
-- mutação de verdade passa pelo admin client nas server actions.
-- ----------------------------------------------------------------------------
alter table public.flow_folder enable row level security;
alter table public.flow enable row level security;

drop policy if exists "flow_folder_select_member" on public.flow_folder;
create policy "flow_folder_select_member"
  on public.flow_folder for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "flow_folder_member_mutate" on public.flow_folder;
create policy "flow_folder_member_mutate"
  on public.flow_folder for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "flow_select_member" on public.flow;
create policy "flow_select_member"
  on public.flow for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "flow_member_mutate" on public.flow;
create policy "flow_member_mutate"
  on public.flow for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================================
-- Fim — E12 init
-- ============================================================================
