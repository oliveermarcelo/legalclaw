const { searchProcesses } = require('./external-legal-search');
const ai = require('./ai');
const { pool } = require('../config/migrate');
const logger = require('../utils/logger');

// Mapeamento de especialidades para termos de busca e códigos de classe
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

async function searchOpportunities({ tribunalAlias, specialty, size = 15, userId = null }) {
  if (!tribunalAlias) throw new Error('Selecione um tribunal para a prospecção.');
  if (!specialty) throw new Error('Informe a área jurídica para prospecção.');

  const specConfig = getSpecialtyConfig(specialty);

  const filters = {
    tribunalAlias,
    termoLivre: specConfig.termoLivre,
    size: Math.min(Math.max(parseInt(size, 10) || 15, 1), 50),
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

  // Montar resumo para análise da IA
  const processListText = results
    .slice(0, 20)
    .map((p, i) => {
      const classe = p.classe?.nome || p.classe || '';
      const assuntos = Array.isArray(p.assuntos)
        ? p.assuntos.map((a) => a.nome || a).join(', ')
        : '';
      const orgao = p.orgaoJulgador?.nome || p.orgaoJulgador || '';
      const dataAjuiz = p.dataAjuizamento ? p.dataAjuizamento.slice(0, 10) : '';
      return `${i + 1}. Processo: ${p.numeroProcesso || '-'} | Classe: ${classe} | Assuntos: ${assuntos} | Órgão: ${orgao} | Ajuizamento: ${dataAjuiz}`;
    })
    .join('\n');

  const aiPrompt = `Você é um assistente jurídico especialista em prospecção de clientes para advogados.

Analise os seguintes processos judiciais recentes na área de ${specConfig.label} no tribunal "${tribunalAlias.replace('api_publica_', '').toUpperCase()}" e identifique as melhores oportunidades de captação de novos clientes.

Processos encontrados:
${processListText}

Por favor:
1. Resuma em 2-3 parágrafos as principais oportunidades identificadas
2. Destaque padrões (tipos de causa, órgãos com mais demanda, períodos de pico)
3. Sugira como o advogado pode abordar essas oportunidades de forma ética

Responda de forma objetiva e prática, focado em valor para o advogado.`;

  let aiSummary = '';
  try {
    const aiResult = await ai.chat(aiPrompt, '', [], { model: ai.getComplexModel() });
    aiSummary = aiResult.text || '';
  } catch (err) {
    logger.warn(`Falha na análise IA de prospecção: ${err.message}`);
    aiSummary = `Encontrados ${results.length} processos na área de ${specConfig.label}. Analise os resultados para identificar oportunidades.`;
  }

  // Mapear para formato de oportunidade
  const opportunities = results.map((p) => ({
    numeroProcesso: p.numeroProcesso || null,
    classe: p.classe?.nome || p.classe || null,
    assuntos: Array.isArray(p.assuntos) ? p.assuntos.map((a) => a.nome || a) : [],
    orgaoJulgador: p.orgaoJulgador?.nome || p.orgaoJulgador || null,
    dataAjuizamento: p.dataAjuizamento || null,
    dataAtualizacao: p.dataHoraUltimaAtualizacao || null,
    grau: p.grau || null,
  }));

  await saveSearch({
    userId,
    tribunalAlias,
    specialty,
    filters,
    totalFound: total || results.length,
    aiSummary,
    results: opportunities,
  });

  return {
    tribunalAlias,
    specialty: specConfig.label,
    totalFound: total || results.length,
    returned: opportunities.length,
    aiSummary,
    opportunities,
  };
}

module.exports = {
  searchOpportunities,
  listSearchHistory,
  SPECIALTY_TERMS,
};
