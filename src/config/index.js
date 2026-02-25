require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // IA (multi-provider)
  ai: {
    provider: process.env.AI_PROVIDER || 'gemini', // 'gemini' ou 'anthropic'
    // Gemini
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    // Anthropic
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    // Geral
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096'),
  },

  // PostgreSQL
  database: {
    url: process.env.DATABASE_URL || 'postgresql://drlex:drlex_secret@localhost:5432/drlex',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Evolution API (WhatsApp)
  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL || 'https://api.wapify.com.br',
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'drlex',
  },

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: '7d',
  },

  // Planos / Limites
  plans: {
    solo: {
      name: 'Solo',
      price: 197,
      contractsPerMonth: 50,
      deadlines: 50,
      diarios: ['DOU'],
    },
    escritorio: {
      name: 'Escritório',
      price: 497,
      contractsPerMonth: 200,
      deadlines: Infinity,
      diarios: ['DOU', 'DOE', 'DOM'],
    },
    enterprise: {
      name: 'Enterprise',
      price: 1997,
      contractsPerMonth: Infinity,
      deadlines: Infinity,
      diarios: ['DOU', 'DOE', 'DOM'],
      apiAccess: true,
      whiteLabel: true,
    },
  },
};
