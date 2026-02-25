#!/bin/bash

# ============================================
# LegalClaw - Preparação do Servidor
# Execute ANTES de criar a stack no Portainer
# ============================================

set -e

echo "🏛️  LegalClaw - Preparação do Servidor para Portainer"
echo "======================================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# ============================================
# 1. Verificar requisitos
# ============================================
step "1/6 Verificando requisitos..."

# Docker
if ! command -v docker &> /dev/null; then
    error "Docker não encontrado. Instale primeiro:"
    echo "  curl -fsSL https://get.docker.com | sh"
    exit 1
fi
info "Docker instalado: $(docker --version)"

# Portainer
if ! docker ps | grep -q portainer; then
    warn "Portainer não está rodando."
    read -p "Deseja instalar o Portainer agora? (s/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        info "Instalando Portainer..."
        docker volume create portainer_data
        docker run -d -p 9443:9443 -p 8000:8000 \
            --name portainer --restart=always \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v portainer_data:/data \
            portainer/portainer-ce:latest
        
        info "Portainer instalado! Acesse: https://$(hostname -I | awk '{print $1}'):9443"
        info "Configure sua senha de admin e volte aqui."
        exit 0
    else
        error "Portainer é necessário. Instale e execute este script novamente."
        exit 1
    fi
fi
info "Portainer rodando"

# ============================================
# 2. Criar estrutura de diretórios
# ============================================
step "2/6 Criando estrutura de diretórios..."

BASE_DIR="/var/data/legalclaw"
DIRS=(
    "$BASE_DIR/app"
    "$BASE_DIR/logs"
    "$BASE_DIR/data"
    "$BASE_DIR/data/contracts"
    "$BASE_DIR/data/documents"
    "$BASE_DIR/nginx"
    "$BASE_DIR/nginx/ssl"
)

for dir in "${DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        sudo mkdir -p "$dir"
        info "Criado: $dir"
    else
        info "Existe: $dir"
    fi
done

# ============================================
# 3. Baixar código
# ============================================
step "3/6 Preparando código da aplicação..."

read -p "Você tem o código em arquivo local? (s/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Ss]$ ]]; then
    read -p "Digite o caminho completo do arquivo .tar.gz: " TARBALL
    
    if [ -f "$TARBALL" ]; then
        info "Extraindo código..."
        sudo tar -xzf "$TARBALL" -C "$BASE_DIR/app" --strip-components=1
        info "Código extraído com sucesso!"
    else
        error "Arquivo não encontrado: $TARBALL"
        exit 1
    fi
else
    read -p "Digite a URL do repositório Git (ou Enter para pular): " GIT_REPO
    
    if [ ! -z "$GIT_REPO" ]; then
        info "Clonando repositório..."
        cd "$BASE_DIR"
        sudo rm -rf app/*
        sudo git clone "$GIT_REPO" app
        info "Repositório clonado!"
    else
        warn "Sem código. Você precisará adicionar manualmente em $BASE_DIR/app"
    fi
fi

# ============================================
# 4. Ajustar permissões
# ============================================
step "4/6 Ajustando permissões..."

sudo chown -R 1000:1000 "$BASE_DIR"
sudo chmod -R 755 "$BASE_DIR"
info "Permissões configuradas"

# ============================================
# 5. Criar configuração do Nginx (opcional)
# ============================================
step "5/6 Configurando Nginx..."

read -p "Deseja criar configuração do Nginx? (s/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Ss]$ ]]; then
    read -p "Digite seu domínio (ex: legalclaw.com.br): " DOMAIN
    
    cat > "$BASE_DIR/nginx/nginx.conf" <<EOF
events {
    worker_connections 1024;
}

http {
    upstream legalclaw {
        server legalclaw:3000;
    }

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name ${DOMAIN};
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name ${DOMAIN};

        # SSL certificates (configure depois com Certbot)
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        
        # SSL config
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Webhook Twilio (WhatsApp)
        location /webhook/whatsapp {
            proxy_pass http://legalclaw;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # API
        location /api {
            proxy_pass http://legalclaw;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }

        # Health check
        location /health {
            proxy_pass http://legalclaw;
            access_log off;
        }
    }
}
EOF

    sudo chown 1000:1000 "$BASE_DIR/nginx/nginx.conf"
    info "Nginx configurado para: $DOMAIN"
    warn "Lembre-se de configurar SSL com Certbot depois!"
else
    info "Nginx não configurado"
fi

# ============================================
# 6. Instruções finais
# ============================================
step "6/6 Preparação concluída!"

echo ""
echo "======================================================="
echo -e "${GREEN}✅ Servidor preparado para deploy no Portainer!${NC}"
echo "======================================================="
echo ""
echo "Próximos passos:"
echo ""
echo "1. Acesse o Portainer:"
echo "   https://$(hostname -I | awk '{print $1}'):9443"
echo ""
echo "2. Vá em: Stacks → Add stack"
echo ""
echo "3. Nome da stack: legalclaw-production"
echo ""
echo "4. Cole o conteúdo de: portainer-stack.yml"
echo ""
echo "5. Configure as variáveis de ambiente (obrigatórias):"
echo "   - ANTHROPIC_API_KEY"
echo "   - TWILIO_ACCOUNT_SID"
echo "   - TWILIO_AUTH_TOKEN"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - DB_PASSWORD"
echo ""
echo "6. Deploy the stack!"
echo ""
echo "7. Aguarde 1-2 minutos e acesse:"
echo "   http://$(hostname -I | awk '{print $1}'):3000/health"
echo ""
echo "======================================================="
echo ""
echo "📂 Estrutura criada em: $BASE_DIR"
echo "📚 Documentação completa: PORTAINER_DEPLOY.md"
echo "🔧 Arquivo de env vars: portainer.env"
echo ""

# Verificar firewall
if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        warn "Firewall UFW ativo. Certifique-se de liberar as portas:"
        echo "   sudo ufw allow 3000/tcp   # API LegalClaw"
        echo "   sudo ufw allow 80/tcp     # HTTP"
        echo "   sudo ufw allow 443/tcp    # HTTPS"
        echo "   sudo ufw allow 9443/tcp   # Portainer"
    fi
fi

echo ""
info "🚀 Pronto para deploy! Boa sorte!"
echo ""
