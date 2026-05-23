-- =============================================================================
-- workspace_phone_number.messaging_limit_tier
-- Tier Meta da quantidade máxima de usuários únicos que cada número pode
-- iniciar conversa em 24h (TIER_50/250/1K/10K/100K/UNLIMITED).
-- =============================================================================

alter table public.workspace_phone_number
  add column if not exists messaging_limit_tier text;
