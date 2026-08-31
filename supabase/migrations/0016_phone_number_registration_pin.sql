-- =============================================================================
-- workspace_phone_number.pin
-- PIN de 6 dígitos usado no registro do número na Cloud API
-- (POST /{phone_number_id}/register). Precisa ser reaproveitado nas próximas
-- chamadas de registro do mesmo número — gerar um PIN novo quebra o /register
-- se o número já tem verificação em duas etapas ativada com o PIN anterior.
-- =============================================================================

alter table public.workspace_phone_number
  add column if not exists pin text;
