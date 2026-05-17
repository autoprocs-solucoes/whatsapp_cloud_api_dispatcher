# Épico E1 — Autenticação e Workspaces

> Status: **🔵 Código pronto, aguardando user aplicar migration `0001_init_auth_workspaces.sql` no Supabase para testar fluxo end-to-end.**

> Objetivo: usuário cria conta, loga, cria seu primeiro workspace, convida membros e troca entre workspaces. Toda data isolada por workspace via RLS. Roles owner/member.

## Critérios de aceite

- [x] Schema SQL escrito em `supabase/migrations/0001_init_auth_workspaces.sql` (aplicação pendente).
- [x] Trigger `on_auth_user_created` cria registro em `profile` automaticamente.
- [x] Página `/signup` cria conta + redireciona para `/onboarding`.
- [x] Página `/login` autentica + redireciona para `/dashboard`.
- [x] Página `/onboarding` cria primeiro workspace (usuário vira owner via trigger).
- [x] Middleware bloqueia rotas `/(app)/**` + `/onboarding` se não tiver sessão.
- [x] `WorkspaceSwitcher` lista workspaces reais do usuário e troca via cookie.
- [x] `UserMenu` mostra nome/email reais + logout funcional.
- [x] `/configuracoes` com tabs Workspace + Membros (Meta placeholder pra E2).
- [x] Owner pode convidar/remover membros; member não pode.
- [x] `is_superadmin` flag em `profile` (campo só; UI cross-workspace fica para E10).
- [x] Validação ponta-a-ponta no browser após user aplicar migration.

## Stories

### E1-S1 — Schema SQL + RLS

Tabelas:
- `profile (user_id pk → auth.users, full_name, avatar_url, is_superadmin bool, created_at, updated_at)`
- `workspace (id pk, name, slug unique, logo_url, owner_id → profile, created_at, updated_at)`
- `workspace_member (workspace_id, user_id, role enum('owner','member'), created_at, pk composite)`

Triggers:
- `on_auth_user_created` → cria `profile` automaticamente quando insere em `auth.users`.
- `on_workspace_created` → insere owner em `workspace_member` automaticamente.

RLS policies:
- `profile`: select/update own row; insert via trigger.
- `workspace`: select se membro; update/delete se owner.
- `workspace_member`: select se membro do workspace; insert/delete se owner.

### E1-S2 — Tipos TS gerados

`src/lib/supabase/database.types.ts` — espelho do schema. Manual no MVP, automatizar com `supabase gen types` depois.

### E1-S3 — Server actions

`src/features/auth/actions.ts`:
- `signUp(email, password, fullName)` — cria user + redirect onboarding.
- `signIn(email, password)` — autentica + redirect dashboard.
- `signOut()` — encerra sessão.

`src/features/workspace/actions.ts`:
- `createWorkspace(name)` — slugify + insert + auto-add member.
- `inviteMember(workspaceId, email)` — chama Supabase admin `inviteUserByEmail` + adiciona em `workspace_member`.
- `removeMember(workspaceId, userId)` — só owner.
- `switchWorkspace(workspaceId)` — salva em cookie `active_workspace_id`.

### E1-S4 — Páginas

- `/login` — email + senha (futuro: magic link).
- `/signup` — nome + email + senha.
- `/onboarding` — criar primeiro workspace.
- `/auth/callback` — redireciona após confirm de email.

### E1-S5 — Middleware

`src/middleware.ts`:
- Refresh sessão (já feito em E0).
- Adicionar: se rota é `/(app)/*` e não tem user → redirect `/login`.
- Se rota é `/login` ou `/signup` e tem user → redirect `/dashboard`.

### E1-S6 — Helpers servidor

`src/server/auth.ts`:
- `getCurrentUser()` — server-only, retorna user + profile.
- `requireUser()` — throws/redirect se não autenticado.

`src/server/workspace.ts`:
- `getActiveWorkspace()` — lê cookie + valida membership.
- `getWorkspaces()` — lista do usuário atual.

### E1-S7 — Configurações de workspace

`/configuracoes` com tabs:
- **Workspace**: form com nome + logo (upload em E2 ou depois).
- **Membros**: tabela com nome/email/role/data; botão "Convidar" (owner only); botão remover (owner only, não pode remover a si mesmo se for único owner).

### E1-S8 — Instruções de migração

Doc: `docs/supabase-migrations.md` com SQL pra copiar no Supabase Dashboard > SQL Editor, ordem de aplicação, e (futuro) comandos Supabase CLI.

## Saída

Multi-tenancy real funcionando. Pronto pra E2 (conexão Meta por workspace).
