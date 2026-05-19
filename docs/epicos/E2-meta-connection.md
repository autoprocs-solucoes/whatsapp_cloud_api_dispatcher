# Épico E2 — Conexão Meta

> Status: **🟡 Conexão manual implementada (MVP). Embedded Signup ficou em código mas oculto, reativado quando App Review aprovar Advanced Access em `whatsapp_business_management`.**

> Objetivo: workspace tem WABA + phone numbers conectados pra disparar mensagens. Pré-requisito de templates (E5) e disparos (E7).

## Decisão MVP — conexão manual

Embedded Signup oficial da Meta exige App Review aprovado em `whatsapp_business_management` para clientes externos. Como autoprocs ainda não tem essa aprovação (só Standard Access), o MVP adota fluxo **manual**:

1. Cliente cria System User no Business Manager dele, gera token com permissões WhatsApp.
2. Cliente passa **WABA ID + Access Token** pra autoprocs.
3. Autoprocs admin cola esses dois valores na tela do workspace.
4. App valida o token via Graph API, lista phone numbers, persiste tudo.

Vantagens:
- Sem App Review.
- Sem dependência de ngrok/HTTPS pro popup Meta.
- Token de System User não expira (long-lived).

Trade-off: cliente precisa configurar System User no Business Manager dele (passo único, ~5 min com guia).

> Embedded Signup pode reativado depois quando Advanced Access for aprovado, sem alterar schema (mesmas tabelas).

## Critérios de aceite

- [x] Migration `0002_meta_connection.sql` escrita (aplicação pendente no Dashboard).
- [x] `/configuracoes` aba "Meta" mostra botão **Conectar Facebook** quando sem conexão.
- [x] Embedded Signup abre popup oficial Meta (FB JS SDK + `config_id`).
- [x] Após conclusão do signup, server action exchange `code` → `access_token` (Graph API).
- [x] Persistir: WABA ID, business ID, access token (texto no MVP), phone numbers (id, display_phone_number, verified_name, quality_rating, code_verification_status).
- [x] Re-fazer signup atualiza dados existentes (UPSERT por workspace_id).
- [x] Aba Meta mostra status conectado com nome do business + lista de phone numbers + botão **Desconectar**.
- [x] Apenas owner pode conectar/desconectar.
- [x] App tenta subscrever (`POST /{waba_id}/subscribed_apps`) após conexão; falha não bloqueia.
- [x] `npm run lint`, `npm run typecheck`, `npm run build` passam.
- [ ] Validação ponta-a-ponta no browser após user aplicar migration.

## Modelo de dados

```
workspace_meta_connection
  workspace_id     uuid pk -> workspace.id (ON DELETE CASCADE)
  waba_id          text (WhatsApp Business Account ID)
  business_id      text (Meta Business Manager ID)
  business_name    text (cache pra UI)
  access_token     text (long-lived system user token; criptografar at-rest depois)
  connected_at     timestamptz
  connected_by     uuid -> profile.user_id
  updated_at       timestamptz

workspace_phone_number
  id (pk)                          uuid default gen_random_uuid()
  workspace_id                     uuid -> workspace.id (ON DELETE CASCADE)
  phone_number_id                  text (Meta phone_number_id)
  display_phone_number             text (formatted: +55 11 9...)
  verified_name                    text
  quality_rating                   text (GREEN | YELLOW | RED | UNKNOWN)
  code_verification_status         text (VERIFIED | NOT_VERIFIED)
  is_registered                    boolean (Cloud API registration status)
  last_synced_at                   timestamptz
  unique(workspace_id, phone_number_id)
```

> **Token**: armazenado em texto no MVP. Mover pra `supabase_vault` ou criptografar com pgcrypto em ticket posterior. Service role nunca exposto ao cliente.

## Stories

### E2-S1 — Migration 0002

Cria as tabelas + RLS (select se membro, mutate só owner) + índices.

### E2-S2 — Helper Graph API

`src/lib/meta/graph-api.ts`:
- `exchangeCodeForToken(code: string): Promise<{ access_token: string }>` — POST `https://graph.facebook.com/{version}/oauth/access_token` (server-only).
- `getDebugToken(token: string)` — info do token (business + waba scopes).
- `listSharedWabas(token: string)` — GET `/me/businesses?fields=id,name` + shared waba accounts.
- `listPhoneNumbers(wabaId: string, token: string)` — GET `/{waba_id}/phone_numbers`.
- `subscribeAppToWaba(wabaId: string, token: string)` — POST `/{waba_id}/subscribed_apps`.

Todas usam `META_GRAPH_API_VERSION` e tratam erros do Graph como mensagens claras.

### E2-S3 — Embedded Signup launcher

`src/features/meta/embedded-signup-button.tsx` (client):
- Inicializa FB SDK com `META_APP_ID` + `cookie: true`.
- Listener `window.addEventListener("message", ...)` pra capturar `session_info_response` (waba_id, phone_number_id, código de exchange).
- Botão **Conectar Facebook** chama `FB.login(...)` com `config_id`, `response_type: 'code'`, `override_default_response_type: true`.
- Em sucesso, chama server action `completeMetaSignupAction(code, sessionInfo)`.

### E2-S4 — Server actions

`src/features/meta/actions.ts`:
- `completeMetaSignupAction(code, sessionInfo)` — exchange + listShared/Phone + persist + subscribe.
- `disconnectMetaAction(workspaceId)` — apaga linha de meta_connection + phone_numbers (CASCADE pelo workspace_id, ou explícito).
- Auth: só owner.

### E2-S5 — UI da aba Meta

`/configuracoes` aba **Meta**:
- Sem conexão: card grande com botão **Conectar Facebook**.
- Conectado: card mostra `business_name`, `waba_id`, lista de phone numbers (display, verified name, quality rating em badge colorido), data de conexão, botão **Desconectar** (com AlertDialog de confirmação).

### E2-S6 — Webhook subscription

Server action chama `subscribeAppToWaba` automaticamente após conexão. Usuário não precisa configurar webhook URL manualmente (assumimos que o app Meta já está configurado pro n8n receber tudo).

> Verify token + URL do webhook ficam configurados no painel Meta direto (não na nossa app).

## Saída

Cada workspace tem 1 WABA + N phone numbers conectados. Pronto pra E4 (contatos) e E7 (disparos usarem phone_number_id real).

## Ordem de execução

E2-S1 → E2-S2 → E2-S3 → E2-S4 → E2-S5 → E2-S6.
