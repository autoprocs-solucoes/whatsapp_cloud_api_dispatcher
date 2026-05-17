# Checklist de Infraestrutura Externa

> Passo a passo guiado para Victor configurar tudo que vive fora do código: contas, projetos e credenciais. Cada bloco anota qual variável do `.env.local` ele alimenta e qual épico bloqueia.

---

## 1. Repositório GitHub

**Bloqueia**: deploy via Vercel + CI.

- [x] Criar repositório privado no GitHub: `autoprocs/whatsapp_cloud_api_dispatcher` (ou nome de sua preferência).
- [x] Adicionar SSH key ou login HTTPS local.
- [x] No projeto local:
  ```bash
  git init
  git add .
  git commit -m "chore: bootstrap project (E0)"
  git branch -M main
  git remote add origin git@github.com:autoprocs/whatsapp_cloud_api_dispatcher.git
  git push -u origin main
  ```

---

## 2. Projeto Supabase Cloud

**Bloqueia**: E1 (auth), E2+ (qualquer dado persistido).

- [x] Criar conta em [supabase.com](https://supabase.com).
- [x] Criar projeto:
  - **Nome**: `autoprocs-dispatcher`
  - **Região**: `sa-east-1` (São Paulo) — menor latência BR.
  - **Senha do Postgres**: anotar em local seguro (1Password/Bitwarden).
- [x] Em **Settings > API** copiar:
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (cuidado, nunca commitar)
- [x] Configurar **Auth > URL Configuration**:
  - Site URL: `https://<futuro-dominio>` (ou `http://localhost:3000` enquanto não tem)
  - Redirect URLs: adicionar `http://localhost:3000/**` para dev.

---

## 3. App Meta (WhatsApp Cloud API)

**Bloqueia**: E2 (conexão Meta) e tudo que depende de disparo.

> Autoprocs já tem app aprovada como Tech Provider Solution. Confirmar credenciais existentes.

- [x] Acessar [developers.facebook.com/apps](https://developers.facebook.com/apps/) e abrir o app da autoprocs.
- [x] Em **Configurações > Básico**, copiar:
  - `App ID` → `META_APP_ID`
  - `Chave Secreta do App` → `META_APP_SECRET`
- [ ] Em **WhatsApp > Embedded Signup**:
  - Confirmar que existe uma **Configuração** (Configuration) ativa.
  - Copiar o `Configuration ID` → `META_EMBEDDED_SIGNUP_CONFIG_ID`.
  - Verificar permissões habilitadas: `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`.
- [ ] Definir um `META_VERIFY_TOKEN` (string aleatória gerada por você, ex: `openssl rand -hex 32`). Vamos usar quando configurar webhooks futuramente.

---

## 4. Projeto Vercel

**Bloqueia**: deploy de staging/produção. Não bloqueia desenvolvimento local.

- [ ] Criar conta em [vercel.com](https://vercel.com) (Hobby ou Pro).
- [ ] **New Project** → importar o repo GitHub.
- [ ] Framework preset: detecta automaticamente Next.js.
- [ ] Em **Settings > Environment Variables**, adicionar todas as variáveis do `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL` (Production + Preview + Development)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production + Preview + Development)
  - `SUPABASE_SERVICE_ROLE_KEY` (Production + Preview)
  - `META_APP_ID`, `META_APP_SECRET`, `META_EMBEDDED_SIGNUP_CONFIG_ID`, `META_GRAPH_API_VERSION`, `META_VERIFY_TOKEN`
  - `NEXT_PUBLIC_APP_URL` (a URL pública)
- [ ] Deploy automático em push para `main`.

---

## 5. Domínio (opcional, pode ficar pra depois)

- [ ] Definir domínio (ex: `dispatcher.autoprocs.com.br`).
- [ ] Em Vercel > Domains: adicionar e seguir instruções de DNS.
- [ ] Atualizar `NEXT_PUBLIC_APP_URL`.
- [ ] Atualizar Site URL no Supabase Auth.
- [ ] Atualizar redirect URLs do app Meta (Embedded Signup) com o domínio final.

---

## Resumo do `.env.local`

Depois de tudo configurado, o `.env.local` final terá:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service-role>

META_APP_ID=<app-id>
META_APP_SECRET=<app-secret>
META_EMBEDDED_SIGNUP_CONFIG_ID=<config-id>
META_GRAPH_API_VERSION=v21.0
META_VERIFY_TOKEN=<token-aleatorio>

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Sinais de "pronto pra próximo épico"

- [x] `npm run dev` sobe em local sem erro de env var faltando.
- [x] Supabase abre dashboard com projeto ativo.
- [ ] App Meta exibe Embedded Signup Configuration com Config ID copiável.
- [ ] (Opcional) Push pra `main` dispara build na Vercel com sucesso.
