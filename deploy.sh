#!/bin/bash
# ==============================================
# DrLex - Script de Atualização e Deploy
# Execute no servidor onde o código está clonado
# ==============================================

set -e

echo "⚖️  DrLex - Atualizando projeto..."
echo ""

# 1. Definir caminhos
OLD_PATH="/var/data/legalclaw/app"
NEW_PATH="/var/data/drlex/app"
REPO_URL="https://github.com/oliveermarcelo/legalclaw.git"

# 2. Verificar se o repo antigo existe
if [ -d "$OLD_PATH/.git" ]; then
  echo "📦 Repo antigo encontrado em $OLD_PATH"
  echo "   Movendo para $NEW_PATH..."
  mkdir -p /var/data/drlex
  mv "$OLD_PATH" "$NEW_PATH" 2>/dev/null || cp -r "$OLD_PATH" "$NEW_PATH"
  echo "   ✅ Movido"
elif [ -d "$NEW_PATH/.git" ]; then
  echo "📦 Repo já está em $NEW_PATH"
else
  echo "📥 Clonando repositório..."
  mkdir -p /var/data/drlex
  git clone "$REPO_URL" "$NEW_PATH"
  echo "   ✅ Clonado"
fi

echo ""
echo "📂 Caminho do projeto: $NEW_PATH"
echo ""

# 3. Ir para o diretório
cd "$NEW_PATH"

# 4. Verificar status do git
echo "🔍 Status do Git:"
git status --short
echo ""

echo "============================================"
echo "📋 PRÓXIMOS PASSOS MANUAIS:"
echo "============================================"
echo ""
echo "1. Copie os novos arquivos para $NEW_PATH"
echo "   (descompacte o ZIP do DrLex refatorado aqui)"
echo ""
echo "2. Faça o commit e push:"
echo "   cd $NEW_PATH"
echo "   git add ."
echo "   git commit -m 'refactor: rename to DrLex, remove OpenClaw, add Evolution API'"
echo "   git push origin main"
echo ""
echo "3. Configure o .env:"
echo "   cp .env.example .env"
echo "   nano .env"
echo ""
echo "4. Descubra a Evolution API:"
echo "   bash discover-evolution.sh"
echo ""
echo "5. Crie a stack no Portainer:"
echo "   - Portainer → Stacks → Add Stack"
echo "   - Nome: drlex"
echo "   - Cole o conteúdo de portainer-stack.yml"
echo "   - Configure as env vars"
echo "   - Deploy!"
echo ""
echo "============================================"
