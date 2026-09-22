-- =============================================================================
-- Registro das tentativas de push.
--
-- Existe por um motivo prático: quando alguém diz "não chegou notificação", a
-- conversa vira chute sem isso. Aqui fica o que foi tentado, pra quantos
-- aparelhos e o que o serviço de push respondeu — o log da Vercel não guarda
-- histórico que dê pra consultar depois.
-- =============================================================================

create table if not exists public.push_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  title       text not null,
  tag         text,
  targets     int not null default 0,   -- aparelhos encontrados
  sent        int not null default 0,   -- aceitos pelo serviço de push
  failed      int not null default 0,
  detail      jsonb                     -- códigos de erro, quando houver
);

create index if not exists push_log_created_idx on public.push_log(created_at desc);

alter table public.push_log enable row level security;

-- Sem policy de leitura: é diagnóstico de servidor, consultado com
-- service_role. Ninguém precisa disso no navegador.
