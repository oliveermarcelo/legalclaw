const { searchProcesses } = require('./external-legal-search');
const ai = require('./ai');
const { pool } = require('../config/migrate');
const logger = require('../utils/logger');

// Mapeamento de especialidades para termos de busca
const SPECIALTY_TERMS = {
  trabalhista: { termoLivre: 'reclamação trabalhista rescisão FGTS aviso prévio', label: 'Trabalhista' },
  previdenciario: { termoLivre: 'aposentadoria benefício previdenciário INSS auxílio doença', label: 'Previdenciário' },
  civil: { termoLivre: 'indenização danos morais responsabilidade civil contrato', label: 'Civil' },
  tributario: { termoLivre: 'tributo IPTU ISS ICMS execução fiscal parcelamento', label: 'Tributário' },
  consumidor: { termoLivre: 'consumidor CDC produto defeito negativação indevida', label: 'Consumidor' },
  familia: { termoLivre: 'divórcio alimentos guarda inventário partilha', label: 'Família' },
  criminal: { termoLivre: 'estelionato furto roubo homicídio habeas corpus', label: 'Criminal' },
  empresarial: { termoLivre: 'recuperação judicial falência dissolução sociedade', label: 'Empresarial' },
  imobiliario: { termoLivre: 'usucapião despejo posse propriedade imóvel', label: 'Imobiliário' },
  ambiental: { termoLivre: 'meio ambiente licença ambiental poluição área de preservação', label: 'Ambiental' },
};

function getSpecialtyConfig(specialty) {
  const key = String(specialty || '').toLowerCase().trim();
  return SPECIALTY_TERMS[key] || { termoLivre: specialty, label: specialty };
}

function safeDate(value) {
  if (!value) return null;
  const s = String(value);
  // Tenta extrair YYYY-MM-DD diretamente para evitar problemas de timezone
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return s.slice(0, 10) || null;
}

function mapOpportunity(p, score) {
  return {
    numeroProcesso: p.numeroProcesso || null,
    classe: p.classe?.nome || (typeof p.classe === 'string' ? p.classe : null),
    assuntos: Array.isArray(p.assuntos) ? p.assuntos.map((a) => a.nome || String(a)) : [],
    orgaoJulgador: p.orgaoJulgador?.nome || (typeof p.orgaoJulgador === 'string' ? p.orgaoJulgador : null),
    dataAjuizamento: safeDate(p.dataAjuizamento),
    dataAtualizacao: safeDate(p.dataHoraUltimaAtualizacao),
    grau: p.grau || null,
    opportunityScore: score ?? null,
  };
}

// Pede à IA para pontuar cada processo como oportunidade de prospecção (0-10)
async function scoreProcesses(processes, specialtyLabel) {
  if (processes.length === 0) return [];

  const listText = processes
    .map((p, i) => {
      const classe = p.classe?.nome || p.classe || '';
      const assuntos = Array.isArray(p.assuntos) ? p.assuntos.map((a) => a.nome || a).join(', ') : '';
      return `${i}|${classe}|${assuntos}|${p.grau || ''}`;
    })
    .join('\n');

  const prompt = `Você é especialista em prospecção jurídica para advogados de ${specialtyLabel}.

Para cada processo abaixo, avalie de 0 a 10 a chance de ser uma oportunidade real de captação (pessoa física que pode precisar de advogado sem representação).

Critérios para ALTA pontuação (7-10):
- Pessoa física vs INSS por benefício negado, auxílio-doença, aposentadoria por invalidez
- Reclamação trabalhista de empregado (rescisão, FGTS, horas extras, assédio)
- Consumidor vs empresa (negativação indevida, defeito de produto, cobrança indevida)
- Divórcio, alimentos, guarda litigiosos
- Indenização por dano moral ou material de pessoa física
- Execução de alimentos

Critérios para BAIXA pontuação (0-3):
- Procedimentos institucionais ou administrativos genéricos
- Fazenda Pública, Município ou empresa propondo ação
- Mandado de segurança empresarial
- Processos entre órgãos públicos
- Termo Circunstanciado (caso policial sem vítima claramente necessitando advogado)

Processos (formato: índice|classe|assuntos|grau):
${listText}

Responda APENAS com um JSON array sem nenhum texto antes ou depois: [{"i":0,"s":8},{"i":1,"s":2},...]`;

  try {
    const result = await ai.chat(prompt, '', [], { model: ai.getDefaultModel() });
    const text = (result.text || '').trim();
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return parsed.map((item) => ({ index: Number(item.i), score: Number(item.s) }));
  } catch (err) {
    logger.warn(`Falha ao pontuar processos: ${err.message}`);
    return null;
  }
}

