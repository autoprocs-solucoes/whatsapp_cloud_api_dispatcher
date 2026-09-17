-- =============================================================================
-- Reagendar sem gastar tentativa.
--
-- O limite de conversas da Meta é por 24 horas. O backoff atual esgota as 5
-- tentativas em cerca de duas horas, então um comunicado maior que o teto
-- diário marcava o excedente como falha sem nunca ter chance de sair — o
-- usuário precisava refazer o disparo no dia seguinte.
--
-- Bater no teto não é erro do destinatário: é fila. Com `p_consume_attempt`
-- false, a linha volta pra fila com espera longa e devolve a tentativa, então
-- ela continua elegível quando a janela virar.
-- =============================================================================

create or replace function public.reschedule_dispatch_recipient(
  p_id              uuid,
  p_delay_seconds   int,
  p_error_code      text,
  p_error_message   text,
  p_consume_attempt boolean default true
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
         last_error_at   = now(),
         -- O claim já somou 1; devolver mantém o orçamento de tentativas
         -- reservado pra erro de verdade.
         attempts        = case
                             when p_consume_attempt then attempts
                             else greatest(attempts - 1, 0)
                           end
   where id = p_id;
$$;

revoke all on function
  public.reschedule_dispatch_recipient(uuid, int, text, text, boolean) from public;
grant execute on function
  public.reschedule_dispatch_recipient(uuid, int, text, text, boolean) to service_role;

-- A assinatura de 4 argumentos some pra não ficar duas versões vivas: a nova
-- atende as chamadas antigas pelo default.
drop function if exists public.reschedule_dispatch_recipient(uuid, int, text, text);

-- ============================================================================
-- Fim — 0024
-- ============================================================================
