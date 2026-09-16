-- =============================================================================
-- Health Status da WABA (Meta Graph API `?fields=health_status`).
--
-- Guarda o payload cru pra não perder nada que a Meta manda (entities por
-- WABA/telefone, cada uma com can_send_message + lista de erros com
-- possible_solution) — isso é o que teria mostrado o motivo real por trás de
-- erros genéricos tipo "Business eligibility payment issue" (billing, banimento,
-- verificação de negócio pendente, etc.), em vez de só o código de erro do
-- envio.
-- Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/health-status
-- =============================================================================

alter table public.workspace_meta_connection
  add column if not exists health_status jsonb,
  add column if not exists health_synced_at timestamptz;
