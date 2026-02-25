FROM node:18-alpine

WORKDIR /app

# Instalar dependências primeiro (cache do Docker)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Copiar código
COPY . .

# Porta da API
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Iniciar
CMD ["node", "src/index.js"]
