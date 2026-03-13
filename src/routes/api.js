const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const contractAnalyzer = require('../services/contract-analyzer');
const deadlineManager = require('../services/deadline-manager');
const diarioMonitor = require('../services/diario-monitor');
const knowledgeBase = require('../services/knowledge-base');
const ai = require('../services/ai');
const legalWorkflows = require('../services/legal-workflows');
const externalLegalSearch = require('../services/external-legal-search');
const prospecting = require('../services/prospecting');
const contractGenerator = require('../services/contract-generator');
const logger = require('../utils/logger');

const router = express.Router();
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Apenas arquivos PDF sao permitidos'));
      return;
    }
    cb(null, true);
  },
});

function uploadPdfMiddleware(req, res, next) {
  uploadPdf.single('file')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'PDF excede o limite de 10MB' });
        return;
      }
      res.status(400).json({ error: err.message || 'Falha no upload do PDF' });
      return;
    }

    res.status(400).json({ error: err.message || 'Falha no upload do PDF' });
  });
}

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

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  const cleaned = history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({
      role: item.role,
      content: String(item.content || '').trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-16);

  // Anthropic costuma rejeitar historico iniciado por assistant.
  while (cleaned.length > 0 && cleaned[0].role !== 'user') {
    cleaned.shift();
  }

  // Evita sequencias repetidas da mesma role.
  const collapsed = [];
  for (const item of cleaned) {
    const last = collapsed[collapsed.length - 1];
    if (last && last.role === item.role) {
      last.content = `${last.content}\n\n${item.content}`.trim();
    } else {
      collapsed.push({ ...item });
    }
  }

  return collapsed.slice(-12);
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
    const { text, userId, title, model } = req.body;
    const resolvedUserId = req.user?.userId || userId || null;
    if (!text || text.length < 50) {
      return res.status(400).json({ error: 'Texto do contrato muito curto (mínimo 50 caracteres)' });
    }
    const result = await contractAnalyzer.analyze(text, resolvedUserId, title || '', { model });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Erro na análise de contrato:', err.message);
    res.status(500).json({ error: 'Erro ao analisar contrato' });
  }
});

/**
 * POST /api/contracts/analyze/pdf
 * Analisa um contrato em PDF (multipart/form-data, campo "file")
 */
router.post('/contracts/analyze/pdf', uploadPdfMiddleware, async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Arquivo PDF nao enviado' });
    }

    const resolvedUserId = req.user?.userId || req.body.userId || null;
    const parsed = await pdfParse(req.file.buffer);
    const extractedText = String(parsed?.text || '').replace(/\u0000/g, ' ').trim();

    if (extractedText.length < 50) {
      return res.status(400).json({ error: 'Nao foi possivel extrair texto suficiente do PDF' });
    }

    const title = req.body.title || req.file.originalname || 'Contrato PDF';
    const result = await contractAnalyzer.analyze(
      extractedText,
      resolvedUserId,
      title,
      { model: req.body.model }
    );

    res.json({
      success: true,
      data: {
        ...result,
        source: 'pdf',
        fileName: req.file.originalname,
        pages: parsed?.numpages || null,
        extractedChars: extractedText.length,
      },
    });
  } catch (err) {
    logger.error('Erro na analise de contrato PDF:', err.message);
    res.status(500).json({ error: 'Erro ao analisar contrato PDF' });
  }
});

/**
 * GET /api/contracts/:userId
 * Lista contratos de um usuario
 */
router.get('/contracts/:userId', async (req, res) => {
  try {
    const contracts = await contractAnalyzer.listByUser(parseInt(req.params.userId));
    res.json({ success: true, data: contracts });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar contratos' });
  }
});

/**
 * GET /api/contracts/generate/types
 * Lista tipos de contratos disponíveis
 */
router.get('/contracts/generate/types', (req, res) => {
  const types = Object.entries(contractGenerator.CONTRACT_TYPES).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    hints: cfg.hints,
  }));
  res.json({ success: true, data: types });
});

/**
 * POST /api/contracts/generate
 * Gera um contrato via IA e retorna o PDF
 */
router.post('/contracts/generate', async (req, res) => {
  try {
    const { type, details } = req.body;
    if (!type) return res.status(400).json({ error: 'Tipo de contrato é obrigatório' });
    if (!details) return res.status(400).json({ error: 'Detalhes do contrato são obrigatórios' });

    const result = await contractGenerator.generate({
      type,
      details,
      userId: req.user?.userId || null,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Erro ao gerar contrato:', err.message);
    res.status(500).json({ error: err.message || 'Erro ao gerar contrato' });
  }
});

/**
 * GET /api/contracts/generated
 * Lista contratos gerados pelo usuário
 */
router.get('/contracts/generated', async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });
    const list = await contractGenerator.listGenerated(userId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar contratos gerados' });
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
    const keyword = req.body.keyword || req.body.query || req.body.term;
    if (!keyword) return res.status(400).json({ error: 'keyword é obrigatório' });
    const results = await diarioMonitor.searchDOU(keyword);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ error: 'Erro na busca' });
  }
});

