# Migrations Supabase

> Onde ficam: `supabase/migrations/*.sql`. Aplicação manual no MVP via Dashboard SQL Editor.
> Futuro: linkar Supabase CLI (`supabase link`, `supabase db push`).

## Como aplicar (MVP — manual)

1. Acesse o projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. Menu lateral → **SQL Editor**.
3. Clica em **"New query"**.
4. Para **cada** arquivo em `supabase/migrations/` na ordem (sufixo numérico crescente):
   - Abre o arquivo `.sql` localmente.
   - Cola TODO o conteúdo no editor.
   - Clica em **Run** (canto inferior direito).
   - Confirma que não houve erro (mensagem "Success. No rows returned." ou contagem de linhas afetadas).

## Ordem atual

| # | Arquivo | O que cria |
|---|---------|------------|
| 0001 | `0001_init_auth_workspaces.sql` | `profile`, `workspace`, `workspace_member`, RLS, triggers, helpers RPC |
| 0002 | `0002_meta_connection.sql` | `workspace_meta_connection`, `workspace_phone_number`, RLS |

## Verificação pós-aplicação

No SQL Editor, rode:

```sql
-- Tabelas criadas
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
-- Esperado: profile, workspace, workspace_member

-- RLS habilitado
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profile', 'workspace', 'workspace_member');
-- Esperado: rowsecurity = true em todas

-- Trigger de criação de profile
select tgname from pg_trigger where tgname = 'on_auth_user_created';
-- Esperado: 1 linha
```

## Quando aplicar

- Toda vez que adicionar/alterar arquivo em `supabase/migrations/`.
- Antes de testar features que dependem do schema (E1 antes de E2, E4 antes de listar contatos, etc).

## Quando linkar CLI (futuro)

Quando o projeto crescer ou tiver múltiplos ambientes (staging/prod):

```bash
# Instalar Supabase CLI
npm i -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref <ref>

# Aplicar migrations pendentes
supabase db push

# Gerar tipos TS
supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## Reset durante dev

Se precisar limpar tudo durante dev (CUIDADO — apaga dados):

```sql
-- No SQL Editor (cuidado!)
drop table if exists public.workspace_member cascade;
drop table if exists public.workspace cascade;
drop table if exists public.profile cascade;
drop type if exists public.workspace_role;
drop function if exists public.set_updated_at();
drop function if exists public.handle_new_user();
drop function if exists public.handle_new_workspace();
drop function if exists public.is_workspace_member(uuid);
drop function if exists public.is_workspace_owner(uuid);
drop trigger if exists on_auth_user_created on auth.users;
```

Depois reaplicar `0001_init_auth_workspaces.sql`.
