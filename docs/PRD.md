# PRD — Autoprocs Dispatcher

> Codinome técnico: `whatsapp_cloud_api_dispatcher`
>
> Disparador de mensagens em massa para a API oficial do WhatsApp (Meta Cloud API), com gestão multi-tenant de contatos, templates e comunicados.

---

## 1. Visão geral

Plataforma web (Next.js + Supabase) usada internamente pela autoprocs para gerenciar disparos de mensagens via WhatsApp Cloud API em nome de múltiplos clientes. Cada cliente é um **workspace** isolado com seus próprios contatos, templates, comunicados e conexão Meta. Cada workspace pode ter múltiplos usuários (owner/member).

**Não escopo** do projeto:
- Recebimento de mensagens (inbound) e atendimento — tratado em app separada via **n8n** (já existente).
- Atualização de status de envio (delivered/read/failed) — também tratada via webhook recebido pelo n8n, que escreve direto no Supabase.
- Cobrança/billing — uso interno autoprocs, sem planos.
- Mídia em templates — V2.

---

## 2. Personas

| Persona | Papel | Necessidades principais |
|--------|-------|-------------------------|
| **Super-admin autoprocs** (Victor) | Cria workspaces, supervisiona uso | Visão cross-workspace, gestão de usuários, troubleshooting |
| **Owner do workspace** (cliente da autoprocs) | Conecta Meta, convida membros, dispara | Onboarding fácil, controle total do workspace |
| **Member do workspace** | Operador no dia-a-dia do cliente | Subir contatos, criar comunicados, ver relatórios |

---

## 3. Decisões consolidadas

| Tema | Decisão |
|------|---------|
| **Escopo MVP** | Médio — login + workspace + Meta Embedded Signup + contatos + segmentação + templates + envio + relatórios agregados. Sem agendamento. Sem inbound. Sem mídia. |
| **Multi-tenancy** | Cliente loga com conta própria. Workspaces isolados via RLS Supabase. Roles: **owner**, **member**. |
| **Integração Meta** | **Embedded Signup** oficial. Requer app Meta aprovada como Tech Provider. Token e WABA persistidos por workspace. |
| **Inbound** | Tratado fora desta app (n8n). |
| **Status webhooks** | Tratados fora desta app (n8n grava no Supabase). App apenas lê o status pra exibir. |
| **Volume** | Pequeno (< 1k/dia por cliente). Envio direto pelo servidor Next.js respeitando rate limit Meta. Sem fila externa. |
| **Contatos** | Schema dinâmico: cliente sobe planilha (.xlsx/.csv), wizard de 3 passos mapeia colunas, salva campos extras em JSON. Telefone é chave única após normalização E.164. |
| **Telefones** | Cliente escolhe no import qual coluna é o telefone principal (planilha pode ter Tel 1/2/3). Demais ficam como campos custom, não usados em envio automático. |
| **Segmentação** | Query builder sobre campos custom + tags + histórico. Suporta segmentos salvos e ad-hoc. |
| **Templates** | Listar do Meta + criar/editar com submissão para aprovação + preview renderizado com dados de um contato real. Só texto no MVP. |
| **Variáveis de template** | Mapeamento por envio: cliente escolhe placeholder → coluna do contato + valor default fallback (mesmo mapeamento aplicado a todos os contatos do disparo). |
| **Número remetente** | Escolha obrigatória a cada disparo (dropdown com phone_numbers do WABA do workspace). |
| **Test send** | Botão "enviar teste" antes do disparo final, envia para 1 número escolhido pelo cliente usando o mesmo template e mapeamento. |
| **Opt-out** | Campo `opt_out` no contato. n8n marca via webhook. App **filtra opt_out=true automaticamente** antes de cada envio. Sem opção de override. |
| **Relatórios** | Contadores agregados por comunicado (total enviados / entregues / lidos / falhados). |
| **Stack** | Next.js 15 (App Router, Server Actions) + Supabase Cloud (Auth + Postgres + Storage) + Vercel + shadcn/ui + Tailwind v4. |
| **Convenções** | TS strict, ESLint flat + Prettier, estrutura feature-first (`/features/<dominio>/`), Postgres snake_case + tipos TS gerados, sem testes automatizados no MVP, sem Sentry no MVP. |
| **Design** | Inspirado em powercomm.com.br — corporativo, azul + branco, minimalista. shadcn customizado com tokens próprios. Defaults azul `#0F62FE` + Inter no MVP. |
| **Cancel/Resend** | Não suportado no MVP. Comunicado iniciado segue até fim. Refazer = novo comunicado manual. |
| **Audit trail import** | Não persiste arquivo `.xlsx` original. Só metadados do import (linhas válidas/inválidas/duplicadas, mapping). |
| **Meta App** | Autoprocs **já tem app aprovada como Tech Provider Solution**. Embedded Signup direto, sem fallback de token manual. |
| **Idioma** | PT-BR only. Datas/números via `date-fns` locale `pt-BR`. |

