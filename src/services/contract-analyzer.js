const ai = require('./ai');
const { pool } = require('../config/migrate');
const logger = require('../utils/logger');
const config = require('../config');

const CONTRACT_SYSTEM = `Voce e um especialista em analise contratual brasileira.

Ao analisar um contrato, forneca:
1. RESUMO: Visao geral do contrato (tipo, partes, objeto)
2. CLAUSULAS DE RISCO: Lista de clausulas problematicas com:
   - Numero/identificacao da clausula
   - Texto original resumido
   - Nivel de risco (CRITICO/ALTO/MEDIO/BAIXO)
   - Explicacao do risco
   - Artigo de lei violado ou relevante
   - Sugestao de correcao
3. PONTOS POSITIVOS: Clausulas bem redigidas
4. SCORE GERAL: Nota de 0-10 para seguranca do contrato
5. RECOMENDACAO FINAL: Assinar, revisar antes, ou nao assinar

Responda em JSON com esta estrutura:
{
  "resumo": { "tipo": "", "partes": [], "objeto": "", "valor": "", "vigencia": "" },
  "clausulas_risco": [
    { "clausula": "", "texto_resumido": "", "risco": "CRITICO|ALTO|MEDIO|BAIXO", "explicacao": "", "lei": "", "sugestao": "" }
  ],
  "pontos_positivos": [""],
  "score": 0,
  "recomendacao": ""
}`;

function hasStructuredContractShape(parsed) {
  return Boolean(
    parsed &&
    typeof parsed === 'object' &&
    parsed.resumo &&
    Array.isArray(parsed.clausulas_risco)
  );
}

function shouldAutoEscalateTo4o(modelConfig, requestedModel, contractTextLength) {
  if (requestedModel) return false;
  if (modelConfig.provider !== 'openai') return false;
  if (modelConfig.defaultModel !== 'gpt-4o-mini') return false;
  if (!modelConfig.availableModels.includes('gpt-4o')) return false;

  const threshold = Number(config.ai.openaiAutoEscalateChars || 18000);
  return Number.isFinite(threshold) && contractTextLength >= threshold;
}

/**
 * Analisa um contrato e salva no banco
 */
async function analyze(contractText, userId = null, title = '', options = {}, orgId = null) {
  logger.info('Iniciando analise de contrato', { userId, textLength: contractText.length });

  const modelConfig = ai.getModelConfig();
  const requestedModel = String(options?.model || '').trim();

  let selectedModel = requestedModel;
  let escalationReason = '';

  if (shouldAutoEscalateTo4o(modelConfig, requestedModel, contractText.length)) {
    selectedModel = 'gpt-4o';
    escalationReason = `texto_longo:${contractText.length}`;
    logger.info('Escalonando analise para gpt-4o por tamanho do contrato', {
      textLength: contractText.length,
      threshold: Number(config.ai.openaiAutoEscalateChars || 18000),
    });
  }

  const initialOptions = {
    ...options,
    ...(selectedModel ? { model: selectedModel } : {}),
  };

  let result = await ai.analyzeStructured(
    `Analise o seguinte contrato:\n\n${contractText}`,
    CONTRACT_SYSTEM,
    initialOptions
  );

  const canRetryWith4o = (
    !requestedModel &&
    modelConfig.provider === 'openai' &&
    modelConfig.defaultModel === 'gpt-4o-mini' &&
    modelConfig.availableModels.includes('gpt-4o') &&
    result.model !== 'gpt-4o'
  );

  if (canRetryWith4o && !hasStructuredContractShape(result.parsed)) {
    escalationReason = escalationReason || 'saida_estruturada_invalida';
    logger.warn('Reexecutando analise com gpt-4o por estrutura invalida no resultado inicial');
    result = await ai.analyzeStructured(
      `Analise o seguinte contrato:\n\n${contractText}`,
      CONTRACT_SYSTEM,
      { ...options, model: 'gpt-4o' }
    );
  }

  // Determinar nivel de risco geral
  let riskLevel = 'BAIXO';
  if (result.parsed) {
    const risks = result.parsed.clausulas_risco || [];
    const normalizeRisk = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    if (risks.some((r) => normalizeRisk(r.risco) === 'CRITICO')) riskLevel = 'CRITICO';
    else if (risks.some((r) => normalizeRisk(r.risco) === 'ALTO')) riskLevel = 'ALTO';
    else if (risks.some((r) => normalizeRisk(r.risco) === 'MEDIO')) riskLevel = 'MEDIO';
  }

  // Salvar no banco
  let contractId = null;
  if (userId) {
    try {
      const res = await pool.query(
        `INSERT INTO contracts (user_id, org_id, title, original_text, analysis, risk_level, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed') RETURNING id`,
        [
          userId,
          orgId || null,
          title || result.parsed?.resumo?.tipo || 'Contrato',
          contractText.substring(0, 10000),
          JSON.stringify(result.parsed || { raw: result.text }),
          riskLevel,
        ]
      );
      contractId = res.rows[0].id;
    } catch (err) {
      logger.error('Erro ao salvar contrato no banco:', err.message);
    }
  }

  return {
    id: contractId,
    analysis: result.parsed || { raw: result.text },
    riskLevel,
    model: result.model,
    autoEscalated: Boolean(escalationReason),
    escalationReason: escalationReason || null,
    usage: result.usage,
  };
}

/**
 * Retorna analise resumida para WhatsApp/Telegram (texto curto)
 */
async function analyzeForChat(contractText, options = {}) {
  const result = await ai.chat(
    `Analise este contrato de forma resumida (maximo 500 palavras), destacando os 3 maiores riscos e dando uma recomendacao clara:\n\n${contractText}`,
    CONTRACT_SYSTEM.split('Responda em JSON')[0], // Sem a parte de JSON
    [],
    options
  );
  return result.text;
}

/**
 * Lista contratos escopados por org (ou por usuário como fallback)
 */
async function listByUser(userId, limit = 20, orgId = null) {
  const filter = orgId ? 'org_id = $1' : 'user_id = $1';
  const param = orgId || userId;
  const res = await pool.query(
    `SELECT id, title, risk_level, status, created_at
     FROM contracts WHERE ${filter} ORDER BY created_at DESC LIMIT $2`,
    [param, limit]
  );
  return res.rows;
}

/**
 * Busca contrato por ID
 */
async function getById(contractId, userId, orgId = null) {
  const filter = orgId ? 'AND org_id = $2' : 'AND user_id = $2';
  const param = orgId || userId;
  const res = await pool.query(
    `SELECT * FROM contracts WHERE id = $1 ${filter}`,
    [contractId, param]
  );
  return res.rows[0] || null;
}

module.exports = { analyze, analyzeForChat, listByUser, getById };
