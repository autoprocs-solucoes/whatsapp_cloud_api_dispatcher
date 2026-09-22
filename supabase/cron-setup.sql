-- =============================================================================
-- Cron setup — schedula o worker `process-dispatch-queue` a cada minuto.
--
-- Por que NÃO está em migrations/: precisa de PROJECT_REF + SERVICE_ROLE_KEY
-- do projeto, que variam entre dev/staging/prod. Migrations devem ser
-- ambiente-agnósticas.
--
-- COMO USAR:
--   1. Faça deploy da edge function:
--        supabase functions deploy process-dispatch-queue
--   2. Substitua os placeholders <PROJECT_REF> e <SERVICE_ROLE_KEY> abaixo
--      (encontre em Dashboard → Project Settings → API).
--   3. Rode este arquivo via SQL Editor do Supabase (uma vez por ambiente).
--   4. Verifique: `select * from cron.job;`
--   5. Pra desinstalar: `select cron.unschedule('process-dispatch-queue');`
-- =============================================================================

-- Remove schedule anterior (idempotente) — ignora erro se não existe.
do $$
begin
  perform cron.unschedule('process-dispatch-queue');
exception when others then
  -- job ainda não existia, segue
  null;
end$$;

-- Schedula a cada minuto. Worker é idempotente e bounded por invocação,
-- então rodar a cada minuto não causa duplicação (claim usa FOR UPDATE SKIP
-- LOCKED).
select cron.schedule(
  'process-dispatch-queue',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-dispatch-queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Conferir:
-- select jobid, jobname, schedule, active from cron.job;
-- select * from cron.job_run_details
--   where jobname = 'process-dispatch-queue'
--   order by start_time desc limit 10;


-- =============================================================================
-- Tick dos fluxos — retoma execuções paradas em bloco de atraso.
--
-- Mora no app (rota Next), não numa edge function: o motor do fluxo é Node.
-- Substitua <APP_URL> pela URL pública do app (a mesma NEXT_PUBLIC_APP_URL) e
-- <SERVICE_ROLE_KEY> pela chave do projeto.
--
--   Desinstalar: select cron.unschedule('flow-tick');
-- =============================================================================

do $$
begin
  perform cron.unschedule('flow-tick');
exception when others then
  null;
end$$;

select cron.schedule(
  'flow-tick',
  '* * * * *',
  $$
  select net.http_post(
    url     := '<APP_URL>/api/internal/flow-tick',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
