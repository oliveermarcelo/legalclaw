require('dotenv').config();

function cleanEnv(value, fallback = '') {
  return String(value ?? fallback)
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function cleanUrl(value, fallback = '') {
  const raw = cleanEnv(value, fallback).replace(/\/+$/, '');
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

module.exports = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // IA (multi-provider)
  ai: {
    provider: cleanEnv(process.env.AI_PROVIDER, 'anthropic').toLowerCase(), // 'anthropic', 'gemini' ou 'openai'
    // OpenAI
    openaiApiKey: cleanEnv(process.env.OPENAI_API_KEY),
    openaiModel: cleanEnv(process.env.OPENAI_MODEL, 'gpt-4o-mini'),
    openaiBaseUrl: cleanUrl(process.env.OPENAI_BASE_URL, 'https://api.openai.com/v1'),
    // Gemini
    geminiApiKey: cleanEnv(process.env.GEMINI_API_KEY),
    geminiModel: cleanEnv(process.env.GEMINI_MODEL, 'gemini-2.0-flash'),
    // Anthropic
    anthropicApiKey: cleanEnv(process.env.ANTHROPIC_API_KEY),
    anthropicModel: cleanEnv(process.env.ANTHROPIC_MODEL, 'claude-sonnet-4-20250514'),
    // Geral
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096'),
  },

  // PostgreSQL
  database: {
    url: cleanEnv(process.env.DATABASE_URL, 'postgresql://drlex:drlex_secret@localhost:5432/drlex'),
  },

  // Redis
  redis: {
    url: cleanEnv(process.env.REDIS_URL, 'redis://localhost:6379'),
  },

  // Evolution API (WhatsApp)
  evolution: {
    apiUrl: cleanUrl(process.env.EVOLUTION_API_URL, 'https://api.wapify.com.br'),
    apiKey: cleanEnv(process.env.EVOLUTION_API_KEY),
    instance: cleanEnv(process.env.EVOLUTION_INSTANCE, 'drlex'),
    webhookUrl: cleanUrl(process.env.EVOLUTION_WEBHOOK_URL),
  },

  // Telegram
  telegram: {
    botToken: cleanEnv(process.env.TELEGRAM_BOT_TOKEN),
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
