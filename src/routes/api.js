const express = require('express');
const contractAnalyzer = require('../services/contract-analyzer');
const deadlineManager = require('../services/deadline-manager');
const diarioMonitor = require('../services/diario-monitor');
const ai = require('../services/ai');
const logger = require('../utils/logger');

const router = express.Router();

// ============================================================
// CONTRATOS
// ============================================================

/**
 * POST /api/contracts/analyze
 * Analisa um contrato
 */
router.post('/contracts/analyze', async (req, res) => {
  try {
    const { text, userId } = req.body;
    if (!text || text.length < 50) {
      return res.status(400).json({ error: 'Texto do contrato muito curto (mínimo 50 caracteres)' });
    }
    const result = await contractAnalyzer.analyze(text, userId || null);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Erro na análise de contrato:', err.message);
    res.status(500).json({ error: 'Erro ao analisar contrato' });
  }
});

/**
 * GET /api/contracts/:userId
 * Lista contratos de um usuário
 */
router.get('/contracts/:userId', async (req, res) => {
  try {
    const contracts = await contractAnalyzer.listByUser(parseInt(req.params.userId));
    res.json({ success: true, data: contracts });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar contratos' });
  }
});

// ============================================================
// PRAZOS
// ============================================================

/**
 * POST /api/deadlines
 * Cria um novo prazo
 */
router.post('/deadlines', async (req, res) => {
  try {
    const { userId, processNumber, description, deadlineDate, deadlineType, diasUteis } = req.body;
    if (!userId || !description || !deadlineDate) {
      return res.status(400).json({ error: 'userId, description e deadlineDate são obrigatórios' });
    }
    const deadline = await deadlineManager.create(userId, {
      processNumber,
      description,
      deadlineDate,
      deadlineType,
      diasUteis,
    });
    res.json({ success: true, data: deadline });
  } catch (err) {
    logger.error('Erro ao criar prazo:', err.message);
    res.status(500).json({ error: 'Erro ao criar prazo' });
  }
});

/**
 * GET /api/deadlines/:userId
 * Lista prazos ativos
 */
router.get('/deadlines/:userId', async (req, res) => {
  try {
    const deadlines = await deadlineManager.listActive(parseInt(req.params.userId));
    res.json({ success: true, data: deadlines });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar prazos' });
  }
});

/**
 * POST /api/deadlines/calculate
 * Calcula prazo sem salvar
 */
router.post('/deadlines/calculate', (req, res) => {
  try {
    const { dataInicial, diasUteis, dias } = req.body;
    if (!dataInicial || !dias) {
      return res.status(400).json({ error: 'dataInicial e dias são obrigatórios' });
    }
    const data = diasUteis !== false
      ? deadlineManager.calcularPrazo(new Date(dataInicial), dias)
      : deadlineManager.calcularPrazoCorridos(new Date(dataInicial), dias);

    res.json({
      success: true,
      data: {
        dataInicial,
        dias,
        diasUteis: diasUteis !== false,
        vencimento: data.toISOString().split('T')[0],
        vencimentoFormatado: data.toLocaleDateString('pt-BR'),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao calcular prazo' });
  }
});

/**
 * GET /api/deadlines/tipos/cpc
 * Lista prazos padrão do CPC
 */
router.get('/deadlines/tipos/cpc', (req, res) => {
  res.json({ success: true, data: deadlineManager.PRAZOS_CPC });
});

// ============================================================
// DIÁRIOS OFICIAIS
// ============================================================

/**
 * POST /api/diarios/monitor
 * Cria monitor de diário oficial
 */
router.post('/diarios/monitor', async (req, res) => {
  try {
    const { userId, keywords, diarioType } = req.body;
    if (!userId || !keywords || !diarioType) {
      return res.status(400).json({ error: 'userId, keywords e diarioType são obrigatórios' });
    }
    const monitor = await diarioMonitor.createMonitor(userId, { keywords, diarioType });
    res.json({ success: true, data: monitor });
  } catch (err) {
    logger.error('Erro ao criar monitor:', err.message);
    res.status(500).json({ error: 'Erro ao criar monitor' });
  }
});

/**
 * GET /api/diarios/monitors/:userId
 */
router.get('/diarios/monitors/:userId', async (req, res) => {
  try {
    const monitors = await diarioMonitor.listMonitors(parseInt(req.params.userId));
    res.json({ success: true, data: monitors });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar monitores' });
  }
});

/**
 * POST /api/diarios/search
 * Busca pontual no DOU
 */
router.post('/diarios/search', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'keyword é obrigatório' });
    const results = await diarioMonitor.searchDOU(keyword);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ error: 'Erro na busca' });
  }
});

// ============================================================
// CHAT (IA)
// ============================================================

/**
 * POST /api/chat
 * Conversa direta com o assistente
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'message é obrigatório' });
    const result = await ai.chat(message, '', history || []);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Erro no chat:', err.message);
    res.status(500).json({ error: 'Erro na conversa' });
  }
});

module.exports = router;
