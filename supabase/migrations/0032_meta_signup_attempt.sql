-- =============================================================================
-- Rastro do Embedded Signup.
--
-- O fluxo é todo no navegador: popup da Meta, callback do SDK, server action.
-- Quando alguma dessas pontas falha, o usuário vê um toast que some e o banco
-- fica vazio — foi exatamente o caso do cliente que "fez tudo, até o cartão" e
-- não apareceu conexão nenhuma.
--
-- Cada etapa passa a deixar uma linha. É o que permite dizer onde parou em vez
-- de pedir pra tentar de novo às cegas.
-- =============================================================================

create table if not exists public.meta_signup_attempt (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  workspace_id    uuid references public.workspace(id) on delete cascade,
  user_id         uuid references public.profile(user_id) on delete set null,

  -- launch | finish | cancel | saved | failed
  stage           text not null,
  method          text,
  waba_id         text,
  phone_number_id text,
  error           text,
  detail          jsonb
);

create index if not exists meta_signup_attempt_created_idx
  on public.meta_signup_attempt(created_at desc);

alter table public.meta_signup_attempt enable row level security;

drop policy if exists "meta_signup_attempt_select_member" on public.meta_signup_attempt;
create policy "meta_signup_attempt_select_member"
  on public.meta_signup_attempt for select
  using (workspace_id is null or public.is_workspace_member(workspace_id));
