const { searchProcesses } = require('./external-legal-search');
const ai = require('./ai');
const { pool } = require('../config/migrate');
const logger = require('../utils/logger');

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

// Movimentos que indicam fase avançada — processo já encaminhado para decisão ou encerrado
const MOVIMENTOS_FASE_AVANCADA = [
  'mérito', 'sentença', 'acórdão', 'julgamento', 'transitado em julgado',
  'baixa', 'arquivamento', 'arquivado', 'cumprimento de sentença',
  'execução', 'liquidação', 'precatório', 'extinção', 'extinto',
  'improcedente', 'procedente', 'provido', 'improvido', 'desprovido',
  'provimento', 'não provimento', 'não-provimento', 'negado seguimento',
  'julgado', 'decidido', 'homologado',
];

const MOVIMENTOS_FASE_INICIAL = [
  'distribuição', 'recebimento', 'cadastramento', 'autuação',
  'citação', 'intimação inicial', 'despacho inicial',
];

function classificarFase(movimentos) {
  if (!Array.isArray(movimentos) || movimentos.length === 0) return 'desconhecida';
  // Pega os últimos movimentos (mais recentes)
  const nomes = movimentos
    .slice(-5)
    .reverse()
    .map((m) => String(m.nome || m.descricao || '').toLowerCase());

  for (const nome of nomes) {
    if (MOVIMENTOS_FASE_AVANCADA.some((kw) => nome.includes(kw))) return 'avancada';
  }
  for (const nome of nomes) {
    if (MOVIMENTOS_FASE_INICIAL.some((kw) => nome.includes(kw))) return 'inicial';
  }
  return 'intermediaria';
}

function getSpecialtyConfig(specialty) {
  const key = String(specialty || '').toLowerCase().trim();
  return SPECIALTY_TERMS[key] || { termoLivre: specialty, label: specialty };
}

