-- =============================================================================
-- workspace_meta_connection.connection_method
-- Como o workspace conectou a conta Meta: manual (WABA ID + token colados),
-- embedded_signup (Embedded Signup padrão, número novo) ou coexistence
-- (Embedded Signup de Coexistência, número que continua no WhatsApp Business
-- app ao mesmo tempo que usa a Cloud API).
-- =============================================================================

alter table public.workspace_meta_connection
  add column if not exists connection_method text not null default 'manual';

alter table public.workspace_meta_connection
  add constraint workspace_meta_connection_connection_method_check
  check (connection_method in ('manual', 'embedded_signup', 'coexistence'));
