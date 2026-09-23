-- Contagem por status feita no banco.
--
-- A tela somava status percorrendo as linhas de dispatch_recipient, e o
-- PostgREST devolve no máximo 1000 delas. Numa transmissão de 3.792 pessoas o
-- painel parava em 1.000 e o funil mentia. Agregar aqui resolve o corte e
-- ainda evita trazer a tabela inteira só pra contar.
create or replace function public.dispatch_status_counts(p_dispatch_ids uuid[])
returns table (dispatch_id uuid, status text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.dispatch_id, r.status, count(*)::bigint
  from public.dispatch_recipient r
  where r.dispatch_id = any(p_dispatch_ids)
  group by r.dispatch_id, r.status;
$$;

grant execute on function public.dispatch_status_counts(uuid[]) to service_role, authenticated;

-- Mesma história para a linha do tempo do painel: contar por dia percorrendo
-- linha a linha parava em 1000. O dia é o de São Paulo, como no resto da
-- interface — antes era a data em UTC, e o que saía depois das 21h aparecia no
-- dia seguinte.
create or replace function public.dispatch_daily_counts(
  p_dispatch_ids uuid[],
  p_days int default 30
)
returns table (day date, status text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (r.sent_at at time zone 'America/Sao_Paulo')::date, r.status, count(*)::bigint
  from public.dispatch_recipient r
  where r.dispatch_id = any(p_dispatch_ids)
    and r.sent_at is not null
    and r.sent_at >= now() - make_interval(days => p_days)
  group by 1, 2;
$$;

grant execute on function public.dispatch_daily_counts(uuid[], int) to service_role, authenticated;
