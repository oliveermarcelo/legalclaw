# 🚀 DrLex (Dr. + Lex) — Plano Completo de Deploy

## Visão Geral

Refatoração completa do projeto (antigo LegalClaw → DrLex): remoção do OpenClaw, integração direta com Anthropic SDK,
substituição do Twilio pela Evolution API, e deploy via Portainer.

> Repositório: `oliveermarcelo/legalclaw` (mesmo repo, código atualizado)

---

## FASE 1: Preparar Evolution API (15 min)

### 1.1 Coletar informações da Evolution API

No painel da Evolution API, anote:

- **URL base** (ex: `https://evolution.seudominio.com` ou `http://IP:8080`)
- **API Key global** (em Settings ou no `.env` da Evolution)
- **Nome da rede Docker** — rodar no servidor:
  ```bash
  docker network ls
  docker inspect <container_evolution> --format '{{json .NetworkSettings.Networks}}' | jq
  ```

### 1.2 Criar instância "drlex" na Evolution

Via painel ou via cURL:
```bash
curl -X POST "SUA_EVOLUTION_URL/instance/create" \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "drlex",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true,
    "webhook": {
      "url": "http://drlex-api:3000/webhooks/evolution",
      "events": ["messages.upsert", "connection.update"]
    }
  }'
```

### 1.3 Conectar WhatsApp via QR Code

- Acessar no painel: instância "drlex" → QR Code
- Escanear com o WhatsApp do número comercial
- Aguardar status "open"

---

## FASE 2: Obter Credenciais (10 min)

### 2.1 Anthropic API Key
- Acessar: https://console.anthropic.com
- Criar conta ou fazer login
- Ir em "API Keys" → "Create Key"
- Copiar e guardar (começa com `sk-ant-...`)

### 2.2 Telegram Bot Token
- Abrir Telegram → buscar @BotFather
- Enviar `/newbot`
- Nome: "Dr. Lex Bot"
- Username: `drlex_bot` (ou similar disponível)
- Copiar o token

### 2.3 Configurações do PostgreSQL e Redis
- Já configurados no docker-compose (credenciais internas)

---

## FASE 3: Subir Código para o GitHub (10 min)

### 3.1 Clonar/atualizar repositório
```bash
cd /var/data/drlex/app
git pull origin main  # ou substituir os arquivos
```

### 3.2 Copiar novos arquivos
Substituir toda a pasta `src/` e arquivos raiz pelos novos refatorados.

### 3.3 Push para GitHub
```bash
git add .
git commit -m "refactor: remove OpenClaw, add Evolution API, Anthropic SDK direto"
git push origin main
```

---

## FASE 4: Deploy no Portainer (15 min)

### 4.1 Criar arquivo `.env` no servidor
```bash
nano /var/data/drlex/.env
```

Conteúdo (preencher com suas credenciais):
```env
NODE_ENV=production
PORT=3000

# Anthropic
ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui

# PostgreSQL (interno do Docker)
DATABASE_URL=postgresql://drlex:drlex_secret@postgres:5432/drlex

# Redis (interno do Docker)
REDIS_URL=redis://redis:6379

# Evolution API
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=sua-evolution-api-key
EVOLUTION_INSTANCE=drlex

# Telegram
TELEGRAM_BOT_TOKEN=seu-token-aqui

# JWT (gerar: openssl rand -hex 32)
JWT_SECRET=gerar-um-hash-aqui
```

### 4.2 Criar Stack no Portainer

1. Ir em Portainer → Stacks → Add Stack
2. Nome: `drlex`
3. Colar o conteúdo do `portainer-stack.yml`
4. Em "Environment variables", carregar o `.env`
5. Clicar "Deploy the stack"

### 4.3 Verificar rede Docker

A stack precisa estar na mesma rede da Evolution API.
Verificar e ajustar no `portainer-stack.yml` se necessário.

---

## FASE 5: Testes (15 min)

### 5.1 Verificar saúde da API
```bash
curl http://localhost:3000/health
# Deve retornar: {"status":"ok","services":{...}}
```

### 5.2 Testar análise de contrato
```bash
curl -X POST http://localhost:3000/api/contracts/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "CONTRATO DE PRESTAÇÃO DE SERVIÇOS..."}'
```

### 5.3 Testar WhatsApp
- Enviar mensagem para o número conectado
- Deve receber resposta automática

### 5.4 Testar Telegram
- Abrir o bot no Telegram
- Enviar `/start`
- Deve receber mensagem de boas-vindas

---

## FASE 6: Configurar Webhook da Evolution (5 min)

Se não configurou na criação da instância:
```bash
curl -X POST "SUA_EVOLUTION_URL/webhook/set/drlex" \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://drlex-api:3000/webhooks/evolution",
    "webhook_by_events": true,
    "events": ["messages.upsert", "connection.update"]
  }'
```

---

## Checklist Final

- [ ] Evolution API com instância "drlex" criada
- [ ] QR Code escaneado, WhatsApp conectado
- [ ] Anthropic API Key obtida
- [ ] Telegram Bot criado
- [ ] Código refatorado no GitHub
- [ ] Stack criada no Portainer
- [ ] `.env` configurado com todas as credenciais
- [ ] Health check retornando OK
- [ ] Teste de contrato funcionando
- [ ] WhatsApp respondendo mensagens
- [ ] Telegram respondendo mensagens