// ============================================================
// BASE DE CONHECIMENTO (RAG)
// ============================================================

/**
 * POST /api/knowledge/sources
 * Cria nova fonte da base de conhecimento
 */
router.post('/knowledge/sources', async (req, res) => {
  try {
    const { title, content, sourceType, sourceRef, metadata } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'title e content sao obrigatorios' });
    }

    const source = await knowledgeBase.createSource({
      title,
      content,
      sourceType,
      sourceRef,
      metadata,
      createdBy: req.user?.userId || null,
    });

    res.json({ success: true, data: source });
  } catch (err) {
    logger.error('Erro ao criar fonte de conhecimento:', err.message);

    if (err.message?.includes('obrigatorio') || err.message?.includes('curto')) {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: 'Erro ao criar fonte de conhecimento' });
  }
});

/**
 * GET /api/knowledge/sources
 * Lista fontes da base de conhecimento do usuario
 */
router.get('/knowledge/sources', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const sources = await knowledgeBase.listSources(limit, req.user?.userId || null);
    res.json({ success: true, data: sources });
  } catch (err) {
    logger.error('Erro ao listar fontes de conhecimento:', err.message);
    res.status(500).json({ error: 'Erro ao listar fontes de conhecimento' });
  }
});

/**
 * PATCH /api/knowledge/sources/:id/active
 * Ativa ou desativa uma fonte
 */
router.patch('/knowledge/sources/:id/active', async (req, res) => {
  try {
    const sourceId = parseInt(req.params.id, 10);
    const { active } = req.body;

    if (!Number.isInteger(sourceId) || sourceId < 1) {
      return res.status(400).json({ error: 'id invalido' });
    }

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active deve ser boolean' });
    }

    const source = await knowledgeBase.setSourceActive(
      sourceId,
      active,
      req.user?.userId || null
    );

    if (!source) {
      return res.status(404).json({ error: 'Fonte nao encontrada' });
    }

    res.json({ success: true, data: source });
  } catch (err) {
    logger.error('Erro ao alterar status da fonte:', err.message);
    res.status(500).json({ error: 'Erro ao alterar status da fonte' });
  }
});

/**
 * POST /api/knowledge/search
 * Busca na base de conhecimento do usuario
 */
router.post('/knowledge/search', async (req, res) => {
  try {
    const { query, limit } = req.body;

    if (!query || String(query).trim().length < 3) {
      return res.status(400).json({ error: 'query deve ter pelo menos 3 caracteres' });
    }

    const hits = await knowledgeBase.search(
      String(query),
      limit || 5,
      req.user?.userId || null
    );

    res.json({ success: true, data: hits });
  } catch (err) {
    logger.error('Erro na busca da base de conhecimento:', err.message);
    res.status(500).json({ error: 'Erro na busca da base de conhecimento' });
  }
});

// ============================================================
// CHAT (IA)
// ============================================================

// ============================================================
// CONSULTAS EXTERNAS (SISTEMAS JURIDICOS)
// ============================================================

/**
 * GET /api/external/providers/status
 * Status das integracoes externas juridicas
 */
router.get('/external/providers/status', (req, res) => {
  try {
    res.json({
      success: true,
      data: externalLegalSearch.getProviderStatus(),
    });
  } catch (err) {
    logger.error('Erro ao consultar status de providers externos:', err.message);
    res.status(500).json({ error: 'Erro ao consultar status de providers externos' });
  }
});

/**
 * POST /api/external/processes/by-cnj
 * Consulta processo externo por numero CNJ
 */
router.post('/external/processes/by-cnj', async (req, res) => {
  try {
    const { numeroCnj, tribunalAlias, size, from } = req.body;
    const result = await externalLegalSearch.searchProcessByCnj(
      numeroCnj,
      { tribunalAlias, size, from },
      req.user?.userId || null
    );
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Erro na consulta externa por CNJ:', err.message);
    res.status(400).json({ error: err.message || 'Erro na consulta externa por CNJ' });
  }
});

/**
 * POST /api/external/processes/search
 * Busca avancada no DataJud por filtros
 */
router.post('/external/processes/search', async (req, res) => {
  try {
    const result = await externalLegalSearch.searchProcesses(
      req.body || {},
      req.user?.userId || null
    );
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Erro na busca avancada DataJud:', err.message);
    res.status(400).json({ error: err.message || 'Erro na busca avancada DataJud' });
  }
});

/**
 * POST /api/external/processes/request-refresh
 * Endpoint mantido para compatibilidade
 */
router.post('/external/processes/request-refresh', (req, res) => {
  res.status(400).json({
    error: 'DataJud API publica nao suporta solicitacao de atualizacao de processo por este endpoint.',
  });
});

