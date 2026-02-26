const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const Redis = require('ioredis');

const config = require('./config');
const logger = require('./utils/logger');
const { pool, migrate } = require('./config/migrate');
const { authOptional, authRequired } = require('./utils/auth-middleware');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhooks');
const evolution = require('./integrations/evolution');
const telegram = require('./integrations/telegram');
const deadlineManager = require('./services/deadline-manager');
const diarioMonitor = require('./services/diario-monitor');

const app = express();

// Trust proxy (Traefik)
app.set('trust proxy', true);

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    'https://drlex.wapify.com.br',
    'https://app.drlex.wapify.com.br',
    'http://localhost:3001',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (exceto webhooks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições, tente novamente em 15 minutos' },
  validate: { xForwardedForHeader: false },
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  if (req.path !== '/health') {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// ============================================================
// ROTAS
// ============================================================

// Health check
app.get('/health', async (req, res) => {
  const checks = { api: 'ok' };

  // Banco
  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Redis
  let redisClient = null;
  try {
    redisClient = new Redis(config.redis.url, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    const pong = await redisClient.ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'error';
  } catch {
    checks.redis = 'error';
  } finally {
    if (redisClient) redisClient.disconnect();
  }

  // IA configurada
  const aiProvider = config.ai.provider;
  const aiConfigured =
    (aiProvider === 'anthropic' && Boolean(config.ai.anthropicApiKey)) ||
    (aiProvider === 'gemini' && Boolean(config.ai.geminiApiKey));
  checks.ai = aiConfigured ? `${aiProvider}:configured` : `${aiProvider}:not_configured`;

  // Integracao WhatsApp
  try {
    const status = await evolution.getConnectionStatus();
    checks.whatsapp = status?.state || status?.instance?.state || 'unknown';
  } catch {
    checks.whatsapp = 'unreachable';
  }

  const allOk = checks.database === 'ok' && checks.redis === 'ok';
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: checks,
  });
});

// Auth (público)
app.use('/api/auth', authOptional, authRoutes);

// API (autenticado)
app.use('/api', authRequired, apiRoutes);

// Webhooks (sem auth - Evolution/Telegram chamam diretamente)
app.use('/webhooks', webhookRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ============================================================
// CRON JOBS
// ============================================================

cron.schedule('0 8 * * *', async () => {
  logger.info('Cron: Verificando prazos próximos...');
  try {
    const upcoming = await deadlineManager.getUpcoming(3);
    for (const deadline of upcoming) {
      const msg =
        `⚠️ *Prazo se aproximando!*\n\n` +
        `📋 ${deadline.description}\n` +
        `📆 Vencimento: ${new Date(deadline.deadline_date).toLocaleDateString('pt-BR')}\n` +
        `📁 Processo: ${deadline.process_number || 'N/A'}`;
      if (deadline.whatsapp) {
        try { await evolution.sendText(deadline.whatsapp, msg); } catch {}
      }
      if (deadline.telegram_id) {
        try { await telegram.sendMessage(deadline.telegram_id, msg); } catch {}
      }
      await deadlineManager.markNotified(deadline.id);
    }
    logger.info(`Cron: ${upcoming.length} alertas de prazo enviados`);
  } catch (err) {
    logger.error('Cron prazos erro:', err.message);
  }
});

cron.schedule('0 7 * * 1-5', async () => {
  logger.info('Cron: Varrendo diários oficiais...');
  try {
    const alerts = await diarioMonitor.runScan();
    for (const alert of alerts) {
      const msg =
        `📰 *Publicação encontrada no ${alert.diario_type}!*\n\n` +
        `🔍 Palavra-chave: "${alert.matched_keyword}"\n` +
        `📄 ${alert.excerpt?.substring(0, 200)}\n` +
        `🔗 ${alert.url}`;
      if (alert.whatsapp) {
        try { await evolution.sendText(alert.whatsapp, msg); } catch {}
      }
      if (alert.telegram_id) {
        try { await telegram.sendMessage(alert.telegram_id, msg); } catch {}
      }
      await diarioMonitor.markNotified(alert.id);
    }
    logger.info(`Cron: ${alerts.length} alertas de diário enviados`);
  } catch (err) {
    logger.error('Cron diários erro:', err.message);
  }
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function start() {
  try {
    logger.info('Migrando banco de dados...');
    await migrate();

    if (config.evolution.apiKey) {
      logger.info('Configurando Evolution API...');
      try {
        await evolution.createInstance();
        const status = await evolution.getConnectionStatus();
        logger.info('Evolution API status:', status?.state || 'configurada');
      } catch (err) {
        logger.warn('Evolution API não disponível (configurar depois):', err.message);
      }
    }

    if (config.telegram.botToken) {
      telegram.init();
    } else {
      logger.warn('Telegram: Bot token não configurado');
    }

    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`🚀 Dr. Lex rodando na porta ${config.port}`);
      logger.info(`📋 Health: http://localhost:${config.port}/health`);
      logger.info(`📡 API: http://localhost:${config.port}/api`);
      logger.info(`🔗 Webhooks: http://localhost:${config.port}/webhooks`);
    });
  } catch (err) {
    logger.error('Falha ao iniciar DrLex:', err);
    process.exit(1);
  }
}

start();
