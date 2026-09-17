-- =============================================================================
-- Assinaturas de notificação push (Web Push).
--
-- Uma linha por NAVEGADOR, não por usuário: a mesma pessoa no desktop e no
-- celular precisa de duas, porque o endpoint é emitido pelo navegador e é ele
-- que recebe a mensagem. Por isso o endpoint é único no sistema inteiro.
--
-- Quem recebe aviso de comunicado concluído são os owners do workspace, mas
-- isso é decidido na hora do envio: a assinatura em si pertence à pessoa e
-- vale pra todos os workspaces em que ela é owner.
-- =============================================================================

create table if not exists public.push_subscription (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profile(user_id) on delete cascade,

  -- URL que o serviço de push do navegador (FCM, Mozilla, Apple) expõe.
  endpoint    text not null unique,
  -- Chaves da criptografia ponta a ponta do Web Push.
  p256dh      text not null,
  auth        text not null,

  -- Ajuda a pessoa a reconhecer o aparelho quando for remover.
  user_agent  text,

  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscription_user_idx
  on public.push_subscription(user_id);

alter table public.push_subscription enable row level security;

-- A pessoa enxerga só as próprias assinaturas. Escrita acontece por server
-- action com service_role, então não há policy de insert/update.
drop policy if exists "push_subscription_select_own" on public.push_subscription;
create policy "push_subscription_select_own"
  on public.push_subscription for select
  using (user_id = auth.uid());

-- ============================================================================
-- Fim — 0024
-- ============================================================================
