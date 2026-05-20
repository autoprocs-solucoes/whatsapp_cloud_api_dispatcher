-- =============================================================================
-- E7.2 — Reação à mensagem
-- Guarda última reação recebida do destinatário. Lookup do webhook externo é
-- feito por reaction.message_id == dispatch_recipient.meta_message_id
-- (índice dispatch_recipient_meta_message_idx já existe em 0006).
-- Emoji NULL = sem reação ou reação removida (Meta envia emoji vazio).
-- =============================================================================

alter table public.dispatch_recipient
  add column if not exists reaction_emoji text,
  add column if not exists reaction_at    timestamptz;