---

## 4. Funcionalidades — visão alta

### 4.1 Autenticação e workspaces
- Login via Supabase Auth (email/senha + magic link).
- Onboarding: ao criar conta, usuário cria seu primeiro workspace (vira owner).
- Troca de workspace ativo via dropdown no header.
- Convite de membros por email (owner only).
- Roles: owner (tudo), member (sem gestão de usuários, Meta, deletar workspace).
- Super-admin autoprocs: flag `is_superadmin` no perfil, vê tela de listagem cross-workspace.

### 4.2 Configurações do workspace
- Tela "Configurações" com:
  - Dados do workspace (nome, logo).
  - **Conectar Facebook** (Embedded Signup) — após conexão exibe WABA escolhido + lista de phone numbers disponíveis.
  - Gestão de usuários (owner only).
  - Lista de eventos importantes (audit log básico).

### 4.3 Contatos
- **Import**: wizard 3 passos.
  1. Upload (xlsx/csv) com preview das 10 primeiras linhas.
  2. Mapeamento: cliente escolhe qual coluna é o telefone principal. Demais colunas viram campos custom (nome editável). Validação: telefone obrigatório.
  3. Validação: app normaliza E.164 (default BR/+55), detecta duplicados (já cadastrados são pulados, não atualizados), exibe contadores (válidos / inválidos / duplicados) antes de confirmar.
- Lista de contatos com busca, filtros, paginação.
- Edição individual de contato (campos custom incluso).
- Marcação manual de opt-out.

### 4.4 Templates
- Lista de templates do WABA conectado (puxados via Graph API), com status (approved/pending/rejected) e categoria.
- Criação de template: form com header (texto), body (texto + placeholders), buttons (CTA opcional). Submete para aprovação Meta.
- Preview renderizado com um contato real escolhido pelo cliente.

### 4.5 Segmentação
- Tela "Segmentos" com query builder visual.
  - Condições sobre tags, campos custom, histórico de envios.
  - Operadores: `igual`, `diferente`, `contém`, `>`, `<`, `entre`, `está em lista`, `recebeu comunicado X`, `não recebeu comunicado X`.
  - Combinação com AND/OR aninhado.
- Cliente pode salvar segmento com nome ou usar ad-hoc dentro de um comunicado.
- Preview mostra contagem de contatos que casam com a regra (sempre subtraindo opt_outs).

### 4.6 Comunicados (disparo)
- Tela "Novo comunicado":
  1. Escolher template aprovado.
  2. Escolher número remetente (phone_number do WABA).
  3. Mapear placeholders → coluna do contato + valor default fallback.
  4. Escolher destinatários (segmento salvo OU monta ad-hoc OU lista manual).
  5. **Enviar teste** para 1 número específico.
  6. Revisão final (total destinatários após filtro opt-out) → confirma disparo.
- Disparo executa no servidor: respeita rate limit Meta, retry em falhas transientes, salva 1 linha por destinatário em `dispatch_recipient` com `status='queued'`.
- Tela de detalhes do comunicado: contadores agregados (queued/sent/delivered/read/failed) + lista paginada com filtros + export CSV.
- **Não é permitido**: enviar pra contato com `opt_out=true` (filtro silencioso na hora do disparo).

