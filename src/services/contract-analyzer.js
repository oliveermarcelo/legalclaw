const ai = require('./ai');
const { pool } = require('../config/migrate');
const logger = require('../utils/logger');

const CONTRACT_SYSTEM = `Você é um especialista em análise contratual brasileira.

Ao analisar um contrato, forneça:
1. RESUMO: Visão geral do contrato (tipo, partes, objeto)
2. CLÁUSULAS DE RISCO: Lista de cláusulas problemáticas com:
   - Número/identificação da cláusula
   - Texto original resumido
   - Nível de risco (CRÍTICO/ALTO/MÉDIO/BAIXO)
   - Explicação do risco
   - Artigo de lei violado ou relevante
   - Sugestão de correção
3. PONTOS POSITIVOS: Cláusulas bem redigidas
4. SCORE GERAL: Nota de 0-10 para segurança do contrato
5. RECOMENDAÇÃO FINAL: Assinar, revisar antes, ou não assinar

Responda em JSON com esta estrutura:
{
  "resumo": { "tipo": "", "partes": [], "objeto": "", "valor": "", "vigencia": "" },
  "clausulas_risco": [
    { "clausula": "", "texto_resumido": "", "risco": "CRÍTICO|ALTO|MÉDIO|BAIXO", "explicacao": "", "lei": "", "sugestao": "" }
  ],
  "pontos_positivos": [""],
  "score": 0,
  "recomendacao": ""
}`;

/**
 * Analisa um contrato e salva no banco
 */
async function analyze(contractText, userId = null) {
  logger.info('Iniciando análise de contrato', { userId, textLength: contractText.length });

  const result = await ai.analyzeStructured(
    `Analise o seguinte contrato:\n\n${contractText}`,
    CONTRACT_SYSTEM
  );

  // Determinar nível de risco geral
  let riskLevel = 'BAIXO';
  if (result.parsed) {
    const risks = result.parsed.clausulas_risco || [];
    if (risks.some((r) => r.risco === 'CRÍTICO')) riskLevel = 'CRÍTICO';
    else if (risks.some((r) => r.risco === 'ALTO')) riskLevel = 'ALTO';
    else if (risks.some((r) => r.risco === 'MÉDIO')) riskLevel = 'MÉDIO';
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
          result.parsed?.resumo?.tipo || 'Contrato',
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
    usage: result.usage,
  };
}

/**
 * Retorna análise resumida para WhatsApp/Telegram (texto curto)
 */
async function analyzeForChat(contractText) {
  const result = await ai.chat(
    `Analise este contrato de forma resumida (máximo 500 palavras), destacando os 3 maiores riscos e dando uma recomendação clara:\n\n${contractText}`,
    CONTRACT_SYSTEM.split('Responda em JSON')[0] // Sem a parte de JSON
  );
  return result.text;
}

/**
 * Lista contratos de um usuário
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
