const express = require('express');
const contractAnalyzer = require('../services/contract-analyzer');
const deadlineManager = require('../services/deadline-manager');
const diarioMonitor = require('../services/diario-monitor');
const ai = require('../services/ai');
const logger = require('../utils/logger');

const router = express.Router();

function formatarDataISO(date) {
  const ano = String(date.getFullYear());
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function parseDataEntrada(data) {
  if (!data) return null;
  if (data instanceof Date) {
    return Number.isNaN(data.getTime()) ? null : new Date(data.getTime());
  }
  if (typeof data !== 'string') return null;

  const valor = data.trim();
  if (!valor) return null;

  // Aceita yyyy-mm-dd (input date do HTML).
  const isoDateOnly = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const parsed = new Date(`${valor}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Aceita dd/mm/yyyy (comum em formulários localizados pt-BR).
  const brDate = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDate) {
    const [, dia, mes, ano] = brDate;
    const parsed = new Date(`${ano}-${mes}-${dia}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(valor);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizarDataISO(data) {
  const parsed = parseDataEntrada(data);
  if (!parsed) return null;
  return formatarDataISO(parsed);
}

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
    const {
      userId,
      processNumber,
      description,
      deadlineDate,
      deadlineType,
      diasUteis,
      startDate,
      dataInicial,
      dias,
    } = req.body;

    if (!userId || !description) {
      return res.status(400).json({ error: 'userId e description sao obrigatorios' });
    }

    let resolvedDeadlineDate = normalizarDataISO(deadlineDate);

    // Compatibilidade com payload do frontend (startDate + dias).
    if (!resolvedDeadlineDate && (startDate || dataInicial) && dias !== undefined) {
      const dataBaseISO = normalizarDataISO(startDate || dataInicial);
      const diasNumero = parseInt(dias, 10);

      if (!dataBaseISO || !Number.isInteger(diasNumero) || diasNumero < 1) {
        return res.status(400).json({ error: 'startDate/dataInicial invalido ou dias invalido' });
      }

      const dataCalculada = diasUteis !== false
        ? deadlineManager.calcularPrazo(new Date(dataBaseISO), diasNumero)
        : deadlineManager.calcularPrazoCorridos(new Date(dataBaseISO), diasNumero);

      resolvedDeadlineDate = normalizarDataISO(dataCalculada);
    }

    if (!resolvedDeadlineDate) {
      return res.status(400).json({ error: 'deadlineDate ou startDate/dataInicial + dias sao obrigatorios' });
    }

    const deadline = await deadlineManager.create(userId, {
      processNumber,
      description,
      deadlineDate: resolvedDeadlineDate,
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
    const { diasUteis } = req.body;
    const dataInicial = req.body.dataInicial || req.body.startDate;
    const dias = parseInt(req.body.dias, 10);

    if (!dataInicial || !Number.isInteger(dias) || dias < 1) {
      return res.status(400).json({ error: 'dataInicial/startDate e dias sao obrigatorios' });
    }

    const dataInicialISO = normalizarDataISO(dataInicial);
    if (!dataInicialISO) {
      return res.status(400).json({ error: 'Data inicial invalida' });
    }

    const data = diasUteis !== false
      ? deadlineManager.calcularPrazo(new Date(dataInicialISO), dias)
      : deadlineManager.calcularPrazoCorridos(new Date(dataInicialISO), dias);

    const vencimento = normalizarDataISO(data);

    const payload = {
      dataInicial: dataInicialISO,
      startDate: dataInicialISO,
      dias,
      diasUteis: diasUteis !== false,
      vencimento,
      deadlineDate: vencimento,
      deadline_date: vencimento,
      vencimentoFormatado: data.toLocaleDateString('pt-BR'),
    };

    res.json({
      success: true,
      ...payload,
      data: payload,
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
