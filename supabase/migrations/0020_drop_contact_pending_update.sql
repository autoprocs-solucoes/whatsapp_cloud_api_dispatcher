-- =============================================================================
-- Remove a fila de pendências de contatos (criada em 0011).
-- O recurso saiu da aplicação — nenhum código lê ou escreve nessa tabela.
--
-- ATENÇÃO: isto apaga as solicitações pendentes que ainda existirem. Rode só
-- quando tiver certeza de que não precisa desse histórico.
-- =============================================================================

drop table if exists public.contact_pending_update;
