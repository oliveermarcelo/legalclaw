const cron = require('node-cron');

const config = require('./config');
const logger = require('./utils/logger');
const { pool } = require('./config/migrate');
const evolution = require('./integrations/evolution');
const telegram = require('./integrations/telegram');
const deadlineManager = require('./services/deadline-manager');
const diarioMonitor = require('./services/diario-monitor');

async function waitForDatabase(maxAttempts = 20, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      logger.info('Worker: banco disponivel');
      return;
    } catch (err) {
      logger.warn(`Worker: aguardando banco (${attempt}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Worker: banco indisponivel apos tentativas');
}

async function sendDeadlineAlerts() {
  logger.info('Worker: verificando prazos proximos');
  const upcoming = await deadlineManager.getUpcoming(3);

  for (const deadline of upcoming) {
    const message =
      `Prazo se aproximando\n\n` +
      `${deadline.description}\n` +
      `Vencimento: ${new Date(deadline.deadline_date).toLocaleDateString('pt-BR')}\n` +
      `Processo: ${deadline.process_number || 'N/A'}`;

    if (deadline.whatsapp) {
      try {
        await evolution.sendText(deadline.whatsapp, message);
      } catch (err) {
        logger.warn(`Worker: falha ao enviar prazo via WhatsApp (${deadline.id})`);
      }
    }

    if (deadline.telegram_id) {
      try {
        await telegram.sendMessage(deadline.telegram_id, message);
      } catch (err) {
        logger.warn(`Worker: falha ao enviar prazo via Telegram (${deadline.id})`);
      }
    }

    await deadlineManager.markNotified(deadline.id);
  }

  logger.info(`Worker: ${upcoming.length} alertas de prazo processados`);
}

async function sendDiarioAlerts() {
  logger.info('Worker: varredura de diarios oficiais');
  const alerts = await diarioMonitor.runScan();

  for (const alert of alerts) {
    const message =
      `Publicacao encontrada em ${alert.diario_type}\n\n` +
      `Palavra-chave: "${alert.matched_keyword}"\n` +
      `${(alert.excerpt || '').substring(0, 200)}\n` +
      `${alert.url}`;

    if (alert.whatsapp) {
      try {
        await evolution.sendText(alert.whatsapp, message);
      } catch (err) {
        logger.warn(`Worker: falha ao enviar diario via WhatsApp (${alert.id})`);
      }
    }

    if (alert.telegram_id) {
      try {
        await telegram.sendMessage(alert.telegram_id, message);
      } catch (err) {
        logger.warn(`Worker: falha ao enviar diario via Telegram (${alert.id})`);
      }
    }

    await diarioMonitor.markNotified(alert.id);
  }

  logger.info(`Worker: ${alerts.length} alertas de diario processados`);
}

function registerCronJobs() {
  // Todos os dias as 08:00
  cron.schedule('0 8 * * *', async () => {
    try {
      await sendDeadlineAlerts();
    } catch (err) {
      logger.error(`Worker: erro no cron de prazos: ${err.message}`);
    }
  });

  // Dias uteis as 07:00
  cron.schedule('0 7 * * 1-5', async () => {
    try {
      await sendDiarioAlerts();
    } catch (err) {
      logger.error(`Worker: erro no cron de diarios: ${err.message}`);
    }
  });
}

async function setupIntegrations() {
  if (config.evolution.apiKey) {
    try {
      await evolution.createInstance(config.evolution.webhookUrl || undefined);
      if (config.evolution.webhookUrl) {
        await evolution.setWebhook(config.evolution.webhookUrl);
      }
      const status = await evolution.getConnectionStatus();
      logger.info(`Worker: Evolution status ${status?.state || 'unknown'}`);
    } catch (err) {
      logger.warn(`Worker: Evolution indisponivel: ${err.message}`);
    }
  } else {
    logger.warn('Worker: EVOLUTION_API_KEY nao configurada');
  }

  if (config.telegram.botToken) {
    telegram.init();
  } else {
    logger.warn('Worker: TELEGRAM_BOT_TOKEN nao configurado');
  }
}

async function start() {
  try {
    await waitForDatabase();
    await setupIntegrations();
    registerCronJobs();
    logger.info('Worker: inicializado com sucesso');
  } catch (err) {
    logger.error('Worker: falha ao iniciar', err);
    process.exit(1);
  }
}

start();
