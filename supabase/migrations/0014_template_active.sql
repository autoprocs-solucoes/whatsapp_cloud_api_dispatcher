-- =============================================================================
-- E5 — Templates: flag de ativação
-- Owner pode desativar template pra esconder de members e bloquear disparo.
-- =============================================================================

alter table public.template
  add column if not exists active boolean not null default true;

create index if not exists template_workspace_active_idx
  on public.template(workspace_id, active);

-- ============================================================================
-- Fim — 0014
-- ============================================================================
