# Épico E4 — Contatos

> Status: **⬜ Não iniciado**.

> Objetivo: workspace tem base de contatos importada via wizard xlsx/csv, com normalização E.164, dedup por telefone, edição individual e opt-out manual. Pré-requisito de segmentação (E6) e disparos (E7).

## Decisões consolidadas

| Tema | Decisão |
|------|---------|
| **Formato de entrada** | `.xlsx` e `.csv`. Sem suporte a `.xls`/Google Sheets no MVP. |
| **Chave única** | `phone_e164` normalizado, único por workspace. |
| **Dedup** | **Atualiza** contato existente (full_name + custom_fields). Mantém `opt_out`, `opt_out_at`, `tags`. Wizard mostra no review quantos serão criados vs atualizados. |
| **Tags** | Manuais pós-import. Não aparecem no mapping. |
| **Telefones inválidos** | Pula linha, conta nas stats, oferece download CSV dos rejeitados (telefone + linha + motivo). |
| **Auto-mapping** | Detecta headers PT-BR comuns (`telefone`, `celular`, `whatsapp`, `nome`, `email`) e pré-seleciona no passo 2. |
| **Default country** | BR (+55). Cliente pode digitar com ou sem DDI. |
| **Persist arquivo original** | Não. Só metadados (mapping + stats) em `contact_import`. |
| **Tabela** | HTML plain (consistente com E1 `members-table`). Server-side pagination + busca. |

## Critérios de aceite

- [ ] Migration `0003_contacts.sql` escrita (aplicação pendente).
- [ ] Types TS regenerados em `database.types.ts`.
- [ ] `/contatos` lista contatos com busca por nome/telefone, filtro opt-out, paginação.
- [ ] Botão **Importar contatos** abre wizard 3 passos.
- [ ] Passo 1: upload xlsx/csv, mostra preview 10 primeiras linhas + nome do arquivo.
- [ ] Passo 2: mapping com auto-detect PT-BR. Telefone obrigatório. Demais colunas viram custom (nome editável).
- [ ] Passo 3: stats (válidos novos / a atualizar / inválidos / total) + download CSV inválidos + botão confirmar.
- [ ] Confirmação executa import server-side e redireciona pra listagem com toast.
- [ ] Edição individual de contato (full_name + custom_fields + tags) via modal.
- [ ] Toggle opt-out por linha (com confirmação).
- [ ] Delete contato (com confirmação).
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam.
- [ ] Validação ponta-a-ponta no browser após user aplicar migration.

## Modelo de dados

```
contact
  id              uuid pk default gen_random_uuid()
  workspace_id    uuid not null -> workspace.id (ON DELETE CASCADE)
  phone_e164      text not null
  full_name       text
  custom_fields   jsonb not null default '{}'::jsonb
  opt_out         boolean not null default false
  opt_out_at      timestamptz
  tags            text[] not null default '{}'::text[]
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
  created_by      uuid -> profile.user_id (ON DELETE SET NULL)
  unique(workspace_id, phone_e164)

contact_import
  id              uuid pk default gen_random_uuid()
  workspace_id    uuid not null -> workspace.id (ON DELETE CASCADE)
  filename        text
  mapping         jsonb not null   -- { phone_column: "Tel 1", custom: { "nome": "Nome", "cpf": "CPF" } }
  stats           jsonb not null   -- { total, valid_new, valid_updated, invalid, duplicates_in_file }
  created_by      uuid -> profile.user_id (ON DELETE SET NULL)
  created_at      timestamptz not null default now()
```

Índices:
- `contact (workspace_id, phone_e164)` — unique
- `contact (workspace_id, opt_out)` — pra filtro rápido em disparos
- `contact (workspace_id, created_at desc)` — pra listagem default
- `contact_import (workspace_id, created_at desc)`

RLS: select/insert/update/delete se `is_workspace_member(workspace_id)`. Member pode tudo em contatos (não é gestão de workspace).

## Stories

### E4-S1 — Migration 0003_contacts.sql

Tabelas acima + RLS + trigger updated_at em `contact`.

### E4-S2 — Helper E.164

`src/lib/phone/e164.ts`:
- Dep: `libphonenumber-js` (peso ~150kb, tree-shakeable).
- `normalizeBR(input: string): { ok: true, e164: string } | { ok: false, reason: string }`.
- Aceita: `(61) 99166-4479`, `61991664479`, `5561991664479`, `+55 61 9 9166 4479`.
- Rejeita: vazio, fixo curto (<10 dígitos pós-DDI), não-numérico após strip.

### E4-S3 — Parser planilha

`src/lib/import/parse-spreadsheet.ts` (server-only):
- Deps: `xlsx` (SheetJS) + `papaparse`.
- `parseSpreadsheet(buffer, mime): { headers: string[], rows: Record<string, string>[] }`.
- Detecta xlsx vs csv pelo mime. Primeira linha = headers. Valores convertidos pra string trimmed.
- Limita 50k linhas (proteção memória).

### E4-S4 — Server actions

`src/features/contacts/actions.ts`:
- `previewImportAction(formData: { file })` → retorna `{ headers, sampleRows (10), allRowsCount, autoMapping }`. Não persiste nada. Guarda buffer em cache temporário? **Não** — re-upload no confirm é aceitável pro MVP (arquivos pequenos).
- `confirmImportAction(formData: { file, mapping })` → parse + normaliza + dedup + UPSERT em batch (~500/batch). Cria registro em `contact_import` com stats. Retorna `{ ok, stats }`.
- `listContactsAction({ workspaceId, search, optOutFilter, page, pageSize })`.
- `updateContactAction({ id, full_name, custom_fields, tags })`.
- `toggleOptOutAction({ id, opt_out })`.
- `deleteContactAction({ id })`.

Auth: todas verificam `is_workspace_member`. Use admin client (padrão E1).

### E4-S5 — Wizard import

`src/features/contacts/import-wizard.tsx` (client):
- Stepper visual (1 → 2 → 3).
- Passo 1: input file + preview table (shadcn).
- Passo 2: form com select por coluna detectada. Select "Telefone principal" obrigatório (radio entre colunas detectáveis como telefone). Demais colunas: checkbox "Importar como" + input nome do campo custom (slug).
- Passo 3: stats em cards + botão "Baixar inválidos" + "Confirmar import".
- State via `useState` (não precisa de form lib).

### E4-S6 — Tabela contatos

`src/features/contacts/contacts-table.tsx` (client):
- Plain HTML table (consistente com members-table).
- Colunas: Nome, Telefone, Tags (badges), Opt-out (toggle), Criado em, Ações (editar/deletar).
- Busca debounced server-side via URL param.
- Filtro opt-out via switch.
- Paginação via URL params (page, pageSize).

`src/features/contacts/edit-contact-dialog.tsx`:
- Modal com form: full_name, tags (multi-input), custom_fields (key/value editor).

### E4-S7 — Página `/contatos` + nav

- `src/app/(app)/contatos/page.tsx` — server component, lê query params, chama `listContactsAction`, renderiza tabela.
- `src/app/(app)/contatos/importar/page.tsx` — render do wizard.
- Adiciona item "Contatos" na sidebar (após Dashboard).

## Saída

Workspace tem base de contatos pronta. E5 (Templates) pode usar contato real pra preview. E6 (Segmentação) tem o que filtrar. E7 (Disparos) tem destinatário.

## Ordem de execução

E4-S1 → E4-S2 → E4-S3 → E4-S4 → E4-S5 → E4-S6 → E4-S7.

> Sugestão: parar após S5 e validar manualmente um import antes de S6/S7.
