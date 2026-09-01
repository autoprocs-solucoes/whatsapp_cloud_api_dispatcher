-- =============================================================================
-- Múltiplas contas Meta por workspace.
-- Até aqui, workspace_meta_connection tinha workspace_id como PK (1 conexão
-- por workspace). Agora um workspace pode ter N WABAs conectadas (várias
-- contas de cliente, por ex.), cada uma com seus próprios phone numbers e
-- templates. workspace_phone_number e template passam a apontar pra qual
-- connection (WABA) pertencem, pra rotear o access_token certo no envio e
-- pra impedir combinar template de uma conta com número de outra.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- workspace_meta_connection: troca PK de workspace_id pra id (uuid) próprio.
-- ----------------------------------------------------------------------------
alter table public.workspace_meta_connection
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.workspace_meta_connection drop constraint if exists workspace_meta_connection_pkey;
alter table public.workspace_meta_connection add primary key (id);

create index if not exists workspace_meta_connection_workspace_id_idx
  on public.workspace_meta_connection(workspace_id);

-- Evita duplicar a mesma WABA duas vezes no mesmo workspace (reconectar a
-- mesma WABA deve atualizar a linha existente, não criar outra).
alter table public.workspace_meta_connection
  add constraint workspace_meta_connection_workspace_waba_unique unique (workspace_id, waba_id);

-- ----------------------------------------------------------------------------
-- workspace_phone_number: aponta pra qual connection (WABA) pertence.
-- ----------------------------------------------------------------------------
alter table public.workspace_phone_number
  add column if not exists connection_id uuid references public.workspace_meta_connection(id) on delete cascade;

-- Backfill: até aqui só existia 1 connection por workspace, então o mapeamento
-- é direto.
update public.workspace_phone_number pn
set connection_id = wmc.id
from public.workspace_meta_connection wmc
where wmc.workspace_id = pn.workspace_id and pn.connection_id is null;

alter table public.workspace_phone_number alter column connection_id set not null;

create index if not exists workspace_phone_number_connection_id_idx
  on public.workspace_phone_number(connection_id);

-- ----------------------------------------------------------------------------
-- template: idem — cada template pertence a uma WABA específica.
-- ----------------------------------------------------------------------------
alter table public.template
  add column if not exists connection_id uuid references public.workspace_meta_connection(id) on delete cascade;

update public.template t
set connection_id = wmc.id
from public.workspace_meta_connection wmc
where wmc.workspace_id = t.workspace_id and t.connection_id is null;

alter table public.template alter column connection_id set not null;

create index if not exists template_connection_id_idx
  on public.template(connection_id);
