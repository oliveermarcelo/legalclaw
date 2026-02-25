# 🐳 LegalClaw - Guia de Deploy no Portainer

## 📋 Pré-requisitos

- ✅ Portainer instalado e rodando
- ✅ Docker Engine ativo
- ✅ Acesso SSH ao servidor
- ✅ Pelo menos 2GB RAM livre
- ✅ 10GB de espaço em disco

## 🚀 Deploy em 10 Minutos

### Passo 1: Preparar Arquivos no Servidor

```bash
# Conectar ao servidor via SSH
ssh seu-usuario@seu-servidor

# Criar estrutura de diretórios
sudo mkdir -p /var/data/legalclaw/{app,logs,data,nginx}

# Fazer upload do código
cd /var/data/legalclaw
sudo wget https://seu-link/legal-ai-assistant.tar.gz
sudo tar -xzf legal-ai-assistant.tar.gz
sudo mv legal-ai-assistant/* app/
sudo rm -rf legal-ai-assistant legal-ai-assistant.tar.gz

# OU clonar do Git
cd /var/data/legalclaw
sudo git clone https://github.com/seu-usuario/legal-ai-assistant.git app

# Ajustar permissões
sudo chown -R 1000:1000 /var/data/legalclaw
sudo chmod -R 755 /var/data/legalclaw
```

### Passo 2: Criar Stack no Portainer

1. **Acessar Portainer**
   - Abra: `https://seu-servidor:9443` (ou porta configurada)
   - Login com suas credenciais

2. **Criar Nova Stack**
   - Menu lateral → **Stacks**
   - Botão **+ Add stack**
   - Nome: `legalclaw-production`

3. **Configurar Stack**
   - **Web editor**: Cole o conteúdo de `portainer-stack.yml`
   - OU **Upload**: Faça upload do arquivo
   - OU **Repository**: Configure Git repository

### Passo 3: Configurar Variáveis de Ambiente

Na seção **Environment variables**, adicione:

```bash
# ===== OBRIGATÓRIAS =====

# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-XXXXXXXXXXXXX

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_WHATSAPP_NUMBER=+14155238886

# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Database
DB_PASSWORD=SenhaSegura123!@#

# ===== OPCIONAIS =====

# Telegram - Restringir usuários (IDs separados por vírgula)
TELEGRAM_ALLOWED_USERS=123456789,987654321

# Redis - Senha (deixe vazio se não quiser senha)
REDIS_PASSWORD=

# Configurações de monitoramento
DOU_KEYWORDS=sua empresa,cnpj,processo
DOU_CHECK_INTERVAL=0 8 * * *
```

### Passo 4: Deploy!

1. **Revisar configurações**
   - Verifique se todas as variáveis estão corretas
   - Confirme os volumes e portas

2. **Deploy**
   - Clique em **Deploy the stack**
   - Aguarde 1-2 minutos

3. **Verificar Status**
   - Stacks → legalclaw-production
   - Todos os containers devem estar **running** (verde)

### Passo 5: Verificar Instalação

```bash
# Via browser
https://seu-servidor:3000/health

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

# Via curl (no servidor)
curl http://localhost:3000/health
```

---

## 🔧 Configurações Avançadas

### Configurar Nginx (Proxy Reverso)

```bash
# Criar configuração do Nginx
sudo nano /var/data/legalclaw/nginx/nginx.conf
```

