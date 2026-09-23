-- =============================================================================
-- Webhook que chegou e não achou dono.
--
-- A Meta entrega tudo no mesmo endpoint e o roteamento sai do número que
-- recebeu. Quando esse número não está conectado a nenhum workspace, o evento
-- era descartado com um console.warn — e o log da Vercel não guarda histórico.
-- Resultado: o cliente escreve, nada aparece, e não há como provar se chegou.
--
-- Aqui fica a evidência: qual número, qual WABA e o que veio.
-- =============================================================================

create table if not exists public.webhook_unmatched (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  waba_id         text,
  phone_number_id text,
  from_phone      text,
  kind            text,            -- messages, statuses, echoes
  payload         jsonb
);

create index if not exists webhook_unmatched_created_idx
  on public.webhook_unmatched(created_at desc);

alter table public.webhook_unmatched enable row level security;
-- Sem policy: diagnóstico de servidor, lido com service_role.
