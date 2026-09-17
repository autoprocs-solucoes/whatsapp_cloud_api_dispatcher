-- =============================================================================
-- Retry com backoff exponencial na fila de disparo.
--
-- Antes: quando a Meta recusava por rate limit, o worker só logava no console e
-- deixava o destinatário `queued`. A próxima rodada pegava de novo assim que o
-- claim ficava obsoleto (5 min fixos), sem crescer o intervalo e sem registrar
-- o motivo em lugar nenhum — o operador via "queued" parado e não sabia por quê.
--
-- Agora cada tentativa agenda a próxima com espera crescente e grava o último
-- erro, mesmo quando vai tentar de novo.
-- =============================================================================

alter table public.dispatch_recipient
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_error_at   timestamptz;

comment on column public.dispatch_recipient.next_attempt_at is
  'Quando o destinatário volta a ficar elegível pro worker. NULL = agora.';
comment on column public.dispatch_recipient.attempts is
  'Tentativas de envio já feitas. O worker desiste no limite e marca failed.';

-- O claim precisa filtrar por next_attempt_at, então o índice acompanha.
drop index if exists public.dispatch_recipient_claim_idx;
create index if not exists dispatch_recipient_claim_idx
  on public.dispatch_recipient(dispatch_id, status, next_attempt_at, claimed_at);

-- ----------------------------------------------------------------------------
-- Claim atômico, agora respeitando o backoff.
-- Continua usando FOR UPDATE SKIP LOCKED (seguro com workers concorrentes).
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
       and (next_attempt_at is null or next_attempt_at <= now())
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

-- ----------------------------------------------------------------------------
-- Reagenda um destinatário pra daqui a N segundos, guardando a causa.
-- Mantém status 'queued' — é uma espera, não uma falha definitiva.
-- ----------------------------------------------------------------------------
create or replace function public.reschedule_dispatch_recipient(
  p_id            uuid,
  p_delay_seconds int,
  p_error_code    text,
  p_error_message text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.dispatch_recipient
     set claimed_at      = null,
         next_attempt_at = now() + make_interval(secs => greatest(p_delay_seconds, 1)),
         error_code      = p_error_code,
         error_message   = left(coalesce(p_error_message, ''), 500),
         last_error_at   = now()
   where id = p_id;
$$;

revoke all on function
  public.reschedule_dispatch_recipient(uuid, int, text, text) from public;
grant execute on function
  public.reschedule_dispatch_recipient(uuid, int, text, text) to service_role;

-- ============================================================================
-- Fim — 0021
-- ============================================================================
