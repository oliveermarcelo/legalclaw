const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const api = axios.create({
  baseURL: config.evolution.apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const INSTANCE = config.evolution.instance;
const API_KEY = config.evolution.apiKey;

function authStrategies() {
  if (!API_KEY) return [{}];

  return [
    {
      headers: {
        apikey: API_KEY,
        'x-api-key': API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
    },
    {
      headers: {
        Authorization: API_KEY,
      },
    },
    {
      params: { apikey: API_KEY },
    },
    {
      params: { token: API_KEY },
    },
  ];
}

async function evolutionRequest(method, url, { data, params } = {}) {
  const strategies = authStrategies();
  let lastAuthError = null;

  for (const strategy of strategies) {
    try {
      return await api.request({
        method,
        url,
        data,
        headers: strategy.headers || undefined,
        params: {
          ...(params || {}),
          ...(strategy.params || {}),
        },
      });
    } catch (err) {
      const statusCode = err.response?.status || 0;
      const isAuthError = statusCode === 401 || statusCode === 403;

      if (isAuthError) {
        lastAuthError = err;
        continue;
      }

      throw err;
    }
  }

  if (lastAuthError) throw lastAuthError;
  throw new Error('Evolution request failed without response');
}

// ============================================================
// GESTÃO DE INSTÂNCIA
// ============================================================

/**
 * Cria a instância do DrLex na Evolution API
 */
async function createInstance(webhookUrl) {
  try {
    const response = await evolutionRequest('post', '/instance/create', {
      data: {
        instanceName: INSTANCE,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: webhookUrl
          ? {
              url: webhookUrl,
              webhook_by_events: true,
              events: [
                'messages.upsert',
                'connection.update',
                'messages.update',
              ],
            }
          : undefined,
      },
    });
    logger.info('Instância Evolution criada:', INSTANCE);
    return response.data;
  } catch (err) {
    // Se já existe, tudo bem
    if (err.response?.status === 409 || err.response?.data?.message?.includes('already')) {
      logger.info('Instância Evolution já existe:', INSTANCE);
      return { exists: true };
    }
    logger.error('Erro ao criar instância Evolution:', err.message);
    throw err;
  }
}

/**
 * Retorna QR Code para conexão
 */
async function getQRCode() {
  try {
    const response = await evolutionRequest('get', `/instance/connect/${INSTANCE}`);
    return response.data;
  } catch (err) {
    logger.error('Erro ao obter QR Code:', err.message);
    throw err;
  }
}

/**
 * Verifica status da conexão
 */
async function getConnectionStatus() {
  try {
    const response = await evolutionRequest('get', `/instance/connectionState/${INSTANCE}`);
    return response.data;
  } catch (err) {
    const statusCode = err.response?.status || 0;
    const details = err.response?.data?.message || err.response?.data || err.message;
    logger.error('Erro ao verificar status Evolution:', {
      statusCode,
      details,
    });
    return {
      state: 'error',
      statusCode,
      details,
    };
  }
}

/**
 * Configura webhook da instância
 */
async function setWebhook(url) {
  try {
    const response = await evolutionRequest('post', `/webhook/set/${INSTANCE}`, {
      data: {
        url,
        webhook_by_events: true,
        events: [
          'messages.upsert',
          'connection.update',
          'messages.update',
        ],
      },
    });
    logger.info('Webhook configurado:', url);
    return response.data;
  } catch (err) {
    logger.error('Erro ao configurar webhook:', err.message);
    throw err;
  }
}

// ============================================================
// ENVIO DE MENSAGENS
// ============================================================

/**
 * Envia mensagem de texto
 * @param {string} to - Número no formato "5511999999999" (sem +)
 * @param {string} text - Texto da mensagem
 */
async function sendText(to, text) {
  try {
    // Garantir formato correto do número
    const number = to.replace(/\D/g, '');

    const response = await evolutionRequest('post', `/message/sendText/${INSTANCE}`, {
      data: {
        number,
        text,
      },
    });
    logger.debug('Mensagem enviada via Evolution', { to: number });
    return response.data;
  } catch (err) {
    logger.error('Erro ao enviar mensagem:', err.message, { to });
    throw err;
  }
}

/**
 * Envia mensagem com botões
 */
async function sendButtons(to, title, description, buttons) {
  try {
    const number = to.replace(/\D/g, '');
    const response = await evolutionRequest('post', `/message/sendButtons/${INSTANCE}`, {
      data: {
        number,
        title,
        description,
        buttons: buttons.map((btn, i) => ({
          buttonId: `btn_${i}`,
          buttonText: { displayText: btn },
          type: 1,
        })),
      },
    });
    return response.data;
  } catch (err) {
    logger.error('Erro ao enviar botões:', err.message);
    // Fallback: enviar como texto simples
    const fallbackText = `${title}\n${description}\n\n${buttons.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;
    return sendText(to, fallbackText);
  }
}

/**
 * Envia mensagem com lista
 */
async function sendList(to, title, description, buttonText, sections) {
  try {
    const number = to.replace(/\D/g, '');
    const response = await evolutionRequest('post', `/message/sendList/${INSTANCE}`, {
      data: {
        number,
        title,
        description,
        buttonText,
        sections,
      },
    });
    return response.data;
  } catch (err) {
    logger.error('Erro ao enviar lista:', err.message);
    // Fallback para texto
    const items = sections.flatMap((s) =>
      s.rows.map((r) => `• ${r.title}${r.description ? ` - ${r.description}` : ''}`)
    );
    return sendText(to, `${title}\n${description}\n\n${items.join('\n')}`);
  }
}

/**
 * Envia documento/arquivo
 */
async function sendDocument(to, url, fileName, caption = '') {
  try {
    const number = to.replace(/\D/g, '');
    const response = await evolutionRequest('post', `/message/sendMedia/${INSTANCE}`, {
      data: {
        number,
        mediatype: 'document',
        media: url,
        fileName,
        caption,
      },
    });
    return response.data;
  } catch (err) {
    logger.error('Erro ao enviar documento:', err.message);
    throw err;
  }
}

// ============================================================
// PROCESSAMENTO DE WEBHOOKS
// ============================================================

/**
 * Extrai dados relevantes de um evento de webhook da Evolution
 */
function parseWebhookMessage(body) {
  try {
    // Evolution API v2 formato de webhook
    const data = body.data || body;

    // Verificar se é mensagem recebida
    if (body.event === 'messages.upsert') {
      const msg = data.message || data;
      const key = msg.key || data.key || {};

      // Ignorar mensagens enviadas por nós
      if (key.fromMe) return null;

      // Extrair número do remetente
      const remoteJid = key.remoteJid || '';
      const from = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

      // Extrair texto da mensagem
      let text = '';
      const message = msg.message || {};

      if (message.conversation) {
        text = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        text = message.extendedTextMessage.text;
      } else if (message.buttonsResponseMessage?.selectedButtonId) {
        text = message.buttonsResponseMessage.selectedButtonId;
      } else if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
        text = message.listResponseMessage.singleSelectReply.selectedRowId;
      } else if (message.documentMessage || message.imageMessage) {
        text = '[ARQUIVO_RECEBIDO]';
      }

      if (!text || !from) return null;

      return {
        from,
        text: text.trim(),
        messageId: key.id,
        isGroup: remoteJid.includes('@g.us'),
        pushName: data.pushName || msg.pushName || '',
        timestamp: msg.messageTimestamp || Date.now(),
      };
    }

    // Evento de conexão
    if (body.event === 'connection.update') {
      return {
        type: 'connection',
        state: data.state || data.status,
      };
    }

    return null;
  } catch (err) {
    logger.error('Erro ao parsear webhook Evolution:', err.message);
    return null;
  }
}

module.exports = {
  createInstance,
  getQRCode,
  getConnectionStatus,
  setWebhook,
  sendText,
  sendButtons,
  sendList,
  sendDocument,
  parseWebhookMessage,
};
