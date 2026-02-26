const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');

const config = require('./config');
const logger = require('./utils/logger');
const { pool, migrate } = require('./config/migrate');
const { authOptional, authRequired } = require('./utils/auth-middleware');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhooks');
const evolution = require('./integrations/evolution');

const app = express();
const HEALTHCHECK_TIMEOUT_MS = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 1500);
const TRUST_PROXY_HOPS = Number.parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
  ]);
}

app.set('trust proxy', Number.isNaN(TRUST_PROXY_HOPS) ? 1 : TRUST_PROXY_HOPS);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: [
      'https://drlex.wapify.com.br',
      'https://app.drlex.wapify.com.br',
      'http://localhost:3001',
      'http://localhost:3000',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisicoes, tente novamente em 15 minutos' },
  validate: { xForwardedForHeader: false },
});
app.use('/api/', limiter);

app.use((req, res, next) => {
  if (!req.path.startsWith('/health')) {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

app.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  });
});

app.get('/health', async (req, res) => {
  const checks = { api: 'ok' };

  const dbCheck = withTimeout(pool.query('SELECT 1'), HEALTHCHECK_TIMEOUT_MS)
    .then(() => 'ok')
    .catch(() => 'error');

  const redisCheck = (async () => {
    let redisClient = null;
    try {
      redisClient = new Redis(config.redis.url, {
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });
      redisClient.on('error', () => {});
      await withTimeout(redisClient.connect(), HEALTHCHECK_TIMEOUT_MS);
      const pong = await withTimeout(redisClient.ping(), HEALTHCHECK_TIMEOUT_MS);
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    } finally {
      if (redisClient) redisClient.disconnect();
    }
  })();

  const aiProvider = (config.ai.provider || '').toLowerCase();
  const aiSupported = aiProvider === 'anthropic' || aiProvider === 'gemini';
  const aiConfigured =
    (aiProvider === 'anthropic' && Boolean(config.ai.anthropicApiKey)) ||
    (aiProvider === 'gemini' && Boolean(config.ai.geminiApiKey));
  checks.ai = !aiSupported
    ? `${aiProvider || 'unknown'}:unsupported`
    : aiConfigured
      ? `${aiProvider}:configured`
      : `${aiProvider}:not_configured`;

  const whatsappCheck = withTimeout(evolution.getConnectionStatus(), HEALTHCHECK_TIMEOUT_MS)
    .then((status) => status?.state || status?.instance?.state || 'unknown')
    .catch(() => 'unreachable');

  const [databaseStatus, redisStatus, whatsappStatus] = await Promise.all([
    dbCheck,
    redisCheck,
    whatsappCheck,
  ]);

  checks.database = databaseStatus;
  checks.redis = redisStatus;
  checks.whatsapp = whatsappStatus;

  const allOk = checks.database === 'ok' && checks.redis === 'ok';
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: checks,
  });
});

app.use('/api/auth', authOptional, authRoutes);
app.use('/api', authRequired, apiRoutes);
app.use('/webhooks', webhookRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada' });
});

app.use((err, req, res, next) => {
  logger.error('Erro nao tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

async function start() {
  try {
    logger.info('Migrando banco de dados...');
    await migrate();

    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`Dr. Lex API na porta ${config.port}`);
      logger.info(`Health: http://localhost:${config.port}/health`);
      logger.info(`API: http://localhost:${config.port}/api`);
      logger.info(`Webhooks: http://localhost:${config.port}/webhooks`);
    });
  } catch (err) {
    logger.error('Falha ao iniciar DrLex API:', err);
    process.exit(1);
  }
}

start();
