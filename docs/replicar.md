# Replicar o Dispatcher do zero

Guia para subir uma **instância nova e independente**: outro banco, outro app da
Meta, outro domínio. Do repositório vazio até a primeira mensagem entregue.

> **Antes de começar, confirme que você precisa disso.** O Dispatcher é
> multi-tenant: atender mais um cliente é criar um workspace no painel Master e
> conectar a WABA dele, sem tocar em infraestrutura. Replique só quando quiser
> uma operação separada de verdade — outra empresa, outro banco, outra conta da
> Meta.

Tempo realista: **2 a 3 horas** se as contas já existirem. O gargalo é a Meta
(verificação de negócio e revisão do app podem levar dias) — comece por ela.

---

## 0. O que você vai precisar

| Conta | Para quê | Custo |
|---|---|---|
| GitHub | hospedar o código | grátis |
| Supabase | banco, auth, storage, cron | grátis até ~500MB |
| Vercel | rodar o app | grátis (Hobby) |
| Meta for Developers | WhatsApp Cloud API | grátis; as **conversas** são cobradas |
| Domínio próprio | webhook e links de convite | ~R$ 40/ano |

Na máquina: **Node 20+**, **npm 10+**, **git** e a CLI da Supabase
(`npm i -g supabase`, ou use `npx supabase`).

---

## 1. Código

```bash
git clone <url-do-repo> dispatcher-novo
cd dispatcher-novo
npm install
cp .env.example .env.local
```

Deixe o `.env.local` aberto: os próximos passos preenchem ele.

---

## 2. Supabase

### 2.1 Criar o projeto

Em **supabase.com → New project**. Guarde a senha do banco. Região mais perto
do público (São Paulo, para Brasil).

De **Project Settings → API**, copie para o `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon>"
SUPABASE_SERVICE_ROLE_KEY="<service_role>"
```

> `service_role` ignora RLS. Ela só existe no servidor — nunca em código que
> vai pro navegador, nunca em variável com prefixo `NEXT_PUBLIC_`.

### 2.2 Aplicar as migrations

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Isso aplica os 29 arquivos de `supabase/migrations` em ordem e cria as tabelas,
as políticas de RLS, os buckets de storage (`avatars`, `flow-media`) e as
funções de fila.

Se `db push` reclamar de permissão nas extensões, habilite **pg_cron** e
**pg_net** em *Database → Extensions* no painel e rode de novo.

Conferência rápida:

```sql
select count(*) from information_schema.tables where table_schema = 'public';
-- deve passar de 15 tabelas
select id, public from storage.buckets;
-- avatars e flow-media, ambos public = true
```

### 2.3 Auth

Em **Authentication → URL Configuration**:

- **Site URL**: `https://<seu-dominio>`
- **Redirect URLs**: adicione `https://<seu-dominio>/auth/callback` e
  `http://localhost:3000/auth/callback`

Sem isso o link de convite por e-mail leva a lugar nenhum.

---

## 3. Meta / WhatsApp Cloud API

Esta é a parte lenta. Comece por ela se puder.

### 3.1 App

1. **developers.facebook.com → Criar app → Empresa**.
2. Adicione o produto **WhatsApp**.
3. Em *Configurações → Básico*, copie **App ID** e **Chave secreta**:

```
META_APP_ID="<app-id>"
META_APP_SECRET="<app-secret>"
META_GRAPH_API_VERSION="v21.0"
```

### 3.2 Embedded Signup

É o fluxo que deixa o cliente conectar a WABA dele sozinho. Em
**WhatsApp → Embedded Signup**, crie **duas** configurações:

| Configuração | Onboarding type | Variável |
|---|---|---|
| Padrão | número novo / migração | `META_EMBEDDED_SIGNUP_CONFIG_ID` |
| Coexistência | *WhatsApp Business app users* | `META_COEXISTENCE_CONFIG_ID` |

A segunda permite conectar um número que já usa o aplicativo WhatsApp Business
no celular, mantendo os dois funcionando.

### 3.3 Webhook

Só depois do deploy (passo 4), porque a URL precisa responder.

- **Callback URL**: `https://<seu-dominio>/api/webhooks/meta`
- **Verify token**: invente uma string aleatória e ponha nas duas pontas:

```
META_VERIFY_TOKEN="<string-aleatoria>"
```

Assine o campo **messages**. É por ele que chegam respostas, status de entrega
e reações.

> Se já existe uma automação recebendo esses webhooks (n8n, por exemplo),
> preencha `META_WEBHOOK_FORWARD_URL` com a URL antiga: o app repassa cada
> evento para lá além de processar, e nada quebra na troca.

### 3.4 Verificação e revisão

Para sair do modo de testes: **verificação do negócio** e **App Review** com as
permissões `whatsapp_business_management` e `whatsapp_business_messaging`.
Enquanto não sair, dá para testar com o número de teste da Meta.

---

## 4. Vercel

1. **Add New → Project** e importe o repositório.
2. Em *Settings → Environment Variables*, cadastre tudo do `.env.local`, com
   `NEXT_PUBLIC_APP_URL` apontando para o domínio final.
3. Deploy.
4. Ligue o domínio em *Settings → Domains*.

