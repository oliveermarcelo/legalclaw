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

function cleanCsv(value, fallback = '') {
  return cleanEnv(value, fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanBool(value, fallback = false) {
  const raw = cleanEnv(value, fallback ? '1' : '0').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
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
    openaiAllowedModels: cleanCsv(process.env.OPENAI_ALLOWED_MODELS, 'gpt-4o-mini,gpt-4o'),
    openaiBaseUrl: cleanUrl(process.env.OPENAI_BASE_URL, 'https://api.openai.com/v1'),
    openaiAutoEscalateChars: parseInt(process.env.OPENAI_AUTO_ESCALATE_CHARS || '18000', 10),
    // Gemini
    geminiApiKey: cleanEnv(process.env.GEMINI_API_KEY),
    geminiModel: cleanEnv(process.env.GEMINI_MODEL, 'gemini-2.0-flash'),
    geminiAllowedModels: cleanCsv(process.env.GEMINI_ALLOWED_MODELS, 'gemini-2.0-flash'),
    // Anthropic
    anthropicApiKey: cleanEnv(process.env.ANTHROPIC_API_KEY),
    anthropicModel: cleanEnv(process.env.ANTHROPIC_MODEL, 'claude-sonnet-4-20250514'),
    anthropicAllowedModels: cleanCsv(process.env.ANTHROPIC_ALLOWED_MODELS, 'claude-sonnet-4-20250514'),
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

  // Consultas externas juridicas
  externalLegal: {
    provider: cleanEnv(process.env.EXTERNAL_LEGAL_PROVIDER, 'datajud').toLowerCase(),
    datajudEnabled: cleanBool(process.env.DATAJUD_ENABLED, false),
    datajudApiKey: cleanEnv(process.env.DATAJUD_API_KEY),
    datajudBaseUrl: cleanUrl(process.env.DATAJUD_BASE_URL, 'https://api-publica.datajud.cnj.jus.br'),
    datajudTimeoutMs: parseInt(process.env.DATAJUD_TIMEOUT_MS || '20000', 10),
    datajudMaxPerPage: parseInt(process.env.DATAJUD_MAX_PER_PAGE || '50', 10),
    datajudDefaultAlias: cleanEnv(process.env.DATAJUD_DEFAULT_ALIAS, 'api_publica_tjba'),
    datajudAliases: cleanCsv(
      process.env.DATAJUD_ALIASES,
      'api_publica_tjba,api_publica_tjsp,api_publica_tjmg,api_publica_tjrj,api_publica_tjrs,' +
      'api_publica_trf1,api_publica_trf2,api_publica_trf3,api_publica_trf4,api_publica_trf5,' +
      'api_publica_trt1,api_publica_trt2,api_publica_trt3,api_publica_trt4,api_publica_trt5,' +
      'api_publica_trt6,api_publica_trt7,api_publica_trt8,api_publica_trt9,api_publica_trt10,' +
      'api_publica_trt11,api_publica_trt12,api_publica_trt13,api_publica_trt14,api_publica_trt15,' +
      'api_publica_trt16,api_publica_trt17,api_publica_trt18,api_publica_trt19,api_publica_trt20,' +
      'api_publica_trt21,api_publica_trt22,api_publica_trt23,api_publica_trt24,' +
      'api_publica_stj,api_publica_tst,api_publica_tse,api_publica_stm'
    ),
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
