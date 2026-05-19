-- =============================================================================
-- E6 — Segmentação
-- Cria: segment + RLS
-- =============================================================================

create table if not exists public.segment (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  name            text not null,
  rules           jsonb not null,
  created_by      uuid references public.profile(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(workspace_id, name)
);

create index if not exists segment_workspace_created_at_idx
  on public.segment(workspace_id, created_at desc);

drop trigger if exists segment_set_updated_at on public.segment;
create trigger segment_set_updated_at
  before update on public.segment
  for each row execute function public.set_updated_at();

alter table public.segment enable row level security;

drop policy if exists "segment_select_member" on public.segment;
create policy "segment_select_member"
  on public.segment for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "segment_member_mutate" on public.segment;
create policy "segment_member_mutate"
  on public.segment for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================================
-- Fim — E6 init
-- ============================================================================
