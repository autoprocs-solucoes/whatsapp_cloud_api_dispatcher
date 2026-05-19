# Épico E7 — Comunicados (disparo)

> Status: **🔵 Código pronto, aguardando migration `0006_dispatches.sql` e validação ponta-a-ponta no browser**.

> Objetivo: workspace consegue enviar template aprovado para uma lista de contatos (segmento salvo OU lista manual), com mapeamento de variáveis, test send e execução server-side respeitando opt-out.

## Decisões consolidadas

| Tema | Decisão |
|------|---------|
| **Destinatários MVP** | Segmento salvo OU lista manual de telefones (cola). Builder ad-hoc dentro do wizard fica pra V2. |
| **Status webhook** | n8n grava `sent/delivered/read/failed` direto no `dispatch_recipient`. App só lê. App escreve `queued`/`sent_initial`/`failed_initial` no momento do envio. |
| **Idempotency** | Status enum: `draft → running → done/failed/canceled`. Só executa se `draft`. Wizard cria como `draft`, confirm muda pra `running` e dispara. |
| **Test send** | Manda 1 mensagem pro número de teste com o mesmo mapping. Não cria `dispatch_recipient`, não filtra por opt-out (test é só pra verificar template). |
| **Variable mapping** | Por placeholder do body: `{ "1": { column: "nome" \| "phone_e164" \| "full_name" \| "<custom>", fallback: "valor padrão" } }`. Header vars idem. |
| **Opt-out** | Filtro silencioso no resolver. Não tem como override. Audit fica nos contadores (resolved vs after_optout). |
| **Rate limit** | Pause simples 300ms entre envios. Volume MVP < 1k/dia. |
| **Retry** | Sem retry MVP. Falha transiente fica gravada em `error_code`/`error_message`. |
| **Concorrência** | Execução sequencial em uma única chamada de server action (Vercel Functions ~60s). Para volumes > 200, considerar split em background V2. |
| **Roles** | Member pode criar/disparar. Sem restrição extra. |
| **CSV export** | Adiado pra V2. |

## Critérios de aceite

- [ ] Migration `0006_dispatches.sql` escrita.
- [ ] Types TS regenerados.
- [ ] Helper `sendTemplate(...)` no Graph API.
- [ ] Server actions: `createDispatchAction`, `executeDispatchAction`, `testSendAction`, `listDispatches`, `getDispatch`, `previewRecipientsAction`.
- [ ] `/comunicados` lista comunicados com nome do template, total, contadores agregados, status.
- [ ] `/comunicados/[id]` mostra detalhes + lista paginada de destinatários.
- [ ] `/comunicados/novo` wizard funcional ponta-a-ponta.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam.

## Modelo de dados

```
dispatch
  id                    uuid pk default gen_random_uuid()
  workspace_id          uuid not null -> workspace.id (cascade)
  template_id           uuid not null -> template.id (cascade)
  phone_number_id       text not null              -- Meta phone_number_id usado p/ envio
  segment_id            uuid -> segment.id (set null)
  recipient_source      text not null              -- 'segment' | 'manual'
  manual_phones         text[] not null default '{}'  -- só preenchido quando 'manual'
  variable_mapping      jsonb not null default '{}'   -- { "1": { column, fallback }, ... }
  status                text not null default 'draft' -- 'draft' | 'running' | 'done' | 'failed' | 'canceled'
  total_recipients      int not null default 0
  created_by            uuid -> profile.user_id (set null)
  created_at            timestamptz not null default now()
  updated_at            timestamptz not null default now()
  started_at            timestamptz
  finished_at           timestamptz

dispatch_recipient
  id                    uuid pk default gen_random_uuid()
  dispatch_id           uuid not null -> dispatch.id (cascade)
  contact_id            uuid -> contact.id (set null)
  phone_e164            text not null
  payload               jsonb not null      -- variáveis resolvidas que foram enviadas
  status                text not null default 'queued'
                                            -- 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  meta_message_id       text
  error_code            text
  error_message         text
  sent_at               timestamptz
  delivered_at          timestamptz
  read_at               timestamptz
  failed_at             timestamptz
```

