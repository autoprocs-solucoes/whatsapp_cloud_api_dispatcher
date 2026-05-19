# Guia — Conexão manual Meta (WABA ID + Access Token)

> Documento para passar ao cliente. Ele cria System User no Business Manager dele, gera token, e envia pra Autoprocs.

## O que vamos coletar

| Item | Onde fica |
|------|-----------|
| **WABA ID** | WhatsApp Manager → Settings da conta |
| **Access Token** | Business Settings → System Users → Generate Token |

São os dois únicos valores que o cliente passa pra Autoprocs.

---

## Passo a passo (cliente)

### 1. Achar o WABA ID

1. Acessar https://business.facebook.com/wa/manage
2. Selecionar a WhatsApp Business Account.
3. Topo da página: aparece **"ID: 1234567890123456"** ou em **Settings → Account Info**.
4. Copiar esse número.

> Alternativa: https://business.facebook.com/settings/whatsapp-business-accounts → clica na conta → ID aparece no painel direito.

---

### 2. Criar System User

> System User é uma "conta robô" da empresa. O token dele não expira.

1. Acessar https://business.facebook.com/settings/system-users
2. Botão **"Add"** → tipo **"Admin"** → nome livre, ex: `autoprocs-dispatcher`
3. Confirma.

---

### 3. Atribuir o WABA ao System User

1. Ainda na tela do System User criado, clica **"Add Assets"**.
2. Tipo: **"WhatsApp Accounts"**.
3. Seleciona a conta WhatsApp Business.
4. Permissões: marca **"Manage WhatsApp Business Account"** (full control).
5. Confirma.

---

### 4. Gerar Access Token

1. Na tela do System User, clica **"Generate New Token"**.
2. Seleciona o app: **"Autoprocs"** (App ID `1761564134486778`).
3. Marca permissões:
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`
4. Clica **"Generate Token"**.
5. **Copia o token (começa com `EAA...`)** — só aparece uma vez!

> Token tem ~200+ caracteres. Salva em local seguro antes de fechar.

---

### 5. Enviar pra Autoprocs

Cliente envia em mensagem segura (não publica em chat aberto):

```
WABA ID:       1234567890123456
Access Token:  EAAxxxxx...    (200+ caracteres)
```

---

## O que a Autoprocs faz

1. Cria workspace pro cliente em `https://dispatcher.autoprocs.com.br` (ou ngrok em dev).
2. Vai em **Configurações → aba Meta**.
3. Cola **WABA ID** e **Access Token** no form.
4. Clica **Conectar**.
5. App valida → mostra business_name + phone numbers → pronto pra disparar.

---

## Troubleshooting

| Erro retornado pela app | Causa provável |
|-------------------------|----------------|
| "Token inválido ou sem permissões" | Token expirou (raro com System User) ou faltam permissions WhatsApp |
| "WABA ID não encontrado" | ID errado, ou WABA não foi atribuído ao System User |
| "Falha ao salvar conexão" | Erro de banco — verificar logs no servidor |
| "Falha ao salvar phone numbers" | Mesmo de cima — checar Supabase |

Em caso de erro persistente, regenerar o token e tentar novamente.
