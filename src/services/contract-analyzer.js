const ai = require('./ai');
const { pool } = require('../config/migrate');
const logger = require('../utils/logger');

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

/**
 * Analisa um contrato e salva no banco
 */
async function analyze(contractText, userId = null, title = '', options = {}) {
  logger.info('Iniciando analise de contrato', { userId, textLength: contractText.length });

  const result = await ai.analyzeStructured(
    `Analise o seguinte contrato:\n\n${contractText}`,
    CONTRACT_SYSTEM,
    options
  );

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
        `INSERT INTO contracts (user_id, title, original_text, analysis, risk_level, status)
         VALUES ($1, $2, $3, $4, $5, 'completed') RETURNING id`,
        [
          userId,
          title || result.parsed?.resumo?.tipo || 'Contrato',
          contractText.substring(0, 10000), // limitar tamanho
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
 * Lista contratos de um usuario
 */
async function listByUser(userId, limit = 20) {
  const res = await pool.query(
    `SELECT id, title, risk_level, status, created_at
     FROM contracts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return res.rows;
}

/**
 * Busca contrato por ID
 */
async function getById(contractId, userId) {
  const res = await pool.query(
    `SELECT * FROM contracts WHERE id = $1 AND user_id = $2`,
    [contractId, userId]
  );
  return res.rows[0] || null;
}

module.exports = { analyze, analyzeForChat, listByUser, getById };
