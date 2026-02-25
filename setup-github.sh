#!/bin/bash

# ============================================
# LegalClaw - Setup Automático do GitHub
# ============================================

set -e

echo "🏛️  LegalClaw - Setup do GitHub"
echo "================================"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
step() { echo -e "${BLUE}[→]${NC} $1"; }

# ============================================
# 1. Verificar Git
# ============================================
step "Verificando Git..."

if ! command -v git &> /dev/null; then
    echo "Git não encontrado. Instale primeiro:"
    echo "  https://git-scm.com/downloads"
    exit 1
fi

info "Git instalado: $(git --version)"

# ============================================
# 2. Configurar Git (se necessário)
# ============================================
step "Verificando configuração do Git..."

GIT_NAME=$(git config --global user.name || echo "")
GIT_EMAIL=$(git config --global user.email || echo "")

if [ -z "$GIT_NAME" ]; then
    read -p "Digite seu nome para o Git: " NAME
    git config --global user.name "$NAME"
    info "Nome configurado: $NAME"
else
    info "Nome: $GIT_NAME"
fi

if [ -z "$GIT_EMAIL" ]; then
    read -p "Digite seu email para o Git: " EMAIL
    git config --global user.email "$EMAIL"
    info "Email configurado: $EMAIL"
else
    info "Email: $GIT_EMAIL"
fi

# ============================================
# 3. Inicializar repositório
# ============================================
step "Inicializando repositório Git..."

if [ -d ".git" ]; then
    warn "Repositório Git já inicializado"
else
    git init
    info "Repositório inicializado"
fi

# ============================================
# 4. Verificar .gitignore
# ============================================
step "Verificando .gitignore..."

if [ ! -f ".gitignore" ]; then
    warn ".gitignore não encontrado! Criando..."
    cat > .gitignore <<EOF
# Dependencies
node_modules/
package-lock.json

# Environment
.env
.env.local

# Logs
logs/
*.log

# Data
data/

# OS
.DS_Store
Thumbs.db
EOF
    info ".gitignore criado"
else
    info ".gitignore existe"
fi

# ============================================
# 5. Verificar se há secrets
# ============================================
step "Verificando secrets..."

if [ -f ".env" ]; then
    warn "ATENÇÃO: Arquivo .env encontrado!"
    warn "Certifique-se de que está no .gitignore"
    
    if grep -q "^\.env$" .gitignore; then
        info ".env está no .gitignore ✓"
    else
        warn ".env NÃO está no .gitignore!"
        echo ".env" >> .gitignore
        info "Adicionado .env ao .gitignore"
    fi
fi

# ============================================
# 6. Adicionar arquivos
# ============================================
step "Adicionando arquivos..."

git add .

# Verificar se algo foi staged
if git diff --cached --quiet; then
    warn "Nenhuma mudança para commitar"
else
    info "Arquivos adicionados"
fi

# ============================================
# 7. Primeiro commit
# ============================================
step "Criando primeiro commit..."

if git rev-parse HEAD >/dev/null 2>&1; then
    warn "Já existe commit neste repositório"
    
    read -p "Deseja fazer um novo commit? (s/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        read -p "Mensagem do commit: " MSG
        git commit -m "$MSG"
        info "Commit criado"
    fi
else
    git commit -m "feat: versão inicial do LegalClaw

- Análise de contratos com IA
- Monitor de diários oficiais (DOU/DOE/DOM)
- Gestão de prazos processuais
- Integrações WhatsApp e Telegram
- Deploy com Docker e Portainer
- Documentação completa"
    
    info "Primeiro commit criado"
fi

# ============================================
# 8. Renomear branch para main
# ============================================
step "Renomeando branch para main..."

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "main" ]; then
    git branch -M main
    info "Branch renomeada para main"
else
    info "Branch já é main"
fi

# ============================================
# 9. Configurar remote
# ============================================
step "Configurando remote..."

echo ""
echo "Agora você precisa criar um repositório no GitHub:"
echo "1. Acesse: https://github.com/new"
echo "2. Nome: legalclaw (ou outro nome)"
echo "3. NÃO inicialize com README, .gitignore ou license"
echo "4. Clique em 'Create repository'"
echo ""

read -p "Pressione Enter após criar o repositório no GitHub..."

echo ""
read -p "Digite seu nome de usuário do GitHub: " GITHUB_USER
read -p "Digite o nome do repositório (padrão: legalclaw): " REPO_NAME
REPO_NAME=${REPO_NAME:-legalclaw}

echo ""
echo "Escolha o método de autenticação:"
echo "1) SSH (recomendado, requer configuração de chave)"
echo "2) HTTPS (requer token de acesso)"
read -p "Escolha (1 ou 2): " AUTH_METHOD

if [ "$AUTH_METHOD" = "1" ]; then
    REMOTE_URL="git@github.com:$GITHUB_USER/$REPO_NAME.git"
    
    # Testar SSH
    if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
        info "SSH configurado corretamente"
    else
        warn "SSH pode não estar configurado"
        echo "Veja: GITHUB_SETUP.md para configurar SSH"
    fi
else
    REMOTE_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"
    warn "HTTPS requer Personal Access Token"
    echo "Crie em: https://github.com/settings/tokens"
fi

# Verificar se remote já existe
if git remote | grep -q "^origin$"; then
    warn "Remote 'origin' já existe"
    git remote set-url origin "$REMOTE_URL"
    info "URL do remote atualizada"
else
    git remote add origin "$REMOTE_URL"
    info "Remote adicionado"
fi

info "Remote: $REMOTE_URL"

# ============================================
# 10. Push!
# ============================================
step "Pronto para fazer push..."

echo ""
read -p "Deseja fazer push agora? (s/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    info "Fazendo push..."
    
    if git push -u origin main; then
        echo ""
        echo "================================"
        info "✅ Push realizado com sucesso!"
        echo "================================"
        echo ""
        echo "Seu repositório está em:"
        echo "https://github.com/$GITHUB_USER/$REPO_NAME"
        echo ""
    else
        warn "Erro ao fazer push"
        echo ""
        echo "Se erro de autenticação:"
        echo "- SSH: Verifique se chave está configurada"
        echo "- HTTPS: Use Personal Access Token, não senha"
        echo ""
        echo "Tente manualmente:"
        echo "  git push -u origin main"
    fi
else
    echo ""
    info "Push cancelado"
    echo ""
    echo "Quando quiser fazer push:"
    echo "  git push -u origin main"
fi

# ============================================
# Finalização
# ============================================
echo ""
echo "================================"
info "✅ Setup do Git concluído!"
echo "================================"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Verificar repositório no GitHub:"
echo "   https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "2. Adicionar descrição e topics no GitHub"
echo ""
echo "3. Configurar GitHub Pages (opcional)"
echo ""
echo "4. Convidar colaboradores (opcional)"
echo ""
echo "5. Fazer mudanças e commits:"
echo "   git add ."
echo "   git commit -m 'feat: nova funcionalidade'"
echo "   git push"
echo ""
echo "📚 Veja GITHUB_SETUP.md para mais detalhes"
echo ""