Cole este conteúdo:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream legalclaw {
        server legalclaw:3000;
    }

    server {
        listen 80;
        server_name seu-dominio.com.br;

        # Redirecionar para HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name seu-dominio.com.br;

        # Certificados SSL (configure com Certbot)
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Webhook do Twilio
        location /webhook/whatsapp {
            proxy_pass http://legalclaw;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # API
        location /api {
            proxy_pass http://legalclaw;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Health check
        location /health {
            proxy_pass http://legalclaw;
            access_log off;
        }
    }
}
```

### Configurar SSL (HTTPS)

```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot

# Obter certificado
sudo certbot certonly --standalone -d seu-dominio.com.br

# Copiar certificados para Nginx
sudo cp /etc/letsencrypt/live/seu-dominio.com.br/fullchain.pem /var/data/legalclaw/nginx/ssl/
sudo cp /etc/letsencrypt/live/seu-dominio.com.br/privkey.pem /var/data/legalclaw/nginx/ssl/

# Renovação automática
sudo crontab -e
# Adicione:
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/seu-dominio.com.br/*.pem /var/data/legalclaw/nginx/ssl/
```

Depois, no Portainer:
1. Stacks → legalclaw-production
2. Editor
3. Descomente a seção `nginx` (remova o `#` das linhas)
4. Update the stack

---

## 📊 Monitoramento e Logs

### Ver Logs em Tempo Real

No Portainer:
1. **Containers**
2. Clique em **legalclaw-app**
3. **Logs**
4. Ative **Auto-refresh**

Ou via terminal:
```bash
# Logs de todos os containers
docker-compose -f /var/data/legalclaw/app/docker-compose.yml logs -f

# Apenas app
docker logs -f legalclaw-app

# Apenas erros
docker logs -f legalclaw-app 2>&1 | grep ERROR
```

### Verificar Uso de Recursos

No Portainer:
1. **Containers** → legalclaw-app
2. **Stats** (aba superior)
3. Veja CPU, RAM, Network

Ou via terminal:
```bash
docker stats legalclaw-app legalclaw-postgres legalclaw-redis
```

### Acessar Container

```bash
# Via Portainer: Containers → legalclaw-app → >_ Console

# Via terminal:
docker exec -it legalclaw-app sh

# Dentro do container:
cd /app
ls -la
cat logs/combined.log
npm list
```

---

## 🔄 Atualizações e Manutenção

### Atualizar Código

```bash
# Método 1: Git pull
cd /var/data/legalclaw/app
sudo git pull origin main

# Método 2: Upload manual
sudo rm -rf /var/data/legalclaw/app/*
# Faça upload dos novos arquivos
sudo tar -xzf nova-versao.tar.gz -C /var/data/legalclaw/app/

# Reiniciar stack no Portainer
# Stacks → legalclaw-production → Stop → Start
```

### Backup de Dados

```bash
# Script de backup
sudo nano /usr/local/bin/backup-legalclaw.sh
```

Cole:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/legalclaw"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec legalclaw-postgres pg_dump -U legalclaw legalclaw > $BACKUP_DIR/db_$DATE.sql

# Backup Redis
docker exec legalclaw-redis redis-cli SAVE
docker cp legalclaw-redis:/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Backup arquivos
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/data/legalclaw/data

# Limpar backups antigos (>30 dias)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup concluído: $DATE"
```

```bash
# Tornar executável
sudo chmod +x /usr/local/bin/backup-legalclaw.sh

# Agendar backup diário (2h da manhã)
sudo crontab -e
# Adicione:
0 2 * * * /usr/local/bin/backup-legalclaw.sh >> /var/log/legalclaw-backup.log 2>&1
```

### Restaurar Backup

```bash
# PostgreSQL
cat /var/backups/legalclaw/db_20260209.sql | docker exec -i legalclaw-postgres psql -U legalclaw legalclaw

# Redis
docker cp /var/backups/legalclaw/redis_20260209.rdb legalclaw-redis:/data/dump.rdb
docker restart legalclaw-redis

# Arquivos
tar -xzf /var/backups/legalclaw/files_20260209.tar.gz -C /
```

---

## ⚙️ Configurações de Webhook

### WhatsApp (Twilio)

1. **Obter URL pública**:
   ```
   https://seu-dominio.com.br/webhook/whatsapp
   ```

2. **Configurar no Twilio**:
   - Console → Messaging → Settings
   - WhatsApp sandbox settings
   - **When a message comes in**: Sua URL
   - **HTTP Method**: POST
   - Save

3. **Testar**:
   - WhatsApp: +1 415 523 8886
   - Envie: `join [código-sandbox]`
   - Envie: "Olá"

### Telegram

Já funciona automaticamente! O bot se conecta via polling.

Para webhook (mais rápido):
```bash
# Configurar webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://seu-dominio.com.br/webhook/telegram"}'
```

---

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs de erro
docker logs legalclaw-app

# Problemas comuns:
# 1. Falta variável de ambiente
# 2. Porta já em uso
# 3. Falta de memória

# Solução: Verificar env vars no Portainer
```

### WhatsApp não responde

```bash
# 1. Verificar webhook
curl -X POST https://seu-dominio.com.br/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+5511999999999&Body=teste"

# 2. Ver logs
docker logs legalclaw-app | grep whatsapp

# 3. Verificar Twilio credentials
docker exec legalclaw-app env | grep TWILIO
```

### Telegram não responde

```bash
# 1. Testar conexão
docker exec legalclaw-app sh -c "wget -qO- https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# 2. Ver logs
docker logs legalclaw-app | grep telegram

# 3. Reiniciar bot
docker restart legalclaw-app
```

### Database connection error

```bash
# 1. Verificar PostgreSQL
docker exec legalclaw-postgres pg_isready -U legalclaw

# 2. Testar conexão
docker exec legalclaw-app sh -c "nc -zv postgres 5432"

# 3. Verificar senha
docker exec legalclaw-app env | grep DATABASE_URL

# 4. Resetar database (CUIDADO - perde dados!)
docker-compose down -v
docker-compose up -d
```

---

## 📈 Otimização de Performance

### Recursos Recomendados

**Desenvolvimento/Teste**:
- CPU: 2 cores
- RAM: 4GB
- Disco: 20GB

**Produção (até 100 usuários)**:
- CPU: 4 cores
- RAM: 8GB
- Disco: 50GB SSD

**Produção (100-500 usuários)**:
- CPU: 8 cores
- RAM: 16GB
- Disco: 100GB SSD

### Limitar Recursos no Portainer

1. Containers → legalclaw-app → Duplicate/Edit
2. **Resources**:
   - Memory limit: `2GB`
   - Memory reservation: `1GB`
   - CPU limit: `2.0`
3. Update the container

### Cache com Redis

Já configurado! Para verificar:
```bash
# Ver uso de cache
docker exec legalclaw-redis redis-cli INFO stats

# Limpar cache
docker exec legalclaw-redis redis-cli FLUSHALL
```

---

## 🔒 Segurança

### Checklist de Segurança

- [ ] Trocar senhas padrão (DB_PASSWORD)
- [ ] Configurar firewall (UFW)
- [ ] SSL/HTTPS configurado
- [ ] Backup automático ativo
- [ ] Logs sendo monitorados
- [ ] Rate limiting configurado
- [ ] Variáveis sensíveis em secrets
- [ ] Atualizar containers regularmente

### Configurar Firewall

```bash
# UFW
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 9443/tcp   # Portainer
sudo ufw enable
```

### Secrets do Portainer (Recomendado)

1. **Settings** → **Secrets** → **Add secret**
2. Criar secrets para cada credencial:
   - `anthropic_api_key`
   - `twilio_account_sid`
   - `twilio_auth_token`
   - `telegram_bot_token`
   - `db_password`

3. Editar stack para usar secrets:
```yaml
services:
  legalclaw:
    secrets:
      - anthropic_api_key
      - twilio_account_sid
    environment:
      - ANTHROPIC_API_KEY_FILE=/run/secrets/anthropic_api_key
```

---

## 📞 Suporte

### Comunidade
- 💬 Discord: [Link do Discord]
- 📧 Email: suporte@legalclaw.com.br
- 📚 Docs: https://docs.legalclaw.com.br

### Logs para Suporte

Se precisar de ajuda, envie:
```bash
# Gerar relatório de diagnóstico
docker logs legalclaw-app > legalclaw-logs.txt
docker stats --no-stream > legalclaw-stats.txt
docker inspect legalclaw-app > legalclaw-inspect.txt
```

---

## ✅ Checklist Final

- [ ] Stack deployed no Portainer
- [ ] Todos containers running
- [ ] Health check respondendo
- [ ] WhatsApp testado
- [ ] Telegram testado
- [ ] SSL configurado (produção)
- [ ] Backup configurado
- [ ] Firewall ativo
- [ ] Monitoramento ativo
- [ ] Documentação revisada

---

**Parabéns! 🎉 Seu LegalClaw está rodando no Portainer!**

Próximos passos:
1. Configure os webhooks do Twilio
2. Teste todas as funcionalidades
3. Configure backup automático
4. Monitore logs e métricas

🚀 Boa sorte com seu SaaS jurídico!
