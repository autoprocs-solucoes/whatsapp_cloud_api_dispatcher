-- =============================================================================
-- E5 — Templates
-- Cria: template + RLS
-- =============================================================================

create table if not exists public.template (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspace(id) on delete cascade,
  meta_template_id  text not null,
  name              text not null,
  language          text not null,
  category          text not null,
  status            text not null,
  header_text       text,
  body_text         text,
  footer_text       text,
  buttons           jsonb not null default '[]'::jsonb,
  components_raw    jsonb,
  last_synced_at    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique(workspace_id, meta_template_id)
);

create index if not exists template_workspace_status_idx
  on public.template(workspace_id, status);

create index if not exists template_workspace_name_language_idx
  on public.template(workspace_id, name, language);

alter table public.template enable row level security;

drop policy if exists "template_select_member" on public.template;
create policy "template_select_member"
  on public.template for select
  using (public.is_workspace_member(workspace_id));

-- Mutações só via server action (admin client). Bloqueia client direto.
drop policy if exists "template_member_mutate" on public.template;
create policy "template_member_mutate"
  on public.template for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ============================================================================
-- Fim — E5 init
-- ============================================================================
