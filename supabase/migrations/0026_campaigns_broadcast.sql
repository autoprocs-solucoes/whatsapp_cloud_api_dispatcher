-- =============================================================================
-- E13 — Campanhas e Transmissão
--
-- Campanha é o grupo da informação: guarda o conteúdo (o template de abertura
-- e, opcionalmente, o fluxo que continua a conversa depois da resposta). A
-- transmissão é o envio de uma campanha — por isso `dispatch` ganha
-- `campaign_id` em vez de uma tabela nova: a fila, o worker e as métricas por
-- destinatário já existem e continuam valendo.
-- =============================================================================

create table if not exists public.campaign (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  name          text not null,
  description   text,
  -- Mensagem de abertura. Fora da janela de 24h a Meta só entrega template
  -- aprovado, então é ele que abre qualquer transmissão.
  template_id   uuid references public.template(id) on delete set null,
  -- O que acontece depois que a pessoa responde. Opcional: campanha de aviso
  -- não precisa de continuação.
  flow_id       uuid references public.flow(id) on delete set null,
  status        text not null default 'active'
                  check (status in ('active', 'archived')),
  created_by    uuid references public.profile(user_id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists campaign_workspace_created_idx
  on public.campaign(workspace_id, created_at desc);

drop trigger if exists campaign_set_updated_at on public.campaign;
create trigger campaign_set_updated_at
  before update on public.campaign
  for each row execute function public.set_updated_at();

alter table public.campaign enable row level security;

drop policy if exists "campaign_select_member" on public.campaign;
create policy "campaign_select_member"
  on public.campaign for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "campaign_member_mutate" on public.campaign;
create policy "campaign_member_mutate"
  on public.campaign for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ----------------------------------------------------------------------------
-- Transmissão: dispatch ganha nome próprio, campanha e agendamento.
-- ----------------------------------------------------------------------------
alter table public.dispatch
  add column if not exists campaign_id  uuid references public.campaign(id) on delete set null,
  add column if not exists name         text,
  add column if not exists scheduled_at timestamptz;

create index if not exists dispatch_campaign_idx
  on public.dispatch(campaign_id);

-- `scheduled` espera a hora marcada; `paused` é parada temporária de uma
-- transmissão que já estava rodando (o que sobrou na fila fica esperando).
alter table public.dispatch
  drop constraint if exists dispatch_status_check;

alter table public.dispatch
  add constraint dispatch_status_check
  check (status in (
    'draft', 'scheduled', 'queued', 'running', 'paused',
    'done', 'failed', 'canceled'
  ));

create index if not exists dispatch_scheduled_idx
  on public.dispatch(status, scheduled_at);

-- ============================================================================
-- Fim — E13 init
-- ============================================================================