### 4.7 Dashboard
- Visão geral do workspace: total contatos, último comunicado, comunicados em andamento, taxa média de entrega últimos 30 dias.

---

## 5. Stack & arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router, Server Actions, Route Handlers) │
│  • UI: shadcn/ui + Tailwind v4                            │
│  • Auth: @supabase/ssr                                    │
│  • Forms: react-hook-form + zod                           │
│  • Tabelas: tanstack-table                                │
└──────────────┬──────────────────────────┬─────────────────┘
               │                          │
               ▼                          ▼
       ┌──────────────┐         ┌──────────────────┐
       │ Supabase     │         │ Meta Graph API   │
       │ • Auth       │         │ • Embedded Signup│
       │ • Postgres   │         │ • Send Message   │
       │ • Storage    │         │ • Templates CRUD │
       │ • RLS multi- │         └──────────────────┘
       │   tenant     │
       └──────────────┘
               ▲
               │ (webhook status + inbound)
               │
       ┌──────────────┐
       │ n8n externo  │ ← recebe webhook Meta, escreve status no Supabase
       └──────────────┘
```

- **Deploy**: Vercel (Next) + Supabase Cloud.
- **Tokens Meta**: armazenados em Supabase (criptografia at-rest do Postgres + futura migração pra Supabase Vault).
- **RLS**: toda tabela com `workspace_id` filtra por workspace do usuário logado.

---

## 6. Modelo de dados — visão alta

> Detalhamento de cada tabela com colunas, índices e políticas RLS virá nas demandas de cada épico.

- `profile` (user_id, full_name, avatar, is_superadmin, ...)
- `workspace` (id, name, slug, logo_url, owner_id, ...)
- `workspace_member` (workspace_id, user_id, role)
- `workspace_meta_connection` (workspace_id, waba_id, business_id, access_token_enc, ...)
- `workspace_phone_number` (workspace_id, phone_number_id, display_phone, verified_name, quality_rating, ...)
- `contact` (id, workspace_id, phone_e164, full_name, custom_fields jsonb, opt_out, opt_out_at, tags[], created_at, updated_at)
- `contact_import` (id, workspace_id, file_url, mapping jsonb, stats jsonb, created_by, created_at)
- `template` (id, workspace_id, meta_template_id, name, language, category, status, body, header, buttons jsonb, last_synced_at)
- `segment` (id, workspace_id, name, rules jsonb, created_by, ...)
- `dispatch` (id, workspace_id, template_id, phone_number_id, segment_snapshot jsonb, variable_mapping jsonb, status, created_by, started_at, finished_at, ...)
- `dispatch_recipient` (id, dispatch_id, contact_id, phone_e164, payload jsonb, status, meta_message_id, error_code, error_message, sent_at, delivered_at, read_at, failed_at)
- `audit_log` (id, workspace_id, actor_id, action, target_type, target_id, payload, created_at)

---

## 7. Design system

| Token | Valor inicial proposto | Observação |
|-------|------------------------|------------|
| `--color-primary` | azul corporativo (~`#0F62FE`/`#0066CC`) | Refinar com hex real do powercomm |
| `--color-primary-foreground` | `#FFFFFF` | |
| `--color-accent` | azul claro/ciano | |
| `--color-background` | `#FFFFFF` | Off-white em seções secundárias |
| `--color-muted` | cinza muito claro | |
| `--color-foreground` | cinza escuro / `#0A0A0A` | |
| `--font-sans` | Inter (Segoe UI fallback) | |
| `--radius` | `0.5rem` (suave) | |
| Vibe | minimalista, espaçoso, cards limpos | |

> Refinar tokens após inspeção visual ou screenshot do powercomm. Documentar em `docs/design-tokens.md` final.

---

## 8. Compliance e regras Meta

