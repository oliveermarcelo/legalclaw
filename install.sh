#!/bin/bash

# ========================================
# LegalClaw - Script de Instalação
# ========================================

set -e

echo "🏛️  LegalClaw - Instalação Automatizada"
echo "========================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funções auxiliares
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar sistema operacional
info "Detectando sistema operacional..."
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac
info "Sistema: ${MACHINE}"

# Verificar Node.js
info "Verificando Node.js..."
if ! command -v node &> /dev/null; then
    warn "Node.js não encontrado. Instalando..."
    
    if [ "$MACHINE" = "Mac" ]; then
        brew install node
    elif [ "$MACHINE" = "Linux" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
else
    NODE_VERSION=$(node -v)
    info "Node.js ${NODE_VERSION} instalado"
fi

# Verificar npm
info "Verificando npm..."
if ! command -v npm &> /dev/null; then
    error "npm não encontrado. Por favor, instale Node.js"
    exit 1
fi

# Verificar Docker (opcional)
info "Verificando Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    info "Docker instalado: ${DOCKER_VERSION}"
    HAS_DOCKER=true
else
    warn "Docker não encontrado. A instalação continuará sem Docker."
    HAS_DOCKER=false
fi

# Criar diretórios
info "Criando estrutura de diretórios..."
mkdir -p logs data

# Instalar dependências
info "Instalando dependências Node.js..."
npm install

# Instalar OpenClaw
info "Instalando OpenClaw..."
npm install -g openclaw

# Configurar ambiente
info "Configurando ambiente..."
if [ ! -f .env ]; then
    cp .env.example .env
    info "Arquivo .env criado. Por favor, configure suas credenciais."
    warn "Execute: nano .env"
else
    info "Arquivo .env já existe"
fi

# Onboarding OpenClaw
info "Iniciando onboarding do OpenClaw..."
read -p "Deseja executar o onboarding do OpenClaw agora? (s/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    openclaw onboard
fi

# Docker setup (se disponível)
if [ "$HAS_DOCKER" = true ]; then
    read -p "Deseja configurar com Docker? (s/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        info "Criando containers Docker..."
        docker-compose up -d postgres redis
        info "Aguardando banco de dados..."
        sleep 5
    fi
fi

# Verificar Python (para skills que usam Python)
info "Verificando Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    info "Python instalado: ${PYTHON_VERSION}"
    
    # Instalar dependências Python
    if [ -f requirements.txt ]; then
        info "Instalando dependências Python..."
        pip3 install -r requirements.txt
    fi
else
    warn "Python não encontrado. Algumas funcionalidades podem não funcionar."
fi

echo ""
echo "========================================"
info "✅ Instalação concluída!"
echo "========================================"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Configure o arquivo .env:"
echo "   nano .env"
echo ""
echo "2. Configure suas credenciais:"
echo "   - Anthropic API Key (Claude)"
echo "   - Twilio (WhatsApp)"
echo "   - Telegram Bot Token"
echo ""
echo "3. Inicie o sistema:"
echo "   npm start"
echo ""
echo "   ou com Docker:"
echo "   docker-compose up -d"
echo ""
echo "4. Acesse a API:"
echo "   http://localhost:3000/health"
echo ""
echo "📚 Documentação completa: ./docs/"
echo "💬 Suporte: https://github.com/seu-usuario/legal-ai-assistant"
echo ""
