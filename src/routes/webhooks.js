const express = require('express');
const evolution = require('../integrations/evolution');
const chatHandler = require('../services/chat-handler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /webhooks/evolution
 * Recebe eventos da Evolution API (WhatsApp)
 */
router.post('/evolution', async (req, res) => {
  // Responder rápido para a Evolution não dar timeout
  res.status(200).json({ received: true });

  try {
    const parsed = evolution.parseWebhookMessage(req.body);

    if (!parsed) return;

    // Evento de conexão
    if (parsed.type === 'connection') {
      logger.info('WhatsApp connection update:', parsed.state);
      return;
    }

    // Ignorar mensagens de grupo (opcional)
    if (parsed.isGroup) return;

    logger.info('WhatsApp mensagem recebida', {
      from: parsed.from,
      name: parsed.pushName,
      text: parsed.text.substring(0, 100),
    });

    // Processar mensagem
    const response = await chatHandler.handle(parsed.text, {
      channel: 'whatsapp',
      remoteId: parsed.from,
      userName: parsed.pushName || 'Usuário',
    });

    // Verificar se a resposta inclui documento (ex: contrato gerado)
    if (response && typeof response === 'object' && response.document) {
      await evolution.sendText(parsed.from, response.text);
      try {
        await evolution.sendDocument(parsed.from, response.document.url, response.document.fileName, response.document.caption || '');
      } catch (docErr) {
        logger.warn('Falha ao enviar documento via WhatsApp, usando apenas link:', docErr.message);
      }
    } else {
      // Resposta simples de texto
      await evolution.sendText(parsed.from, typeof response === 'string' ? response : JSON.stringify(response));
    }
  } catch (err) {
    logger.error('Erro no webhook Evolution:', err.message);
  }
});

/**
 * GET /webhooks/evolution/status
 * Retorna status da conexão WhatsApp
 */
router.get('/evolution/status', async (req, res) => {
  try {
    const status = await evolution.getConnectionStatus();
    if (status?.state === 'error') {
      return res.status(502).json({ success: false, error: 'evolution_unreachable', data: status });
    }
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

/**
 * GET /webhooks/evolution/qrcode
 * Retorna QR Code para conectar WhatsApp
 */
router.get('/evolution/qrcode', async (req, res) => {
  try {
    const qr = await evolution.getQRCode();
    res.json({ success: true, data: qr });
  } catch (err) {
    const statusCode = err?.statusCode || err?.response?.status || 502;
    const details = err?.details || err?.response?.data || err?.message || 'unknown_error';
    res.status(statusCode === 0 ? 502 : statusCode).json({
      success: false,
      error: 'qrcode_unavailable',
      details,
      endpoint: err?.endpoint || null,
    });
  }
});

module.exports = router;
