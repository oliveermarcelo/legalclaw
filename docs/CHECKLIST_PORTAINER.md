# ✅ Checklist de Deploy - LegalClaw no Portainer

## 📋 Pré-Deploy (No seu servidor)

### Preparação do Ambiente
- [ ] Docker instalado
- [ ] Portainer instalado e rodando (porta 9443)
- [ ] Firewall configurado (portas 80, 443, 3000, 9443)
- [ ] Acesso SSH ao servidor

### Executar Script de Preparação
```bash
# 1. Fazer upload dos arquivos
scp legal-ai-assistant.tar.gz prepare-server.sh usuario@servidor:/tmp/

# 2. Conectar ao servidor
ssh usuario@servidor

# 3. Executar preparação
cd /tmp
chmod +x prepare-server.sh
sudo ./prepare-server.sh
```

**Resultado esperado**: Diretório `/var/data/legalclaw/` criado com código

---

## 🔑 Obter Credenciais

### Anthropic (Claude)
- [ ] Acesse: https://console.anthropic.com/
- [ ] Login/Criar conta
- [ ] Settings → API Keys → Create Key
- [ ] Copie: `sk-ant-api03-XXXXXXXX...`
- [ ] **IMPORTANTE**: Adicione $5-10 de crédito

### Twilio (WhatsApp)
- [ ] Acesse: https://www.twilio.com/
- [ ] Criar conta (trial tem $15 grátis)
- [ ] Console → Account Info
- [ ] Copie: Account SID (`ACXXXXXXXX...`)
- [ ] Copie: Auth Token (`XXXXXXXX...`)
- [ ] Messaging → Try WhatsApp → Número sandbox: `+1 415 523 8886`

### Telegram
- [ ] Abra o Telegram
- [ ] Busque: `@BotFather`
- [ ] Envie: `/newbot`
- [ ] Escolha nome: `LegalClaw Bot`
- [ ] Escolha username: `legalclaw_bot` (ou similar)
- [ ] Copie o token: `123456789:ABCdefGHI...`

---

## 🐳 Deploy no Portainer

### Acessar Portainer
- [ ] Abra: `https://seu-servidor:9443`
- [ ] Login com admin

### Criar Stack
- [ ] Menu lateral → **Stacks**
- [ ] Botão **+ Add stack**
- [ ] Nome: `legalclaw-production`
- [ ] **Web editor** (aba ativa)

### Adicionar Configuração
- [ ] Cole o conteúdo de `portainer-stack.yml`
- [ ] OU faça upload do arquivo
- [ ] Verifique se não tem erros de sintaxe

### Configurar Variáveis de Ambiente

#### Método 1: Advanced Mode (Recomendado)
- [ ] Scroll até **Environment variables**
- [ ] Clique em **Advanced mode**
- [ ] Cole o conteúdo de `portainer.env`
- [ ] Edite os valores:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-XXXXX... ← Cole sua key
TWILIO_ACCOUNT_SID=ACXXXXX...          ← Cole seu SID
TWILIO_AUTH_TOKEN=XXXXX...             ← Cole seu token
TELEGRAM_BOT_TOKEN=123456:ABCXXX...    ← Cole seu token
DB_PASSWORD=SuaSenhaSegura123!         ← Troque esta senha!
```

#### Método 2: Simple Mode
- [ ] Adicione uma por uma manualmente

### Deploy
- [ ] Revise todas as configurações
- [ ] Clique em **Deploy the stack**
- [ ] Aguarde 1-2 minutos

---

## ✅ Verificação Pós-Deploy

### Verificar Containers
- [ ] Menu → **Containers**
- [ ] Veja 3-4 containers:
  - `legalclaw-app` - 🟢 Running
  - `legalclaw-postgres` - 🟢 Running
  - `legalclaw-redis` - 🟢 Running
  - `legalclaw-nginx` - 🟢 Running (se habilitado)

### Health Check
- [ ] Abra navegador
- [ ] Acesse: `http://SEU-SERVIDOR-IP:3000/health`
- [ ] Deve retornar:
```json
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

### Verificar Logs
- [ ] Portainer → Containers → legalclaw-app
- [ ] Clique em **Logs**
- [ ] Procure por:
```
🚀 Inicializando LegalClaw...
✅ WhatsApp configurado
✅ Telegram configurado
✅ Monitor de Diários configurado
🌐 API rodando na porta 3000
```
- [ ] **NÃO deve ter erros em vermelho**

---

## 📱 Testar Integrações

### WhatsApp (Twilio)

#### Configurar Webhook
- [ ] Twilio Console → Messaging → Settings
- [ ] WhatsApp sandbox settings
- [ ] **When a message comes in**: `http://SEU-IP:3000/webhook/whatsapp`
- [ ] HTTP Method: **POST**
- [ ] Save

