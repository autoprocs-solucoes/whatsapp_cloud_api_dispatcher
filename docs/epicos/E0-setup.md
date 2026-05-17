# Épico E0 — Setup do projeto

> Objetivo: deixar o repositório pronto pra desenvolvimento, com toda fundação técnica configurada (build, lint, types, Tailwind v4, shadcn, Supabase client, estrutura de pastas, CI). Nenhuma feature de produto entra aqui.

## Critérios de aceite globais

- [ ] `npm run dev` sobe app local em `http://localhost:3000` com tela inicial estilizada.
- [ ] `npm run lint` passa sem warnings.
- [ ] `npm run typecheck` passa sem erros.
- [ ] `npm run build` gera build de produção sem erros.
- [ ] CI no GitHub Actions roda lint + typecheck + build em PRs.
- [ ] README explica como subir local + lista variáveis de ambiente.
- [ ] `.env.example` cobre todas as vars necessárias (Supabase + Meta).

---

## Stories

### E0-S1 — Bootstrap Next 15 App Router + TS strict

**Descrição**: Inicializar projeto Next.js 15 com App Router, TypeScript strict, módulos atualizados.

**Tarefas**:
- `package.json` com Next 15, React 19, TypeScript 5.6+.
- `tsconfig.json` com `strict: true`, `noUncheckedIndexedAccess`, path alias `@/*`.
- `next.config.ts` mínimo (typed).
- `app/layout.tsx`, `app/page.tsx` placeholder.
- `.gitignore` cobrindo node_modules, .next, .env*, .vscode.

**Aceite**: `npm run dev` sobe; abrir `localhost:3000` renderiza placeholder com nome do produto.

---

### E0-S2 — Tailwind v4 + shadcn/ui

**Descrição**: Configurar Tailwind 4 (via `@tailwindcss/postcss`) + inicializar shadcn/ui com tema custom.

**Tarefas**:
- `postcss.config.mjs` com `@tailwindcss/postcss`.
- `app/globals.css` com `@import "tailwindcss"` + CSS vars de tema (light + dark).
- Tokens base no `:root` (cores corporativas defaults: primary `#0F62FE`, etc) e em `.dark`.
- Fonte Inter via `next/font/google`.
- `components.json` (shadcn) configurado.
- Componentes base instalados: `button`, `input`, `label`, `card`, `dialog`, `dropdown-menu`, `sonner` (toast).
- `lib/utils.ts` com `cn()` helper.

**Aceite**: Botão shadcn renderiza na home com cor primária corporativa.

---

### E0-S3 — Supabase client (SSR)

**Descrição**: Plumbing Supabase com `@supabase/ssr`, sem features de auth ainda.

**Tarefas**:
- Deps: `@supabase/supabase-js`, `@supabase/ssr`.
- `lib/supabase/server.ts` — cliente server-side (cookies).
- `lib/supabase/client.ts` — cliente browser.
- `middleware.ts` — handler base (refresh sessão), sem proteção de rotas ainda.
- Tipos placeholder `lib/supabase/database.types.ts` (gerados em E1 quando schema existir).

**Aceite**: Importar `createClient()` de qualquer lugar não dá erro de tipo; middleware roda sem quebrar.

---

### E0-S4 — Estrutura feature-first + app shell mínimo

**Descrição**: Definir layout de pastas e shell visual mínimo (sem auth, sem dados).

**Tarefas**:
- Estrutura:
  ```
  src/
    app/                # rotas Next
    components/         # UI compartilhada (incl. shadcn)
    features/           # domínios (a ser populado)
    lib/                # utils + clients
    server/             # server actions, queries
    types/              # tipos compartilhados
  ```
- `app/page.tsx` com layout "Autoprocs Dispatcher" placeholder centrado, logo placeholder, botão "Entrar" desabilitado.
- Path alias `@/*` resolvendo para `src/*`.

**Aceite**: Estrutura criada, home renderiza shell visual minimalista alinhado à identidade.

---

### E0-S5 — ESLint flat + Prettier + EditorConfig

**Descrição**: Padrões de código automáticos.

**Tarefas**:
- `eslint.config.mjs` flat config com `eslint-config-next`, `@typescript-eslint`, regras razoáveis (no-console exceto warn/error, import order, etc).
- `.prettierrc` (single-quote, no semi… opinião: usar **double-quote + semi + 100 cols** pra compatibilidade).
- `.prettierignore`.
- `.editorconfig` (LF, 2 espaços, UTF-8).
- Scripts npm: `lint`, `lint:fix`, `format`, `typecheck`.

**Aceite**: `npm run lint` e `npm run typecheck` ambos passam.

---

### E0-S6 — .env.example + README setup

**Descrição**: Documentação mínima para subir o projeto em outra máquina.

**Tarefas**:
- `.env.example` com:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `META_APP_ID`
  - `META_APP_SECRET`
  - `META_EMBEDDED_SIGNUP_CONFIG_ID`
  - `META_GRAPH_API_VERSION` (default `v21.0`)
  - `META_VERIFY_TOKEN` (caso webhook futuro)
  - `NEXT_PUBLIC_APP_URL`
- `README.md` com: requisitos (Node 20+, npm), passos para subir local, descrição rápida do produto, link pro PRD, link pro checklist de infra.

**Aceite**: Dev novo consegue clonar + `cp .env.example .env.local` + `npm install` + `npm run dev` em < 5 min.

---

### E0-S7 — CI GitHub Actions

**Descrição**: Pipeline básico de validação em PRs.

**Tarefas**:
- `.github/workflows/ci.yml`:
  - Trigger: PR + push em main.
  - Jobs: install (cache npm), lint, typecheck, build.
  - Node 20 LTS.

**Aceite**: Job passa em PR de exemplo.

---

### E0-S8 — Checklist guiado de infra externa

**Descrição**: Doc passo a passo pro Victor criar contas/projetos externos.

**Tarefas**:
- `docs/infra-checklist.md` cobrindo:
  - Criar repo GitHub.
  - Criar projeto Supabase Cloud (anotar URL, anon key, service role).
  - Criar projeto Vercel + conectar repo + adicionar env vars.
  - Configurar app Meta existente: anotar App ID, App Secret, criar Config de Embedded Signup, anotar Config ID.
  - Opcional: dominio + DNS.
- Marcar quais passos bloqueiam quais épicos.

**Aceite**: Victor consegue seguir o checklist e me retornar credenciais pra colocar no `.env.local`.

---

## Ordem de execução sugerida

1. E0-S1 (bootstrap)
2. E0-S2 (tailwind + shadcn)
3. E0-S3 (supabase)
4. E0-S4 (estrutura + shell)
5. E0-S5 (lint + format)
6. E0-S6 (env + readme)
7. E0-S7 (CI)
8. E0-S8 (checklist infra, paralelizável)

## Saída do épico

Repositório pronto para desenvolvimento de features. Não dispara nem autentica nada ainda.
