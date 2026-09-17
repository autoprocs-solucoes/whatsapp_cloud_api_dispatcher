-- =============================================================================
-- Espelho de conversas.
--
-- Até aqui o webhook só olhava `statuses` (entrega/leitura) e reações — toda
-- mensagem que o cliente RESPONDIA era descartada. Esta tabela guarda os dois
-- lados da conversa, de entrada e de saída, pra que o workspace consiga ler e
-- responder sem sair da plataforma.
--
-- Não existe tabela de "conversa": uma conversa é o agrupamento das mensagens
-- por (connection_id, contact_phone_e164). Evita denormalização pra manter em
-- sincronia — a listagem usa `distinct on`, que é um index scan.
-- =============================================================================

create table if not exists public.whatsapp_message (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspace(id) on delete cascade,
  -- Qual conta Meta (WABA) recebeu/enviou. Um workspace pode ter várias, e as
  -- conversas de cada número são independentes.
  connection_id      uuid not null references public.workspace_meta_connection(id) on delete cascade,
  phone_number_id    text not null,

  -- Chave da conversa: sempre o número do CONTATO, nos dois sentidos.
  contact_phone_e164 text not null,
  contact_id         uuid references public.contact(id) on delete set null,
  contact_name       text,

  direction          text not null check (direction in ('in', 'out')),
  type               text not null default 'text',
  body               text,

  -- Mídia não é baixada: a Meta guarda e a gente resolve sob demanda com o
  -- token. As URLs dela expiram, então guardar a URL não adiantaria.
  media_id           text,
  media_mime         text,

  meta_message_id    text,
  -- Só para direction = 'out'.
  status             text check (status in ('sent', 'delivered', 'read', 'failed')),
  error_message      text,

  -- Leitura dentro da plataforma (não é o read receipt do WhatsApp).
  read_internally    boolean not null default false,

  sent_at            timestamptz not null default now(),
  raw                jsonb,
  created_at         timestamptz not null default now()
);

-- Listagem da conversa e da caixa de entrada.
create index if not exists whatsapp_message_thread_idx
  on public.whatsapp_message(connection_id, contact_phone_e164, sent_at desc);

create index if not exists whatsapp_message_workspace_idx
  on public.whatsapp_message(workspace_id, sent_at desc);

-- Não lidas por conversa.
create index if not exists whatsapp_message_unread_idx
  on public.whatsapp_message(workspace_id, read_internally)
  where direction = 'in' and read_internally = false;

-- Garante idempotência: o webhook pode reentregar o mesmo evento, e o envio
-- pela plataforma grava a mensagem ao mesmo tempo que o echo chega.
create unique index if not exists whatsapp_message_meta_id_unique
  on public.whatsapp_message(workspace_id, meta_message_id)
  where meta_message_id is not null;

-- ----------------------------------------------------------------------------
-- RLS: membro do workspace lê; escrita só via service_role (webhook e ações).
-- ----------------------------------------------------------------------------
alter table public.whatsapp_message enable row level security;

drop policy if exists "whatsapp_message_select_member" on public.whatsapp_message;
create policy "whatsapp_message_select_member"
  on public.whatsapp_message for select
  using (public.is_workspace_member(workspace_id));

-- ----------------------------------------------------------------------------
-- Caixa de entrada: última mensagem de cada conversa + não lidas.
-- `distinct on` pega a linha mais recente por contato direto pelo índice, sem
-- varrer as últimas N mensagens do workspace inteiro.
-- ----------------------------------------------------------------------------
create or replace function public.list_whatsapp_conversations(
  p_workspace_id uuid,
  p_limit        int default 30,
  p_offset       int default 0,
  p_search       text default null
)
returns table (
  contact_phone_e164 text,
  contact_id         uuid,
  contact_name       text,
  connection_id      uuid,
  last_body          text,
  last_type          text,
  last_direction     text,
  last_at            timestamptz,
  unread             bigint,
  -- Última mensagem RECEBIDA: é ela que define a janela de 24h.
  last_inbound_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with threads as (
    select distinct on (m.connection_id, m.contact_phone_e164)
           m.connection_id,
           m.contact_phone_e164,
           m.contact_id,
           m.contact_name,
           m.body      as last_body,
           m.type      as last_type,
           m.direction as last_direction,
           m.sent_at   as last_at
      from public.whatsapp_message m
     where m.workspace_id = p_workspace_id
     order by m.connection_id, m.contact_phone_e164, m.sent_at desc
  )
  select t.contact_phone_e164,
         t.contact_id,
         t.contact_name,
         t.connection_id,
         t.last_body,
         t.last_type,
         t.last_direction,
         t.last_at,
         coalesce((
           select count(*)
             from public.whatsapp_message u
            where u.workspace_id = p_workspace_id
              and u.connection_id = t.connection_id
              and u.contact_phone_e164 = t.contact_phone_e164
              and u.direction = 'in'
              and u.read_internally = false
         ), 0) as unread,
         (
           select max(i.sent_at)
             from public.whatsapp_message i
            where i.workspace_id = p_workspace_id
              and i.connection_id = t.connection_id
              and i.contact_phone_e164 = t.contact_phone_e164
              and i.direction = 'in'
         ) as last_inbound_at
    from threads t
   where p_search is null
      or p_search = ''
      or t.contact_phone_e164 ilike '%' || p_search || '%'
      or coalesce(t.contact_name, '') ilike '%' || p_search || '%'
   order by t.last_at desc
   limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.list_whatsapp_conversations(uuid, int, int, text) from public;
grant execute on function public.list_whatsapp_conversations(uuid, int, int, text) to service_role;

-- ============================================================================
-- Fim — 0022
-- ============================================================================