#### Testar
- [ ] WhatsApp → Adicione: `+1 415 523 8886`
- [ ] Envie: `join [código-do-sandbox]`
- [ ] Envie: `menu`
- [ ] Deve receber resposta do bot

### Telegram

#### Testar
- [ ] Telegram → Busque: `@seu_bot_username`
- [ ] Envie: `/start`
- [ ] Deve receber mensagem de boas-vindas
- [ ] Envie: `/menu`
- [ ] Deve receber menu com opções

---

## 🔧 Configurações Opcionais

### SSL/HTTPS (Recomendado para produção)
- [ ] Comprar/configurar domínio
- [ ] Apontar DNS para IP do servidor
- [ ] Instalar Certbot: `sudo apt install certbot`
- [ ] Obter certificado: `sudo certbot certonly --standalone -d seu-dominio.com`
- [ ] Copiar certificados para Nginx
- [ ] Habilitar serviço `nginx` no Portainer stack
- [ ] Atualizar webhook Twilio para HTTPS

### Backup Automático
- [ ] Criar script de backup (fornecido em PORTAINER_DEPLOY.md)
- [ ] Configurar cron job diário
- [ ] Testar backup manualmente
- [ ] Verificar restauração

### Monitoramento
- [ ] Configurar Sentry (erros): https://sentry.io/
- [ ] Configurar Datadog (métricas): https://www.datadoghq.com/
- [ ] Adicionar variáveis no Portainer stack
- [ ] Restart stack

---

## 🚀 Primeiro Uso

### Análise de Contrato
- [ ] Via WhatsApp: Envie PDF
- [ ] Via Telegram: Upload de documento
- [ ] Aguarde 30-60 segundos
- [ ] Receba análise completa

### Monitor de Diários
- [ ] Configure keywords em `DOU_KEYWORDS`
- [ ] Restart stack
- [ ] Aguarde próxima verificação (8h padrão)
- [ ] OUforce verificação via API:
```bash
curl http://SEU-IP:3000/api/diarios/check
```

### Gestão de Prazos
- [ ] Via chat: `novo prazo Contestação processo 123 15 dias`
- [ ] Via API:
```bash
curl -X POST http://SEU-IP:3000/api/deadlines \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Recurso",
    "processNumber": "123456",
    "startDate": "2026-02-09",
    "days": 15,
    "type": "processuais"
  }'
```
- [ ] Listar: `prazos`

---

## 📊 Monitoramento Contínuo

### Diário
- [ ] Verificar logs de erro
- [ ] Checar uso de recursos (CPU/RAM)
- [ ] Validar backups

### Semanal
- [ ] Revisar custos de API Claude
- [ ] Analisar uso por feature
- [ ] Verificar atualizações disponíveis

### Mensal
- [ ] Atualizar containers
- [ ] Revisar segurança
- [ ] Backup completo offline

---

## 🐛 Troubleshooting Rápido

### Container não inicia
```bash
# Ver logs
docker logs legalclaw-app

# Problemas comuns:
# - Falta env var → Configure no Portainer
# - Porta em uso → Mude no stack
# - Sem memória → Aumente recursos
```

### WhatsApp não responde
```bash
# 1. Verificar webhook no Twilio
# 2. Testar manualmente:
curl -X POST http://SEU-IP:3000/webhook/whatsapp \
  -d "From=whatsapp:+5511999999999&Body=teste"
# 3. Ver logs do container
```

### Telegram não responde
```bash
# 1. Verificar token
docker exec legalclaw-app env | grep TELEGRAM
# 2. Testar API
curl https://api.telegram.org/bot<TOKEN>/getMe
# 3. Restart container
```

---

## ✅ Checklist Final

### Técnico
- [ ] Todos containers running
- [ ] Health check OK
- [ ] Logs sem erros
- [ ] WhatsApp funcionando
- [ ] Telegram funcionando
- [ ] SSL configurado (produção)
- [ ] Backup configurado
- [ ] Firewall ativo
- [ ] Monitoramento ativo

### Negócio
- [ ] Landing page no ar
- [ ] Preços definidos
- [ ] Formas de pagamento
- [ ] Termos de uso
- [ ] Política de privacidade
- [ ] Suporte configurado

---

## 🎉 Pronto!

**Seu LegalClaw está rodando no Portainer!**

Próximos passos:
1. ✅ Teste todas as funcionalidades
2. ✅ Configure monitoramento
3. ✅ Faça backup
4. ✅ Lance para primeiros clientes beta
5. ✅ Colete feedback
6. ✅ Itere e melhore

---

## 📞 Precisa de Ajuda?

- 📚 Documentação: `PORTAINER_DEPLOY.md`
- 💬 Comunidade: [Discord/Slack]
- 📧 Email: suporte@legalclaw.com.br
- 🐛 Issues: GitHub

**Boa sorte! 🚀⚖️**
