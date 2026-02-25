# 🚀 LegalClaw - Guia de Início Rápido

## Instalação em 5 Minutos

### Opção 1: Script Automatizado (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/legal-ai-assistant.git
cd legal-ai-assistant

# Execute o instalador
chmod +x install.sh
./install.sh
```

### Opção 2: Manual

```bash
# Instale dependências
npm install

# Configure ambiente
cp .env.example .env
nano .env  # Adicione suas API keys

# Inicie
npm start
```

### Opção 3: Docker

```bash
# Configure .env primeiro
cp .env.example .env
nano .env

# Suba os containers
docker-compose up -d

# Verifique status
docker-compose ps
```

---

## ⚙️ Configuração Essencial

### 1. Obter API Keys

#### Anthropic (Claude)
1. Acesse: https://console.anthropic.com/
2. Crie uma conta
3. Vá em API Keys → Create Key
4. Copie a key que começa com `sk-ant-`

#### Twilio (WhatsApp)
1. Acesse: https://www.twilio.com/
2. Crie conta gratuita ($15 de crédito)
3. Console → Account → Keys & Credentials
4. Copie: Account SID, Auth Token
5. Messaging → Try it out → WhatsApp
6. Anote o número: `+1 415 523 8886`

#### Telegram
1. Abra o Telegram
2. Busque por: `@BotFather`
3. Envie: `/newbot`
4. Siga instruções
5. Copie o token

### 2. Configurar .env

```bash
# Essenciais
ANTHROPIC_API_KEY=sk-ant-sua-key-aqui
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=seu_auth_token
TELEGRAM_BOT_TOKEN=123456:ABCdefGHI

# Opcional (para produção)
DATABASE_URL=postgresql://user:pass@localhost:5432/legalclaw
REDIS_URL=redis://localhost:6379
```

---

## 📱 Configurar WhatsApp

### Webhook do Twilio

1. **Túnel local (desenvolvimento)**:
```bash
# Instale ngrok
npm install -g ngrok

# Crie túnel
ngrok http 3000

# Copie URL: https://xxxx.ngrok.io
```

2. **Configure no Twilio**:
   - Console → Messaging → Settings → WhatsApp sandbox
   - "When a message comes in": `https://xxxx.ngrok.io/webhook/whatsapp`
   - Método: POST
   - Save

3. **Teste**:
   - Envie mensagem para: `+1 415 523 8886`
   - Código: `join [seu-código]`
   - Envie: "Olá"

---

## 🤖 Configurar Telegram

### Iniciar Bot

```bash
# Já configurado no .env? Apenas inicie
npm start

# Ou via Docker
docker-compose restart legalclaw
```

### Testar

1. Busque seu bot no Telegram: `@seu_bot_username`
2. Envie: `/start`
3. Deve receber boas-vindas

---

## 🎯 Primeiros Testes

### 1. Análise de Contrato

**Via WhatsApp/Telegram**:
1. Envie um PDF de contrato
2. Aguarde 30-60 segundos
3. Receba análise completa

**Via API**:
```bash
curl -X POST http://localhost:3000/api/contracts/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/path/to/contract.pdf",
    "metadata": {
      "clientName": "Cliente ABC",
      "processNumber": "1234567-89.2024"
    }
  }'
```

### 2. Monitor de Diários

**Verificação manual**:
```bash
curl http://localhost:3000/api/diarios/check
```

**Automático**:
```javascript
// Já configurado para rodar às 8h todo dia
// Edite em .env:
DOU_CHECK_INTERVAL=0 8 * * *
```

**Configurar alertas**:
```bash
# No .env
DOU_KEYWORDS=sua empresa,cnpj,processo
```

### 3. Gestão de Prazos

**Adicionar prazo**:
```bash
curl -X POST http://localhost:3000/api/deadlines \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Recurso de Apelação",
    "processNumber": "1234567-89.2024",
    "startDate": "2026-02-09",
    "days": 15,
    "type": "processuais",
    "responsible": "Dr. João Silva",
    "whatsappNumber": "+5511999999999"
  }'
```

**Listar prazos**:
```bash
curl http://localhost:3000/api/deadlines?days=30
```

---

## 💬 Comandos do Chat

### WhatsApp/Telegram

**Básicos**:
- `menu` - Ver menu principal
- `ajuda` - Lista de comandos
- `status` - Seu status
- `prazos` - Listar prazos

**Ações**:
- Enviar PDF → Análise automática
- `monitorar [palavra]` → Adicionar ao monitor
- `novo prazo [descrição]` → Criar prazo
- `pesquisar [tema]` → Buscar jurisprudência

