#!/bin/bash
# ==============================================
# DrLex - Descobrir configurações da Evolution API
# Execute no servidor: bash discover-evolution.sh
# ==============================================

echo "🔍 Descobrindo Evolution API no Docker..."
echo ""

# 1. Encontrar container da Evolution
echo "📦 Containers com 'evolution' no nome:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i evolution
echo ""

# 2. Encontrar rede
echo "🌐 Redes Docker com 'evolution':"
docker network ls | grep -i evolution
echo ""

# 3. Inspecionar container (se encontrado)
CONTAINER=$(docker ps --format '{{.Names}}' | grep -i evolution | head -1)

if [ -z "$CONTAINER" ]; then
  echo "❌ Nenhum container da Evolution API encontrado rodando."
  echo "   Verifique com: docker ps -a | grep evolution"
  exit 1
fi

echo "📋 Container encontrado: $CONTAINER"
echo ""

# Porta
echo "🔌 Portas:"
docker port "$CONTAINER"
echo ""

# Rede
echo "🌐 Redes do container:"
docker inspect "$CONTAINER" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} (IP: {{$v.IPAddress}}){{"\n"}}{{end}}'
echo ""

# Variáveis de ambiente relevantes
echo "🔑 Variáveis de ambiente (API Key e porta):"
docker exec "$CONTAINER" env 2>/dev/null | grep -iE "(api_?key|port|auth|server_url|base_url)" || echo "  (não foi possível acessar)"
echo ""

# URL interna Docker
echo "📡 URL para usar no docker-compose (rede interna):"
NETWORK=$(docker inspect "$CONTAINER" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | head -1)
IP=$(docker inspect "$CONTAINER" --format "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" | head -1)
PORT=$(docker inspect "$CONTAINER" --format '{{range $p, $conf := .NetworkSettings.Ports}}{{$p}}{{"\n"}}{{end}}' | head -1 | cut -d'/' -f1)

echo "  Container: $CONTAINER"
echo "  Rede: $NETWORK"
echo "  IP interno: $IP"
echo "  Porta: ${PORT:-8080}"
echo "  URL: http://${CONTAINER}:${PORT:-8080}"
echo ""

echo "✅ Use estas informações no .env do DrLex:"
echo "  EVOLUTION_API_URL=http://${CONTAINER}:${PORT:-8080}"
echo "  EVOLUTION_NETWORK=$NETWORK"
echo ""
echo "⚠️  Ainda precisa: EVOLUTION_API_KEY (verificar no painel da Evolution)"
