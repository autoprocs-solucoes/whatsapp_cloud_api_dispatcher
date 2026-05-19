# Épico E5 — Templates

> Status: **⬜ Não iniciado**.

> Objetivo: workspace tem lista local de templates aprovados/pendentes/rejeitados da Meta, sincronizada manualmente via botão. Disparo (E7) só permite escolher templates `APPROVED`.

## Decisões consolidadas

| Tema | Decisão |
|------|---------|
| **Criação no MVP** | **Não.** Cliente cria template no WhatsApp Manager. App só sincroniza. |
| **Sync** | Manual via botão "Sincronizar" na tela de templates. Sem auto-sync, sem webhook. |
| **Persistência** | Cache local em Postgres pra evitar bater na Meta a cada request. Sync atualiza `status`, `last_synced_at` e components. |
| **Preview** | Sai do escopo de E5. Move pra E7 (Disparo) onde já tem mapeamento variável → contato. |
| **Filtro de uso** | E7 só lista templates com `status = 'APPROVED'` no dropdown. |
| **Idiomas** | Cliente pode ter mesmo `name` em vários `language` codes (ex: `pt_BR`, `en_US`). Unique key local = `(workspace_id, meta_template_id)`. |

## Critérios de aceite

- [ ] Migration `0004_templates.sql` escrita.
- [ ] Helper `listTemplates(wabaId, token)` em `src/lib/meta/graph-api.ts`.
- [ ] Server action `syncTemplatesAction` upserta lista da Meta.
- [ ] `/templates` mostra tabela: nome, categoria, idioma, status (badge), última sync, preview do body.
- [ ] Botão "Sincronizar" com toast de quantos foram atualizados.
- [ ] Empty state se workspace não tem WABA conectado (CTA pra `/configuracoes`).
- [ ] Empty state se WABA conectado mas nenhum template ainda (CTA pra sincronizar).
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam.
- [ ] Validação ponta-a-ponta no browser.

## Modelo de dados

```
template
  id               uuid pk default gen_random_uuid()
  workspace_id     uuid not null -> workspace.id (ON DELETE CASCADE)
  meta_template_id text not null   -- ID da Meta (vem do retorno do Graph)
  name             text not null   -- ex: "delivery_confirmation_5"
  language         text not null   -- ex: "en_US", "pt_BR"
  category         text not null   -- UTILITY | MARKETING | AUTHENTICATION
  status           text not null   -- APPROVED | PENDING | REJECTED | DISABLED | IN_APPEAL
  header_text      text
  body_text        text
  footer_text      text
  buttons          jsonb default '[]'::jsonb
  components_raw   jsonb           -- response cru da Meta pra debug
  last_synced_at   timestamptz not null default now()
  created_at       timestamptz not null default now()
  unique(workspace_id, meta_template_id)
```

Índices:
- `template (workspace_id, status)` — pra E7 filtrar APPROVED rápido
- `template (workspace_id, name, language)` — busca

RLS: select se membro, mutate via server action (admin client) — sem write direto por cliente.

## Stories

### E5-S1 — Migration 0004

Tabela acima + RLS + índices + trigger updated_at se necessário (não tem updated_at — sync sobrescreve via upsert).

### E5-S2 — Graph API helper

```ts
export type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "DISABLED" | "IN_APPEAL";
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  components: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    text?: string;
    format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  }>;
};

export async function listTemplates(wabaId: string, token: string): Promise<MetaTemplate[]>
```

GET `/{waba_id}/message_templates?fields=id,name,language,status,category,components&limit=100` com paginação cursor.

### E5-S3 — Server actions

`src/features/templates/actions.ts`:
- `listTemplatesForWorkspace()` — server function pra page renderizar.
- `syncTemplatesAction()` — busca connection do workspace, chama Graph, extrai header/body/footer/buttons dos components, upsert em `template`. Retorna `{ synced: number, errors: string[] }`.

### E5-S4 — Tabela templates

`src/features/templates/templates-table.tsx`:
- Plain HTML table.
- Colunas: Nome, Categoria, Idioma, Status (badge cor por status), Body preview (200ch), Sync.
- Botão "Sincronizar" no topo (client component com transition + toast).
- Empty state com CTA pra `/configuracoes` se sem WABA.

### E5-S5 — Página

`app/(app)/templates/page.tsx` — server component. Lê connection + templates, renderiza tabela ou empty state.

## Saída

Workspace tem cache local de templates aprovados. E7 pode listar `status='APPROVED'` no dropdown de "Novo comunicado".

## Ordem de execução

E5-S1 → E5-S2 → E5-S3 → E5-S4 → E5-S5.
