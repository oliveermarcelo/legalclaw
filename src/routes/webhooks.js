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

    // Enviar resposta via Evolution
    await evolution.sendText(parsed.from, response);
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
    res.status(500).json({ error: 'Erro ao obter QR Code' });
  }
});

module.exports = router;