- **LGPD**: opt-out é regra dura. Audit log de quando opt-out foi marcado por contato. Possibilidade de export dos dados do contato e deleção sob demanda (operação manual via super-admin no MVP).
- **Janela 24h**: no MVP só enviamos mensagens via template aprovado, então a regra de janela não bloqueia (templates podem ser enviados a qualquer momento). Importante quando entrar inbound/free-form na V2.
- **Quality rating**: exibir rating do phone_number na tela de configurações (vindo da Graph API) — sinal de saúde da conta.
- **Rate limit**: respeitar tier do phone number (1k/10k/100k/24h). MVP volume baixo, mas envio loop deve dosar.

---

## 9. Épicos (visão alta — detalhamento virá por épico)

| # | Épico | Status | Resumo |
|---|-------|--------|--------|
| **E0** | Setup do projeto | ✅ Concluído | Bootstrap Next 15 + Supabase + shadcn + tooling (lint, format, ci básico) |
| **E1** | Autenticação e workspaces | ✅ Concluído | Login, signup, criação/troca de workspace, convite de membros, roles, super-admin |
| **E2** | Conexão Meta (Embedded Signup) | 🔵 Código pronto, aguardando migration | App Meta, fluxo embedded, persistência de WABA + phone numbers, status de conexão |
| **E3** | Design system + layout base | ✅ Concluído | Tokens, shadcn customizado, layout com sidebar, header, tema, telas vazias |
| **E4** | Contatos — import + CRUD | ⬜ Não iniciado | Wizard 3 passos, normalização E.164, dedup, listagem, edição, opt-out manual |
| **E5** | Templates | ⬜ Não iniciado | Sync da Meta, listagem, criação com submissão, preview com contato real |
| **E6** | Segmentação | ⬜ Não iniciado | Query builder, segmentos salvos, contagem em tempo real |
| **E7** | Comunicados — disparo | ⬜ Não iniciado | Wizard de novo comunicado, mapeamento variáveis, test send, filtro opt-out, execução no servidor |
| **E8** | Relatórios | ⬜ Não iniciado | Detalhe do comunicado com contadores + lista de destinatários + export CSV |
| **E9** | Dashboard | ⬜ Não iniciado | Visão geral do workspace |
| **E10** | Super-admin autoprocs | ⬜ Não iniciado | Listagem cross-workspace, troubleshooting básico |

> Ordem sugerida de execução: **E0 → E3 → E1 → E2 → E4 → E5 → E6 → E7 → E8 → E9 → E10**.
> Justificativa: design system e layout base cedo evita retrabalho visual; E2 (Meta) pode ser iniciada cedo em paralelo enquanto contatos/templates evoluem; E7 depende de quase tudo.

### Legenda de status

| Símbolo | Significado |
|---------|-------------|
| ✅ | Concluído e validado |
| 🔵 | Código pronto, aguardando ação externa (user, infra, migration, etc) |
| 🟡 | Em andamento |
| ⬜ | Não iniciado |

---

## 10. Métricas de sucesso

- Tempo médio do onboarding (criar conta → primeiro disparo) < 30 min.
- Taxa de erro nos disparos < 2%.
- Zero envios para contatos com opt_out=true em audit log.
- Throughput sustentado de 1k disparos/dia por workspace sem falhas de rate limit.

---

## 11. Riscos e questões em aberto

| Risco | Mitigação |
|-------|-----------|
| Hex codes exatos do powercomm não capturados via fetch | Defaults corporativos azul+branco no MVP. Refinar `design-tokens.md` quando user mandar screenshot. |
| Webhook de status no n8n pode atrasar reflexo na app | Confirmar SLA do n8n; considerar polling como backup. |
| Templates rejeitados pela Meta | UI clara mostrando status + motivo de rejeição. |
| Double-send em disparo (cliente clica 2x ou recarrega) | `idempotency_key` no dispatch + lock na confirmação. Detalhar em E7. |
| Conta Meta + Vercel + Supabase + domínio ainda não existem | E0 inclui checklist guiado de criação pelo usuário. Bloqueia deploy mas não desenvolvimento local. |
