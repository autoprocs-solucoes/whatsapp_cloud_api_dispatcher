-- =============================================================================
-- E14 — Execução de fluxo
--
-- `flow_run` é o contato caminhando pelo fluxo: onde ele parou, por que está
-- parado (esperando resposta ou esperando a hora) e quando voltar a andar.
-- =============================================================================

create table if not exists public.flow_run (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspace(id) on delete cascade,
  flow_id          uuid not null references public.flow(id) on delete cascade,
  campaign_id      uuid references public.campaign(id) on delete set null,
  dispatch_id      uuid references public.dispatch(id) on delete set null,
  contact_id       uuid references public.contact(id) on delete set null,
  phone_e164       text not null,
  -- Número do workspace que conduz a conversa. Guardado na execução porque o
  -- workspace pode ter mais de um, e a resposta tem que voltar pelo mesmo.
  phone_number_id  text not null,
  connection_id    uuid not null references public.workspace_meta_connection(id) on delete cascade,
  current_node_id  text,
  status           text not null default 'active'
                     check (status in (
                       'active', 'waiting_reply', 'waiting_time',
                       'done', 'canceled', 'failed'
                     )),
  resume_at        timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists flow_run_workspace_idx
  on public.flow_run(workspace_id, created_at desc);

-- Quem está esperando a hora — é o que o tick busca a cada minuto.
create index if not exists flow_run_resume_idx
  on public.flow_run(status, resume_at)
  where status = 'waiting_time';

-- Um contato por vez em um fluxo: a resposta que chega precisa ter um destino
-- sem ambiguidade. Execução encerrada não conta.
create unique index if not exists flow_run_one_active_per_contact
  on public.flow_run(workspace_id, phone_e164)
  where status in ('active', 'waiting_reply', 'waiting_time');

drop trigger if exists flow_run_set_updated_at on public.flow_run;
create trigger flow_run_set_updated_at
  before update on public.flow_run
  for each row execute function public.set_updated_at();

alter table public.flow_run enable row level security;

drop policy if exists "flow_run_select_member" on public.flow_run;
create policy "flow_run_select_member"
  on public.flow_run for select
  using (public.is_workspace_member(workspace_id));

-- Só o server (service_role) escreve execução — nada de cliente mexendo em
-- estado de conversa em andamento.
drop policy if exists "flow_run_member_mutate" on public.flow_run;

-- ============================================================================
-- Fim — E14 init
-- ============================================================================
