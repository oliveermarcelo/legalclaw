const { Telegraf } = require('telegraf');
const config = require('../config');
const logger = require('../utils/logger');
const chatHandler = require('../services/chat-handler');

let bot = null;

function init() {
  if (!config.telegram.botToken) {
    logger.warn('Telegram: Bot token não configurado, pulando inicialização');
    return null;
  }

  bot = new Telegraf(config.telegram.botToken);

  // Comando /start
  bot.start((ctx) => {
    const name = ctx.from.first_name || 'usuário';
    ctx.reply(
      `⚖️ *Bem-vindo ao Dr. Lex!*\n\n` +
      `Olá, ${name}! Sou seu assistente jurídico com IA.\n\n` +
      `📋 *O que posso fazer:*\n` +
      `• Analisar contratos (envie o texto)\n` +
      `• Calcular prazos processuais\n` +
      `• Monitorar Diários Oficiais\n` +
      `• Tirar dúvidas jurídicas\n\n` +
      `💡 *Comandos:*\n` +
      `/contrato - Analisar um contrato\n` +
      `/prazo - Calcular prazo processual\n` +
      `/diario - Configurar monitor de diário\n` +
      `/ajuda - Ver todos os comandos\n\n` +
      `Envie sua mensagem ou comando para começar!`,
      { parse_mode: 'Markdown' }
    );
  });

  // Comando /ajuda
  bot.help((ctx) => {
    ctx.reply(
      `⚖️ *Comandos do Dr. Lex*\n\n` +
      `/contrato - Iniciar análise de contrato\n` +
      `/prazo [tipo] [data] - Calcular prazo\n` +
      `  Ex: /prazo contestacao 2025-03-01\n` +
      `/diario [palavra-chave] - Buscar no DOU\n` +
      `/prazos - Ver meus prazos ativos\n` +
      `/ajuda - Esta mensagem\n\n` +
      `💡 Ou simplesmente envie uma pergunta jurídica!`,
      { parse_mode: 'Markdown' }
    );
  });

  // Mensagens de texto livres
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const telegramId = String(ctx.from.id);

    // Ignorar comandos (já tratados acima)
    if (text.startsWith('/')) return;

    try {
      ctx.sendChatAction('typing');
      const response = await chatHandler.handle(text, {
        channel: 'telegram',
        remoteId: telegramId,
        userName: ctx.from.first_name || 'Usuário',
      });
      await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('Erro ao processar mensagem Telegram:', err.message);
      await ctx.reply('Desculpe, ocorreu um erro. Tente novamente em instantes.');
    }
  });

  // Iniciar bot
  bot.launch()
    .then(() => logger.info('Telegram bot iniciado'))
    .catch((err) => logger.error('Erro ao iniciar Telegram bot:', err.message));

  // Graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}

/**
 * Envia mensagem para um usuário do Telegram
 */
async function sendMessage(telegramId, text) {
  if (!bot) return;
  try {
    await bot.telegram.sendMessage(telegramId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Erro ao enviar mensagem Telegram:', err.message);
  }
}

module.exports = { init, sendMessage };