/**
 * POST /api/external/processes/refresh-status
 * Endpoint mantido para compatibilidade
 */
router.post('/external/processes/refresh-status', (req, res) => {
  res.status(400).json({
    error: 'DataJud API publica nao suporta consulta de status de atualizacao por este endpoint.',
  });
});

/**
 * GET /api/workflows/modes
 * Lista modos especializados dos fluxos juridicos
 */
router.get('/workflows/modes', (req, res) => {
  try {
    res.json({
      success: true,
      data: legalWorkflows.listModes(),
    });
  } catch (err) {
    logger.error('Erro ao listar modos de workflow:', err.message);
    res.status(500).json({ error: 'Erro ao listar modos de workflow' });
  }
});

/**
 * POST /api/workflows/run
 * Executa fluxo juridico especializado
 */
router.post('/workflows/run', async (req, res) => {
  try {
    const {
      mode,
      objective,
      context,
      documentText,
      audience,
      desiredOutput,
      model,
    } = req.body;

    const result = await legalWorkflows.runWorkflow({
      mode,
      objective,
      context,
      documentText,
      audience,
      desiredOutput,
      model,
      userId: req.user?.userId || null,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Erro no workflow juridico:', err.message);
    if (/invalido|exige|Informe/.test(err.message || '')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Erro no workflow juridico' });
  }
});

/**
 * GET /api/chat/models
 * Lista modelos disponiveis para o provider atual
 */
router.get('/chat/models', (req, res) => {
  try {
    const modelConfig = ai.getModelConfig();
    res.json({
      success: true,
      data: {
        provider: modelConfig.provider,
        defaultModel: modelConfig.defaultModel,
        models: modelConfig.availableModels,
      },
    });
  } catch (err) {
    logger.error('Erro ao listar modelos de chat:', err.message);
    res.status(500).json({ error: 'Erro ao listar modelos de chat' });
  }
});

/**
 * GET /api/prospecting/specialties
 * Lista especialidades disponíveis para prospecção
 */
router.get('/prospecting/specialties', (req, res) => {
  const specialties = Object.entries(prospecting.SPECIALTY_TERMS).map(([key, val]) => ({
    key,
    label: val.label,
  }));
  res.json({ success: true, data: specialties });
});

/**
 * GET /api/prospecting/history
 * Histórico de buscas de prospecção do usuário
 */
router.get('/prospecting/history', async (req, res) => {
  try {
    const userId = req.user?.userId || null;
    if (!userId) return res.status(401).json({ error: 'Autenticação necessária' });
    const history = await prospecting.listSearchHistory(userId, 20);
    res.json({ success: true, data: history });
  } catch (err) {
    logger.error('Erro ao buscar histórico de prospecção:', err.message);
    res.status(500).json({ error: 'Erro ao carregar histórico' });
  }
});

/**
 * POST /api/prospecting/search
 * Busca oportunidades de prospecção jurídica
 */
router.post('/prospecting/search', async (req, res) => {
  try {
    const { tribunalAlias, specialty, size, monthsBack, uf } = req.body;
    if (!tribunalAlias) return res.status(400).json({ error: 'tribunalAlias é obrigatório' });
    if (!specialty) return res.status(400).json({ error: 'specialty é obrigatório' });

    const result = await prospecting.searchOpportunities({
      tribunalAlias,
      specialty,
      size,
      monthsBack,
      uf: uf || null,
      userId: req.user?.userId || null,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Erro na prospecção:', err.message);
    if (/Selecione|Informe|obrigatório/i.test(err.message || '')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Erro na prospecção' });
  }
});

/**
 * POST /api/chat
 * Conversa direta com o assistente
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history, model } = req.body;
    if (!message) return res.status(400).json({ error: 'message e obrigatorio' });

    const safeHistory = normalizeHistory(history);
    let sources = [];
    let systemPromptExtra = '';

    try {
      const hits = await knowledgeBase.search(
        String(message),
        5,
        req.user?.userId || null
      );

      if (hits.length > 0) {
        const built = knowledgeBase.buildContext(hits);
        sources = built.sources;

        systemPromptExtra = `
Use APENAS as fontes abaixo como base principal da resposta quando forem relevantes.
Se usar uma fonte, cite no texto como [Fonte 1], [Fonte 2], etc.
Se a informacao nao estiver nas fontes, diga explicitamente que a base nao cobre esse ponto.

${built.context}
        `.trim();
      }
    } catch (knowledgeErr) {
      logger.warn(`Falha ao carregar contexto RAG no chat: ${knowledgeErr.message}`);
    }

    const result = await ai.chat(String(message), systemPromptExtra, safeHistory, { model });
    res.json({
      success: true,
      data: {
        ...result,
        sources,
      },
    });
  } catch (err) {
    logger.error('Erro no chat:', err.message);
    res.status(500).json({ error: err.message || 'Erro na conversa' });
  }
});

module.exports = router;