Depois do primeiro deploy, volte ao passo 3.3 e configure o webhook.

---

## 5. Worker de transmissão

O envio em massa roda numa Edge Function, não no app: assim o disparo continua
mesmo com a aba fechada.

```bash
npx supabase functions deploy process-dispatch-queue
npx supabase secrets set APP_URL=https://<seu-dominio>
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` a Supabase injeta sozinha.
`APP_URL` **não** — e sem ela duas coisas silenciosamente não acontecem: o aviso
de "transmissão concluída" e o tick que retoma fluxos parados em espera.

Agende o worker: abra `supabase/cron-setup.sql`, troque `<PROJECT_REF>` e
`<SERVICE_ROLE_KEY>`, e rode no **SQL Editor**. Confira:

```sql
select jobname, schedule, active from cron.job;
-- process-dispatch-queue | * * * * * | true
```

Um cron só. O tick dos fluxos pega carona nele, de propósito: um segundo
agendamento exigiria a `service_role` escrita em texto puro dentro de
`cron.job.command`, visível para quem consultasse a tabela.

---

## 6. Notificação push (opcional)

Avisa os owners quando a transmissão termina.

```bash
npx web-push generate-vapid-keys
```

```
VAPID_PUBLIC_KEY="<public>"
VAPID_PRIVATE_KEY="<private>"
VAPID_SUBJECT="mailto:voce@empresa.com"
```

Sem essas variáveis o resto do app funciona normal; só o push fica desligado.

---

## 7. Primeiro acesso

1. Abra `https://<seu-dominio>/signup` e crie sua conta.
2. Promova ela a master, no **SQL Editor**:

```sql
update public.profile p
set is_superadmin = true
from auth.users u
where u.id = p.user_id and u.email = 'voce@empresa.com';
```

3. Recarregue: o menu **Master** aparece.
4. **Master → Adicionar cliente** cria o primeiro workspace.
5. Dentro do cliente, **Configurações → Meta → Conectar** abre o Embedded
   Signup. Ao fim, o número aparece conectado.

---

## 8. Verificar que está tudo de pé

Faça nesta ordem — cada passo depende do anterior.

| # | Ação | Sinal de que funcionou |
|---|---|---|
| 1 | Templates → **Criar modelo** | nasce como `PENDING`, some depois de aprovado |
| 2 | Contatos → **Importar** uma planilha com etiqueta | contatos na lista, com a tag |
| 3 | Fluxos → padrão básico → escolher o modelo → **Publicar** | some o aviso de rascunho |
| 4 | Campanhas → **Criar** apontando para o fluxo | botão **Transmitir** habilita |
| 5 | Transmissão → passo **Teste**, para o seu número | mensagem chega no WhatsApp |
| 6 | Disparar para o segmento | status vira `done`, entregues > 0 |
| 7 | Responder pelo celular | conversa aparece em **Conversas** |

Se o passo 5 falhar, **a mensagem de erro diz o motivo** — ela vem da Meta, com
a explicação completa, e fica também em Conversas e no log da Vercel.

---

## 9. Armadilhas que já custaram tempo

**Cobrança é por conta do WhatsApp, não por portfólio.** O erro `131042`
("no payment method") aparece mesmo com cartão cadastrado se ele estiver em
outra WABA do mesmo negócio. Confira em *Faturamento → Contas do WhatsApp
Business* que a linha da **sua** WABA mostra o cartão.

**A Meta responde "Invalid parameter" para nome de modelo repetido.** A
explicação verdadeira vem em `error_user_msg`. O app já bloqueia o nome
duplicado antes de enviar.

**Analytics de template aceita no máximo 10 ids por chamada.** Acima disso é
`400` com a mensagem `template_ids`. O app já quebra em lotes.

**O nono dígito.** A Meta devolve o número do contato sem o 9 (`+556191255320`)
enquanto você envia com ele (`+5561991255320`). O app canoniza a chave da
conversa; se for integrar outra coisa no mesmo banco, use a mesma regra.

**O servidor roda em UTC.** Toda data exibida passa por
`src/lib/format/datetime.ts`, com fuso fixo. Não use `toLocaleString` solto em
componente de servidor.

**Áudio gravado no navegador.** O Chrome só grava `webm` ou MP4 fragmentado, e
a Cloud API recusa os dois. O app converte para ogg/opus no navegador antes de
subir (`src/lib/audio/webm-to-ogg.ts`).

**Janela de 24 horas.** Fora dela a Meta aceita texto livre e descarta sem
avisar. O app bloqueia e manda usar template — não contorne isso.

---

## 10. Manutenção

| Quando | O quê |
|---|---|
| Nova migration | `npx supabase db push` |
| Mudou o worker | `npx supabase functions deploy process-dispatch-queue` |
| Mudou o app | push na `main`, a Vercel faz o resto |

Migrations são aplicadas por `db push` e o histórico fica em
`supabase_migrations.schema_migrations`. Se alguém aplicar SQL na mão pelo
painel, esse histórico deixa de bater e o `db push` seguinte tenta rodar tudo de
novo — vale manter a disciplina de sempre usar a CLI.