Índices:
- `dispatch (workspace_id, created_at desc)`
- `dispatch_recipient (dispatch_id, status)`
- `dispatch_recipient (dispatch_id, phone_e164)`

RLS: member do workspace pode ler tudo. Mutação via server action (admin client).

## Stories

### E7-S1 — Migration 0006

Tabelas acima + RLS + trigger updated_at em `dispatch`.

### E7-S2 — Graph API helper

`src/lib/meta/graph-api.ts`:
```ts
export async function sendTemplate(params: {
  phoneNumberId: string;
  to: string;
  token: string;
  templateName: string;
  language: string;
  bodyVariables?: string[];
  headerVariables?: string[];
}): Promise<{ message_id: string }>
```
POST `/{phone_number_id}/messages` com payload `{messaging_product:"whatsapp", to, type:"template", template:{name, language:{code}, components:[...]}}`. Retorna `messages[0].id`.

### E7-S3 — Schemas + resolver

`src/features/dispatch/schemas.ts` (zod):
- `variableMappingSchema` — `{ [placeholder]: { column, fallback } }`
- `recipientSourceSchema` — `"segment" | "manual"`
- `createDispatchSchema` — template_id, phone_number_id, recipient_source, segment_id?, manual_phones?, variable_mapping
- `testSendSchema` — phone, mapping, template_id, phone_number_id

`src/features/dispatch/resolver.ts`:
- `resolveRecipients(workspaceId, source, segmentId?, manualPhones?)` — retorna `Contact[]` (já filtrado `opt_out=false`).
- Para `manual`: normaliza phones via `normalizeBR`, busca contatos existentes (cria entry temporária em memória se contato não existe — `contact_id=null`). Decisão MVP: requer que o contato exista; phones que não casam = pulados com warning.

### E7-S4 — Server actions

`src/features/dispatch/actions.ts`:
- `previewRecipientsAction(input)` — conta destinatários antes do confirm.
- `createDispatchAction(formData)` — valida, insere dispatch + recipients. Retorna `id`.
- `testSendAction(input)` — manda mensagem única, retorna sucesso/erro.
- `executeDispatchAction(formData: { id })` — verifica `status='draft'`, marca `running`, loop sequencial mandando + atualizando recipient, no fim marca `done`/`failed`. Pausa 300ms entre envios.
- `listDispatches()` + `getDispatch(id)`.

### E7-S5 — Lista + detalhe

`src/app/(app)/comunicados/page.tsx` — lista paginada (server component).
`src/app/(app)/comunicados/[id]/page.tsx` — header com contadores agregados + lista paginada de recipients com filtros por status.

### E7-S6 — Wizard

`src/app/(app)/comunicados/novo/page.tsx` carrega templates aprovados + phone numbers + segmentos. Renderiza `DispatchWizard` client.

`src/features/dispatch/wizard.tsx`:
- Passo 1: dropdown template aprovado → mostra preview body com placeholders destacados.
- Passo 2: dropdown phone_number.
- Passo 3: pra cada placeholder do body, Combobox de coluna do contato + input fallback.
- Passo 4: tab "Segmento salvo" / "Lista manual". Segmento → Combobox lista segmentos do workspace; Manual → textarea (1 telefone por linha).
- Passo 5: test send — input de número + botão.
- Passo 6: revisão — total destinatários, template, phone, etc + botão "Disparar agora".
- Confirm cria dispatch (draft → running) e roda execute na sequência. Redirect pra detalhe.

## Saída

Workspace consegue mandar mensagens em massa. n8n atualiza status via webhook.

## Ordem

E7-S1 → E7-S2 → E7-S3 → E7-S4 → E7-S5 → E7-S6.
