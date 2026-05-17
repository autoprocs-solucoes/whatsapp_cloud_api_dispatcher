# Autoprocs Dispatcher

Disparador de mensagens em massa via WhatsApp Cloud API (Meta) — multi-tenant, com gestão de contatos, templates e comunicados.

> Codinome técnico: `whatsapp_cloud_api_dispatcher`. Uso interno autoprocs.

## Stack

- **Next.js 15** (App Router, Server Actions, TypeScript strict)
- **Supabase Cloud** (Auth + Postgres + Storage)
- **Tailwind CSS v4** + **shadcn/ui**
- **Vercel** (deploy)

## Requisitos

- Node.js 20+ (testado em 24)
- npm 10+
- Conta no [Supabase](https://supabase.com), [Vercel](https://vercel.com) e [Meta for Developers](https://developers.facebook.com)

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente
cp .env.example .env.local
# Preencher .env.local (ver checklist em docs/infra-checklist.md)

# 3. Subir o servidor de desenvolvimento
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Servidor dev (hot reload) |
| `npm run build` | Build de produção |
| `npm run start` | Roda o build de produção |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint com autofix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `npm run typecheck` | `tsc --noEmit` |

## Estrutura

```
src/
  app/            # rotas Next (App Router)
  components/     # UI compartilhada (inclui shadcn em components/ui)
  features/       # domínios (contacts, templates, dispatch, ...)
  lib/            # utils, clients (supabase), env
  server/         # server actions, queries
  types/          # tipos compartilhados
docs/
  PRD.md          # requisitos do produto
  epicos/         # épicos detalhados
  infra-checklist.md  # passo a passo de infra externa
```

## Documentação

- [PRD](docs/PRD.md) — visão geral, decisões e modelo de dados
- [Épico E0](docs/epicos/E0-setup.md) — setup do projeto
- [Checklist de infra externa](docs/infra-checklist.md) — Supabase, Vercel, Meta