**Exemplos**:
```
Você: menu
Bot: [mostra opções]

Você: pesquisar dano moral
Bot: [busca e retorna resultados]

Você: novo prazo Contestação processo 123 15 dias
Bot: [cria prazo e confirma]
```

---

## 🐛 Troubleshooting

### Bot não responde

**Verificar**:
```bash
# Status dos serviços
docker-compose ps

# Logs
docker-compose logs -f legalclaw

# Health check
curl http://localhost:3000/health
```

**Soluções comuns**:
```bash
# Reiniciar tudo
docker-compose restart

# Rebuild se mudou código
docker-compose up -d --build

# Verificar .env
cat .env | grep API_KEY
```

### Erro de API Key

```bash
# Testar Anthropic
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "test"}]
  }'
```

### WhatsApp não recebe

1. Verificar webhook no Twilio
2. Testar com ngrok rodando
3. Verificar logs: `docker-compose logs whatsapp`

---

## 📊 Monitoramento

### Health Check

```bash
# API
curl http://localhost:3000/health

# Resposta esperada:
{
  "status": "ok",
  "timestamp": "2026-02-09T...",
  "services": {
    "whatsapp": true,
    "telegram": true,
    "diarioMonitor": true
  }
}
```

### Logs

```bash
# Ver logs em tempo real
tail -f logs/combined.log

# Apenas erros
tail -f logs/error.log

# Com Docker
docker-compose logs -f --tail=100
```

### Métricas

```bash
# Instalar Datadog (opcional)
# Adicione em .env:
DATADOG_API_KEY=sua_key

# Restart
docker-compose restart
```

---

## 🚀 Deploy em Produção

### AWS (Recomendado)

```bash
# 1. Provisionar EC2
# - Ubuntu 22.04
# - t3.medium (2 vCPU, 4GB RAM)
# - Security Group: portas 22, 80, 443, 3000

# 2. Conectar e instalar
ssh ubuntu@seu-ip
git clone https://github.com/seu-usuario/legal-ai-assistant.git
cd legal-ai-assistant
./install.sh

# 3. Configurar domínio
# - Aponte DNS para IP da EC2
# - Configure SSL com Certbot

sudo certbot --nginx -d legalclaw.com.br
```

### Heroku (Mais fácil)

```bash
# 1. Instalar Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# 2. Login
heroku login

# 3. Criar app
heroku create legalclaw-prod

# 4. Configurar env vars
heroku config:set ANTHROPIC_API_KEY=sk-ant-xxx
heroku config:set TWILIO_ACCOUNT_SID=ACxxx
# ... todas as outras

# 5. Deploy
git push heroku main

# 6. Verificar
heroku logs --tail
heroku open
```

---

## 📚 Próximos Passos

### Personalizar

1. **Adicionar skills customizadas**:
```bash
cd core/skills
# Crie nova skill baseada nos exemplos
```

2. **Customizar mensagens**:
```bash
# Edite templates em:
core/integrations/whatsapp.js
core/integrations/telegram.js
```

3. **Adicionar integrações**:
```bash
# Veja documentação em:
docs/INTEGRATIONS.md
```

### Escalar

1. **Banco de dados**: Migrar para PostgreSQL
2. **Cache**: Adicionar Redis
3. **Queue**: Implementar Bull para jobs
4. **Monitoring**: Sentry + Datadog
5. **Backup**: Script automático

### Aprender Mais

- 📖 [Documentação completa](./docs/)
- 💼 [Plano de negócios](./docs/BUSINESS_PLAN.md)
- 🔧 [Guia de desenvolvimento](./docs/DEVELOPMENT.md)
- 🐛 [Issues no GitHub](https://github.com/seu-usuario/legal-ai-assistant/issues)

---

## 💡 Dicas Importantes

### Segurança
- ✅ Nunca commite .env no Git
- ✅ Use secrets para produção
- ✅ Habilite 2FA em todas as contas
- ✅ Rotacione API keys mensalmente

### Performance
- ✅ Use Redis para cache
- ✅ Implemente rate limiting
- ✅ Monitore uso de API
- ✅ Otimize prompts (menos tokens = menos custo)

### Custos
- Claude API: ~$0.003/1k tokens
- 1 análise de contrato: ~$0.15
- 100 análises/mês: ~$15
- Margem de 80%+ com pricing de R$ 197

### Suporte
- 📧 Email: suporte@legalclaw.com.br
- 💬 Telegram: @legalclaw_suporte
- 📞 WhatsApp: +55 11 9xxxx-xxxx

---

**Pronto! Seu assistente jurídico com IA está funcionando!** 🎉

Não hesite em experimentar, quebrar coisas e aprender. 
É assim que se constrói o futuro do Direito! ⚖️🤖
