# Épico E6 — Segmentação

> Status: **🔵 Código pronto, aguardando migration `0005_segments.sql` ser aplicada no Supabase e validação ponta-a-ponta no browser**.

> Objetivo: workspace consegue criar grupos de contatos (segmentos) via query builder visual sobre tags, campos custom e atributos do contato, com preview de contagem em tempo real. E7 (Disparos) lê esses segmentos pra resolver destinatários.

## Decisões consolidadas

| Tema | Decisão |
|------|---------|
| **Escopo MVP** | Regras flat (sem grupos aninhados) — `match` raiz `AND`/`OR` + array de regras leaf. Aninhamento fica pra V2 se demanda surgir. |
| **Operadores MVP** | `equals`, `not_equals`, `contains`, `in`, `has_tag`, `not_has_tag`. `>`/`<`/`entre` excluídos (custom_fields são texto). |
| **Campos suportados** | `full_name`, `phone_e164`, `tags`, `custom_fields.<chave>`. Demais (datas, opt_out, histórico) ficam pra V2/E7. |
| **Histórico de envios** | "Recebeu/não recebeu comunicado X" adiado pra E7 (sem tabela `dispatch` ainda). |
| **Persistência** | Tabela `segment` com `rules jsonb`. Preview de contagem reusa o mesmo translator no servidor. |
| **Opt-out** | Sempre filtrado (`opt_out = false`) tanto na contagem quanto na resolução em E7. Não é regra do builder. |
| **Auto-update** | Segmento é uma definição; contatos são resolvidos no momento do disparo. Sem snapshot persistente no segmento. |
| **Custom fields disponíveis no builder** | Coletados a partir dos contatos existentes do workspace (UNION DISTINCT das chaves de `custom_fields`). |
| **Validação** | Zod no client + server. Server re-valida antes de persistir/resolver. Limite 50 regras por segmento. |
| **Roles** | Member pode tudo em segmentos (igual contatos). |

## Critérios de aceite

- [ ] Migration `0005_segments.sql` escrita.
- [ ] Types TS regenerados em `database.types.ts`.
- [ ] Helper `compileRules(rules)` que aplica filtros sobre query `contact` do supabase-js.
- [ ] Server actions: `listSegments`, `getSegment`, `createSegment`, `updateSegment`, `deleteSegment`, `previewCountAction`.
- [ ] `/segmentos` lista segmentos com nome, contagem cache, criado em, ações.
- [ ] `/segmentos/novo` e `/segmentos/[id]` com query builder + preview de contagem.
- [ ] Validação ponta-a-ponta no browser após user aplicar migration.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam.

## Modelo de dados

```
segment
  id              uuid pk default gen_random_uuid()
  workspace_id    uuid not null -> workspace.id (ON DELETE CASCADE)
  name            text not null
  rules           jsonb not null   -- { match: "and" | "or", rules: Rule[] }
  created_by      uuid -> profile.user_id (ON DELETE SET NULL)
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
  unique(workspace_id, name)
```

Índices:
- `segment (workspace_id, created_at desc)` — listagem default

RLS: member pode tudo.

### Formato das regras

```ts
type RuleMatch = "and" | "or";

type Field =
  | { kind: "attr"; name: "full_name" | "phone_e164" }
  | { kind: "custom"; key: string }
  | { kind: "tags" };

type Op =
  | "equals" | "not_equals" | "contains"      // attr + custom (text)
  | "in"                                       // attr + custom (lista de valores)
  | "has_tag" | "not_has_tag";                 // só pra field tags

type Rule = {
  field: Field;
  op: Op;
  value: string | string[];   // string p/ equals/contains; string[] p/ in/has_tag/not_has_tag
};

type Rules = { match: RuleMatch; rules: Rule[] };
```

## Stories

### E6-S1 — Migration 0005

Tabela acima + RLS + trigger updated_at.

### E6-S2 — Schemas e translator

`src/features/segments/schemas.ts` (zod) + `src/features/segments/rules.ts`:
- `compileRules(query, rules)` muta a query do supabase-js pra aplicar filtros sobre `contact`.
- Filtra automaticamente `opt_out = false`.
- Operadores em `custom_fields` usam path JSON (`custom_fields->>'chave'`).

### E6-S3 — Server actions

`src/features/segments/actions.ts`:
- `listSegments()` — lista do workspace ativo.
- `getSegment(id)` — pra editor.
- `createSegmentAction(formData)` + `updateSegmentAction(formData)` — recebe `name` + `rules` JSON.
- `deleteSegmentAction(formData)`.
- `previewCountAction(rules)` — retorna `{ count }`.
- `listCustomFieldKeys()` — UNION distinct das chaves usadas em `custom_fields` no workspace, pra preencher options do builder.

### E6-S4 — Lista de segmentos

`src/app/(app)/segmentos/page.tsx` — server component, lista segmentos com link de edição + botão "Novo".

### E6-S5 — Editor com query builder

`src/app/(app)/segmentos/novo/page.tsx` + `/segmentos/[id]/page.tsx`:
- Form: nome + builder.
- Builder client-side: toggle AND/OR, lista de regras (Field + Op + Value), add/remove.
- Preview de contagem debounced (chama `previewCountAction`).
- Submit → create/update + redirect pra lista.

## Saída

Workspace tem segmentos salvos. E7 (Disparos) lê `segment.rules`, compila e resolve `contact_ids` no momento do envio.

## Ordem de execução

E6-S1 → E6-S2 → E6-S3 → E6-S4 → E6-S5.