function dateMonthsAgo(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function safeDate(value) {
  if (!value) return null;
  const s = String(value);
  // YYYY-MM-DD ou YYYY-MM-DDTHH:MM
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // YYYYMMDD (sem traços)
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[3]}/${compact[2]}/${compact[1]}`;
  return null;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  } catch {
    return null;
  }
}

function mapOpportunity(p, score) {
  const partes = Array.isArray(p.partes) ? p.partes : [];
  const movimentos = Array.isArray(p.movimentos) ? p.movimentos : [];
  const dias = daysSince(p.dataAjuizamento);
  const fase = classificarFase(movimentos);

  return {
    numeroProcesso: p.numeroProcesso || null,
    classe: p.classe?.nome || (typeof p.classe === 'string' ? p.classe : null),
    assuntos: Array.isArray(p.assuntos) ? p.assuntos.map((a) => a.nome || String(a)) : [],
    orgaoJulgador: p.orgaoJulgador?.nome || (typeof p.orgaoJulgador === 'string' ? p.orgaoJulgador : null),
    tribunal: p.tribunal || null,
    grau: p.grau || null,
    dataAjuizamento: safeDate(p.dataAjuizamento),
    dataAtualizacao: safeDate(p.dataHoraUltimaAtualizacao),
    diasDesdeAjuizamento: dias,
    faseProcessual: fase,
    opportunityScore: score ?? null,
    // Detalhes extras
    partes: partes.map((pt) => ({
      nome: pt.nome || pt.nomeRepresentante || null,
      tipo: pt.tipoParte || null,
      advogados: Array.isArray(pt.advogados) ? pt.advogados.map((a) => a.nome || String(a)) : [],
    })),
    movimentos: movimentos.slice(0, 8).map((m) => ({
      data: safeDate(m.dataHora || m.data),
      nome: m.nome || m.descricao || null,
    })),
  };
}

async function scoreProcesses(processes, specialtyLabel) {
  if (processes.length === 0) return [];

  const listText = processes
    .map((p, i) => {
      const classe = p.classe?.nome || p.classe || '';
      const assuntos = Array.isArray(p.assuntos) ? p.assuntos.map((a) => a.nome || a).join(', ') : '';
      const dias = daysSince(p.dataAjuizamento);
      const partesComNome = Array.isArray(p.partes) ? p.partes.filter((pt) => pt.nome) : [];
      let advStatus = 'desconhecido';
      if (partesComNome.length > 0) {
        advStatus = partesComNome.some((pt) => Array.isArray(pt.advogados) && pt.advogados.length > 0)
          ? 'sim'
          : 'nao';
      }
      const fase = classificarFase(Array.isArray(p.movimentos) ? p.movimentos : []);
      return `${i}|${classe}|${assuntos}|${p.grau || ''}|${dias != null ? `${dias}d` : '?'}|adv:${advStatus}|fase:${fase}`;
    })
    .join('\n');

  const prompt = `Você é especialista em prospecção jurídica para advogados de ${specialtyLabel}.

Para cada processo, avalie de 0 a 10 a chance de ser uma oportunidade real de captação de cliente.

Critérios ALTA pontuação (7-10):
- Sem advogado confirmado ("adv:nao") + matéria de pessoa física
- Processo recente (< 90 dias)
- Matéria típica de pessoa física: trabalhista, previdenciário, consumidor, família, indenização, alimentos

Critérios MÉDIA pontuação (5-6):
- Representação desconhecida ("adv:desconhecido") mas matéria promissora
- Processo recente sem dados completos de partes

Critérios BAIXA pontuação (0-3):
- Já tem advogado confirmado ("adv:sim")
- Fase avançada ("fase:avancada"): mérito, sentença, cumprimento, acórdão — processo quase encerrado
- Grau G2/G3 (recurso/apelação) — parte já teve representação na 1ª instância
- Procedimento institucional / Fazenda Pública propondo
- Processo muito antigo (> 365 dias)
- Empresas litigando entre si

Fase inicial ("fase:inicial") é um critério positivo — processo novo, maior chance de captação.

Formato: índice|classe|assuntos|grau|idade|advogado|fase
${listText}

Responda APENAS JSON array: [{"i":0,"s":8},{"i":1,"s":2},...]`;

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

async function searchOpportunities({ tribunalAlias, specialty, size = 20, monthsBack = 6, uf = null, userId = null }) {
  if (!tribunalAlias) throw new Error('Selecione um tribunal para a prospecção.');
  if (!specialty) throw new Error('Informe a área jurídica para prospecção.');

  const specConfig = getSpecialtyConfig(specialty);
  const fetchSize = Math.min(Math.max(parseInt(size, 10) || 20, 5), 50);
  const dateFrom = dateMonthsAgo(Math.min(Math.max(parseInt(monthsBack, 10) || 6, 1), 24));
  const ufClean = uf ? String(uf).toUpperCase().trim().slice(0, 2) : null;

  const filters = {
    tribunalAlias,
    termoLivre: specConfig.termoLivre,
    size: fetchSize,
    dateFrom,
    ...(ufClean ? { uf: ufClean } : {}),
  };

  let searchResult;
  try {
    searchResult = await searchProcesses(filters, userId);
  } catch (err) {
    // Se o filtro de data não funcionar no tribunal, tenta sem ele
    try {
      const fallbackFilters = { tribunalAlias, termoLivre: specConfig.termoLivre, size: fetchSize, ...(ufClean ? { uf: ufClean } : {}) };
      searchResult = await searchProcesses(fallbackFilters, userId);
    } catch (err2) {
      throw new Error(`Falha na busca processual: ${err2.message}`);
    }
  }

  const { results = [], total } = searchResult;

  if (results.length === 0) {
    await saveSearch({ userId, tribunalAlias, specialty, filters, totalFound: 0, aiSummary: null, results: [] });
    return {
      tribunalAlias,
      specialty: specConfig.label,
      totalFound: 0,
      filteredCount: 0,
      aiSummary: 'Nenhum processo encontrado para os critérios informados.',
      opportunities: [],
    };
  }

  // Pontua cada processo
  const scores = await scoreProcesses(results.slice(0, 30), specConfig.label);
  const scoreMap = scores
    ? Object.fromEntries(scores.map((s) => [s.index, s.score]))
    : null;

  // Remove processos em fase avançada (mérito, sentença, cumprimento...)
  // e processos de 2ª instância (G2) — recurso/apelação, parte já teve advogado
  const resultsWithoutAdvanced = results.filter((p) => {
    if (p.grau === 'G2' || p.grau === 'G3' || p.grau === 'GS' || p.grau === 'TR') return false;
    const fase = classificarFase(Array.isArray(p.movimentos) ? p.movimentos : []);
    return fase !== 'avancada';
  });

  const SCORE_THRESHOLD = 6;
  const filteredResults = scoreMap
    ? resultsWithoutAdvanced.filter((_, i) => {
        const origIdx = results.indexOf(resultsWithoutAdvanced[i]);
        return (scoreMap[origIdx] ?? 0) >= SCORE_THRESHOLD;
      })
    : resultsWithoutAdvanced;

  const opportunities = filteredResults.map((p) => {
    const originalIndex = results.indexOf(p);
    const score = scoreMap ? (scoreMap[originalIndex] ?? null) : null;
    return mapOpportunity(p, score);
  });

  // Ordena por score desc, depois por mais recente
  opportunities.sort((a, b) => {
    const scoreDiff = (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.diasDesdeAjuizamento ?? 9999) - (b.diasDesdeAjuizamento ?? 9999);
  });

  let aiSummary = '';
  if (opportunities.length > 0) {
    const summaryText = opportunities
      .slice(0, 12)
      .map((o, i) => {
        const semAdv = o.partes.every((p) => p.advogados.length === 0) ? '(sem advogado)' : '(com advogado)';
        return `${i + 1}. ${o.classe || '-'} | ${(o.assuntos || []).slice(0, 2).join(', ')} | ${o.diasDesdeAjuizamento ?? '?'}d | score:${o.opportunityScore} ${semAdv}`;
      })
      .join('\n');

    const aiPrompt = `Você é assistente jurídico especialista em prospecção de clientes para advogados de ${specConfig.label}.

${opportunities.length} oportunidade(s) identificada(s) no tribunal ${tribunalAlias.replace('api_publica_', '').toUpperCase()}, ordenadas por potencial:

${summaryText}

Em 3 parágrafos objetivos:
1. Quais os padrões de causa mais promissores para captação?
2. Quais processos prioritários (sem advogado + recentes)?
3. Como o advogado pode abordar esses potenciais clientes eticamente?`;

    try {
      const aiResult = await ai.chat(aiPrompt, '', [], { model: ai.getComplexModel() });
      aiSummary = aiResult.text || '';
    } catch (err) {
      logger.warn(`Falha na análise IA: ${err.message}`);
      aiSummary = `${opportunities.length} oportunidade(s) identificada(s) na área de ${specConfig.label}.`;
    }
  } else {
    aiSummary = `Nenhuma oportunidade clara identificada entre os ${results.length} processos. Tente outro tribunal ou área jurídica.`;
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
