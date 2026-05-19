-- =============================================================================
-- E7 — Comunicados (disparo)
-- Cria: dispatch, dispatch_recipient + RLS
-- =============================================================================

create table if not exists public.dispatch (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspace(id) on delete cascade,
  template_id         uuid not null references public.template(id) on delete cascade,
  phone_number_id     text not null,
  segment_id          uuid references public.segment(id) on delete set null,
  recipient_source    text not null check (recipient_source in ('segment', 'manual')),
  manual_phones       text[] not null default '{}'::text[],
  variable_mapping    jsonb not null default '{}'::jsonb,
  status              text not null default 'draft'
                        check (status in ('draft', 'running', 'done', 'failed', 'canceled')),
  total_recipients    int not null default 0,
  created_by          uuid references public.profile(user_id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  started_at          timestamptz,
  finished_at         timestamptz
);

create index if not exists dispatch_workspace_created_at_idx
  on public.dispatch(workspace_id, created_at desc);

create index if not exists dispatch_status_idx
  on public.dispatch(workspace_id, status);

drop trigger if exists dispatch_set_updated_at on public.dispatch;
create trigger dispatch_set_updated_at
  before update on public.dispatch
  for each row execute function public.set_updated_at();

create table if not exists public.dispatch_recipient (
  id              uuid primary key default gen_random_uuid(),
  dispatch_id     uuid not null references public.dispatch(id) on delete cascade,
  contact_id      uuid references public.contact(id) on delete set null,
  phone_e164      text not null,
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'queued'
                    check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  meta_message_id text,
  error_code      text,
  error_message   text,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  read_at         timestamptz,
  failed_at       timestamptz
);

create index if not exists dispatch_recipient_dispatch_status_idx
  on public.dispatch_recipient(dispatch_id, status);

create index if not exists dispatch_recipient_dispatch_phone_idx
  on public.dispatch_recipient(dispatch_id, phone_e164);

create index if not exists dispatch_recipient_meta_message_idx
  on public.dispatch_recipient(meta_message_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.dispatch enable row level security;
alter table public.dispatch_recipient enable row level security;

drop policy if exists "dispatch_select_member" on public.dispatch;
create policy "dispatch_select_member"
  on public.dispatch for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "dispatch_member_mutate" on public.dispatch;
create policy "dispatch_member_mutate"
  on public.dispatch for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- dispatch_recipient: usa workspace do dispatch pai
drop policy if exists "dispatch_recipient_select_member" on public.dispatch_recipient;
create policy "dispatch_recipient_select_member"
  on public.dispatch_recipient for select
  using (
    exists (
      select 1 from public.dispatch d
       where d.id = dispatch_recipient.dispatch_id
         and public.is_workspace_member(d.workspace_id)
    )
  );

drop policy if exists "dispatch_recipient_member_mutate" on public.dispatch_recipient;
create policy "dispatch_recipient_member_mutate"
  on public.dispatch_recipient for all
  using (
    exists (
      select 1 from public.dispatch d
       where d.id = dispatch_recipient.dispatch_id
         and public.is_workspace_member(d.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.dispatch d
       where d.id = dispatch_recipient.dispatch_id
         and public.is_workspace_member(d.workspace_id)
    )
  );

-- ============================================================================
-- Fim — E7 init
-- ============================================================================
