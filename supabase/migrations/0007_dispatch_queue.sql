-- =============================================================================
-- E7.1 — Fila de disparo em background
-- Estende dispatch/dispatch_recipient para processamento por worker (Edge Fn
-- agendado por pg_cron). Permite usuário fechar a aba sem parar o envio.
-- =============================================================================

-- Extensões necessárias pro cron + http (worker é chamado via net.http_post).
-- No Supabase: já vêm instaladas no schema `extensions`. Use `create extension
-- if not exists` pra idempotência. Se falhar por permissão, habilite no
-- Dashboard → Database → Extensions.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ----------------------------------------------------------------------------
-- Adicional status 'queued' (entre draft e running).
-- Fluxo: draft → queued (usuário clicou "Disparar") → running (worker pegou)
--                                                     → done/failed
-- ----------------------------------------------------------------------------
alter table public.dispatch
  drop constraint if exists dispatch_status_check;

alter table public.dispatch
  add constraint dispatch_status_check
  check (status in ('draft', 'queued', 'running', 'done', 'failed', 'canceled'));

-- ----------------------------------------------------------------------------
-- Colunas pra worker fazer claim atômico + retry com backoff.
-- claimed_at: NULL ou < now()-stale → disponível pro próximo worker.
-- attempts: número de tentativas (limite no worker).
-- ----------------------------------------------------------------------------
alter table public.dispatch_recipient
  add column if not exists claimed_at timestamptz,
  add column if not exists attempts   int not null default 0;

create index if not exists dispatch_recipient_claim_idx
  on public.dispatch_recipient(dispatch_id, status, claimed_at);

-- ----------------------------------------------------------------------------
-- RPC: claim atômico de um lote de recipients de um dispatch.
-- Usa FOR UPDATE SKIP LOCKED → seguro com múltiplos workers concorrentes.
-- Retorna apenas as linhas que esta chamada pegou.
-- ----------------------------------------------------------------------------
create or replace function public.claim_dispatch_recipients(
  p_dispatch_id  uuid,
  p_limit        int,
  p_stale_after  interval default interval '5 minutes'
)
returns setof public.dispatch_recipient
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id
      from public.dispatch_recipient
     where dispatch_id = p_dispatch_id
       and status = 'queued'
       and (claimed_at is null or claimed_at < now() - p_stale_after)
     order by id
     limit p_limit
     for update skip locked
  )
  update public.dispatch_recipient r
     set claimed_at = now(),
         attempts   = r.attempts + 1
    from picked
   where r.id = picked.id
   returning r.*;
end;
$$;

revoke all on function
  public.claim_dispatch_recipients(uuid, int, interval) from public;
grant execute on function
  public.claim_dispatch_recipients(uuid, int, interval) to service_role;

-- ============================================================================
-- Fim — E7.1
-- A schedule do pg_cron NÃO é criada aqui (precisa de URL + service_role key
-- do projeto). Veja supabase/cron-setup.sql.
-- ============================================================================
