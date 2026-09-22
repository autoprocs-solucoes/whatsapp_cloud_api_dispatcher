-- =============================================================================
-- E13.1 — Campanha aponta só para o fluxo
--
-- O modelo de abertura deixou de ser campo da campanha: ele é o primeiro bloco
-- do fluxo, onde faz sentido (é a mensagem que sai fora da janela de 24h, e o
-- desenho do fluxo é quem diz o que vem depois da resposta). Guardar o mesmo
-- template nos dois lugares só criaria duas verdades para manter em sincronia.
-- =============================================================================

alter table public.campaign
  drop column if exists template_id;

-- ============================================================================
-- Fim — E13.1
-- ============================================================================
