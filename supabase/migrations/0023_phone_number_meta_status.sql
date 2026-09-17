-- =============================================================================
-- Estado real do número, direto da Meta.
--
-- Até aqui a tela mostrava "Registro" a partir de `is_registered`, que é uma
-- flag NOSSA: só vira true quando a nossa própria chamada de /register dá
-- certo. Em Coexistência o número já nasce pareado e essa chamada não
-- acontece, então um número perfeitamente funcional aparecia como
-- "Não registrado" — assustando sem motivo.
--
-- Estes três campos vêm da Meta e respondem de fato:
--   status         CONNECTED | PENDING | FLAGGED | RESTRICTED …
--   platform_type  CLOUD_API | ON_PREMISE | NOT_APPLICABLE
--   is_on_biz_app  true = número em Coexistência (app + Cloud API)
-- =============================================================================

alter table public.workspace_phone_number
  add column if not exists meta_status    text,
  add column if not exists platform_type  text,
  add column if not exists is_on_biz_app  boolean;

comment on column public.workspace_phone_number.meta_status is
  'Campo `status` da Meta: CONNECTED, PENDING, FLAGGED, RESTRICTED…';
comment on column public.workspace_phone_number.platform_type is
  'CLOUD_API, ON_PREMISE ou NOT_APPLICABLE.';
comment on column public.workspace_phone_number.is_on_biz_app is
  'true quando o número está em Coexistência — segue no app e na Cloud API.';
comment on column public.workspace_phone_number.is_registered is
  'Flag interna: a NOSSA chamada de /register deu certo. Não vale pra '
  'Coexistência, onde o pareamento já registra o número. Prefira meta_status.';

-- ============================================================================
-- Fim — 0023
-- ============================================================================