async function saveSearch({ userId, tribunalAlias, specialty, filters, totalFound, aiSummary, results }) {
  try {
    await pool.query(
      `INSERT INTO prospecting_searches
       (user_id, tribunal_alias, specialty, filters, total_found, ai_summary, results)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)`,
      [
        userId || null,
        tribunalAlias,
        specialty,
        JSON.stringify(filters || {}),
        totalFound || 0,
        aiSummary || null,
        JSON.stringify(results || []),
      ]
    );
  } catch (err) {
    logger.warn(`Falha ao salvar busca de prospecção: ${err.message}`);
  }
}

async function listSearchHistory(userId, limit = 10) {
  try {
    const result = await pool.query(
      `SELECT id, tribunal_alias, specialty, total_found, ai_summary, created_at
       FROM prospecting_searches
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } catch (err) {
    logger.warn(`Falha ao carregar histórico de prospecção: ${err.message}`);
    return [];
  }
}

async function searchOpportunities({ tribunalAlias, specialty, size = 20, userId = null }) {
  if (!tribunalAlias) throw new Error('Selecione um tribunal para a prospecção.');
  if (!specialty) throw new Error('Informe a área jurídica para prospecção.');

  const specConfig = getSpecialtyConfig(specialty);

  // Busca mais processos do que o necessário para filtrar depois
  const fetchSize = Math.min(Math.max(parseInt(size, 10) || 20, 5), 50);
  const filters = {
    tribunalAlias,
    termoLivre: specConfig.termoLivre,
    size: fetchSize,
  };

  let searchResult;
  try {
    searchResult = await searchProcesses(filters, userId);
  } catch (err) {
    throw new Error(`Falha na busca processual: ${err.message}`);
  }

  const { results = [], total } = searchResult;

  if (results.length === 0) {
    await saveSearch({ userId, tribunalAlias, specialty, filters, totalFound: 0, aiSummary: null, results: [] });
    return {
      tribunalAlias,
      specialty: specConfig.label,
      totalFound: 0,
      aiSummary: 'Nenhum processo encontrado para os critérios informados.',
      opportunities: [],
    };
  }

  // Pontua cada processo como oportunidade
  const scores = await scoreProcesses(results.slice(0, 30), specConfig.label);
  const scoreMap = scores
    ? Object.fromEntries(scores.map((s) => [s.index, s.score]))
    : null;

  // Filtra apenas oportunidades com pontuação >= 6 (ou mantém todos se scoring falhou)
  const SCORE_THRESHOLD = 6;
  const filteredResults = scoreMap
    ? results.filter((_, i) => (scoreMap[i] ?? 0) >= SCORE_THRESHOLD)
    : results;

  const opportunities = filteredResults.map((p, i) => {
    const originalIndex = results.indexOf(p);
    const score = scoreMap ? (scoreMap[originalIndex] ?? null) : null;
    return mapOpportunity(p, score);
  });

  // Análise geral da IA sobre as oportunidades filtradas
  let aiSummary = '';
  if (opportunities.length > 0) {
    const summaryText = opportunities
      .slice(0, 15)
      .map((o, i) => `${i + 1}. ${o.classe || '-'} | ${(o.assuntos || []).join(', ')} | ${o.dataAjuizamento || '-'}`)
      .join('\n');

    const aiPrompt = `Você é um assistente jurídico especialista em prospecção de clientes para advogados de ${specConfig.label}.

Abaixo estão ${opportunities.length} processos identificados como oportunidades reais de captação no tribunal ${tribunalAlias.replace('api_publica_', '').toUpperCase()}.

Oportunidades:
${summaryText}

Em 2-3 parágrafos objetivos:
1. Quais os padrões mais frequentes (tipos de causa, demandas recorrentes)?
2. Como o advogado pode se posicionar para captar esses clientes de forma ética?
3. Qual o potencial de mercado dessa demanda?`;

    try {
      const aiResult = await ai.chat(aiPrompt, '', [], { model: ai.getComplexModel() });
      aiSummary = aiResult.text || '';
    } catch (err) {
      logger.warn(`Falha na análise IA de prospecção: ${err.message}`);
      aiSummary = `${opportunities.length} oportunidade(s) identificada(s) na área de ${specConfig.label}. Analise os processos listados para identificar potenciais clientes.`;
    }
  } else {
    aiSummary = `Nenhuma oportunidade clara de prospecção identificada entre os ${results.length} processos encontrados. Tente outro tribunal ou área jurídica.`;
  }

  await saveSearch({
    userId,
    tribunalAlias,
    specialty,
    filters,
    totalFound: opportunities.length,
    aiSummary,
    results: opportunities,
  });

  return {
    tribunalAlias,
    specialty: specConfig.label,
    totalFound: total || results.length,
    filteredCount: opportunities.length,
    aiSummary,
    opportunities,
  };
}

module.exports = {
  searchOpportunities,
  listSearchHistory,
  SPECIALTY_TERMS,
};
