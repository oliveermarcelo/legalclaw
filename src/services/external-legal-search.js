const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { pool } = require('../config/migrate');

const CNJ_DIGITS = 20;
const DEFAULT_DATAJUD_ALIASES = [
  'api_publica_tjba', 'api_publica_tjsp', 'api_publica_tjmg', 'api_publica_tjrj', 'api_publica_tjrs',
  'api_publica_trf1', 'api_publica_trf2', 'api_publica_trf3', 'api_publica_trf4', 'api_publica_trf5',
  'api_publica_trt1', 'api_publica_trt2', 'api_publica_trt3', 'api_publica_trt4', 'api_publica_trt5',
  'api_publica_trt6', 'api_publica_trt7', 'api_publica_trt8', 'api_publica_trt9', 'api_publica_trt10',
  'api_publica_trt11', 'api_publica_trt12', 'api_publica_trt13', 'api_publica_trt14', 'api_publica_trt15',
  'api_publica_trt16', 'api_publica_trt17', 'api_publica_trt18', 'api_publica_trt19', 'api_publica_trt20',
  'api_publica_trt21', 'api_publica_trt22', 'api_publica_trt23', 'api_publica_trt24',
  'api_publica_stj', 'api_publica_tst', 'api_publica_tse', 'api_publica_stm',
];

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCnj(value) {
  const digits = onlyDigits(value);
  if (digits.length !== CNJ_DIGITS) return null;
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

function isDatajudConfigured() {
  return Boolean(
    config.externalLegal.datajudEnabled &&
    config.externalLegal.datajudApiKey &&
    config.externalLegal.datajudBaseUrl
  );
}

function normalizeAlias(alias) {
  const normalized = String(alias || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('api_publica_')) return normalized;
  return `api_publica_${normalized}`;
}

function getConfiguredAliases() {
  const configured = Array.isArray(config.externalLegal.datajudAliases)
    ? config.externalLegal.datajudAliases
    : [];
  const normalized = configured.map(normalizeAlias).filter(Boolean);
  if (normalized.length > 0) return [...new Set(normalized)];
  return DEFAULT_DATAJUD_ALIASES;
}

function getProviderStatus() {
  return {
    provider: config.externalLegal.provider,
    providers: [
      {
        id: 'datajud',
        configured: isDatajudConfigured(),
        enabled: Boolean(config.externalLegal.datajudEnabled),
        aliases: getConfiguredAliases(),
      },
    ],
  };
}

function buildDatajudClient() {
  if (!isDatajudConfigured()) {
    throw new Error('Consulta processual nao disponivel no momento.');
  }

  return axios.create({
    baseURL: config.externalLegal.datajudBaseUrl,
    timeout: config.externalLegal.datajudTimeoutMs,
    headers: {
      Authorization: `APIKey ${config.externalLegal.datajudApiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

function safeInt(value, fallback, min, max) {
  const num = parseInt(value, 10);
  if (!Number.isInteger(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

function mapDatajudError(err) {
  const status = err?.response?.status;

  if (status === 401 || status === 403) {
    return 'Falha de autenticacao no sistema de consulta processual.';
  }
  if (status === 404) {
    return 'Tribunal nao encontrado. Verifique o tribunal selecionado.';
  }
  if (status === 429) {
    return 'Limite de consultas atingido. Tente novamente em instantes.';
  }
  if (status >= 500) {
    return 'Sistema de consulta processual indisponivel no momento.';
  }

  return 'Falha ao consultar o processo. Verifique o numero informado e tente novamente.';
}

async function logExternalCall({
  userId,
  provider,
  operation,
  queryPayload,
  status,
  latencyMs,
  errorMessage,
}) {
  try {
    await pool.query(
      `INSERT INTO external_query_logs
       (user_id, provider, operation, query_payload, status, latency_ms, error_message)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      [
        userId || null,
        provider,
        operation,
        JSON.stringify(queryPayload || {}),
        status,
        latencyMs || null,
        errorMessage ? String(errorMessage).slice(0, 1200) : null,
      ]
    );
  } catch {
    // Sem efeito colateral.
  }
}

function mapProcessHit(hit, alias) {
  const source = hit?._source || {};
  return {
    tribunalAlias: alias,
    id: hit?._id || null,
    score: typeof hit?._score === 'number' ? hit._score : null,
    numeroProcesso: source.numeroProcesso || null,
    tribunal: source.tribunal || null,
    grau: source.grau || null,
    classe: source.classe || null,
    orgaoJulgador: source.orgaoJulgador || null,
    assuntos: Array.isArray(source.assuntos) ? source.assuntos : [],
    partes: Array.isArray(source.partes) ? source.partes : [],
    movimentos: Array.isArray(source.movimentos) ? source.movimentos.slice(-15) : [],
    dataAjuizamento: source.dataAjuizamento || null,
    dataHoraUltimaAtualizacao: source.dataHoraUltimaAtualizacao || null,
    raw: source,
  };
}

async function executeDatajudSearch(alias, body) {
  const client = buildDatajudClient();
  const response = await client.post(`/${alias}/_search`, body);
  const hits = response.data?.hits?.hits || [];
  const total = response.data?.hits?.total?.value || hits.length;
  return { total, hits };
}

async function searchProcessByCnj(numeroCnj, options = {}, userId = null) {
  const startedAt = Date.now();
  const formatted = formatCnj(numeroCnj);
  if (!formatted) {
    throw new Error('Numero de processo invalido. Informe os 20 digitos no formato correto.');
  }

  const digits = onlyDigits(numeroCnj);
  const pageSize = safeInt(options.size, 5, 1, config.externalLegal.datajudMaxPerPage);

  const requestedAlias = normalizeAlias(options.tribunalAlias || config.externalLegal.datajudDefaultAlias);
  const aliases = requestedAlias
    ? [requestedAlias]
    : getConfiguredAliases().slice(0, 8);

  const queryBody = {
    query: { match: { numeroProcesso: digits } },
    size: pageSize,
    from: safeInt(options.from, 0, 0, 5000),
    sort: [{ '@timestamp': { order: 'desc' } }],
  };

  try {
    const allResults = [];
    const aliasesSearched = [];

    for (const alias of aliases) {
      const result = await executeDatajudSearch(alias, queryBody);
      aliasesSearched.push(alias);
      for (const hit of result.hits) {
        allResults.push(mapProcessHit(hit, alias));
      }
      if (requestedAlias && allResults.length > 0) break;
    }

    await logExternalCall({
      userId,
      provider: 'datajud',
      operation: 'process_by_cnj',
      queryPayload: { numeroCnj: formatted, aliases, pageSize },
      status: 'success',
      latencyMs: Date.now() - startedAt,
    });

    return {
      provider: 'datajud',
      numeroCnj: formatted,
      aliasesSearched,
      totalFound: allResults.length,
      results: allResults,
    };
  } catch (err) {
    const message = mapDatajudError(err);
    await logExternalCall({
      userId,
      provider: 'datajud',
      operation: 'process_by_cnj',
      queryPayload: { numeroCnj: formatted, aliases, pageSize },
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    logger.error(`Erro na consulta DataJud por CNJ: ${message}`);
    throw new Error(message);
  }
}

function buildAdvancedQuery(filters = {}) {
  const must = [];
  const numeroCnjDigits = onlyDigits(filters.numeroCnj || '');

  if (numeroCnjDigits.length === CNJ_DIGITS) {
    must.push({ match: { numeroProcesso: numeroCnjDigits } });
  }

  if (filters.classeCodigo) {
    must.push({ match: { 'classe.codigo': parseInt(filters.classeCodigo, 10) } });
  }

  if (filters.orgaoJulgadorCodigo) {
    must.push({ match: { 'orgaoJulgador.codigo': parseInt(filters.orgaoJulgadorCodigo, 10) } });
  }

  if (filters.assuntoCodigo) {
    must.push({ match: { 'assuntos.codigo': parseInt(filters.assuntoCodigo, 10) } });
  }

  if (filters.termoLivre) {
    must.push({
      multi_match: {
        query: String(filters.termoLivre).trim(),
        fields: [
          'numeroProcesso',
          'classe.nome',
          'orgaoJulgador.nome',
          'assuntos.nome',
          'movimentos.nome',
        ],
      },
    });
  }

  if (must.length === 0) {
    throw new Error('Informe ao menos um filtro de busca');
  }

  const filter = [];
  if (filters.dateFrom) {
    filter.push({ range: { dataAjuizamento: { gte: filters.dateFrom } } });
  }

  return {
    query: { bool: { must, ...(filter.length > 0 ? { filter } : {}) } },
  };
}

async function searchProcesses(filters = {}, userId = null) {
  const startedAt = Date.now();
  const alias = normalizeAlias(filters.tribunalAlias || config.externalLegal.datajudDefaultAlias);
  if (!alias) {
    throw new Error('tribunalAlias e obrigatorio para busca avancada');
  }

  const size = safeInt(filters.size, 10, 1, config.externalLegal.datajudMaxPerPage);
  const from = safeInt(filters.from, 0, 0, 5000);

  let body;
  try {
    body = buildAdvancedQuery(filters);
  } catch (err) {
    throw err;
  }

  body.size = size;
  body.from = from;
  body.sort = [{ '@timestamp': { order: 'desc' } }];

  try {
    const result = await executeDatajudSearch(alias, body);
    const mapped = result.hits.map((hit) => mapProcessHit(hit, alias));

    await logExternalCall({
      userId,
      provider: 'datajud',
      operation: 'advanced_search',
      queryPayload: { alias, filters: { ...filters, size, from } },
      status: 'success',
      latencyMs: Date.now() - startedAt,
    });

    return {
      provider: 'datajud',
      tribunalAlias: alias,
      total: result.total,
      from,
      size,
      results: mapped,
    };
  } catch (err) {
    const message = mapDatajudError(err);
    await logExternalCall({
      userId,
      provider: 'datajud',
      operation: 'advanced_search',
      queryPayload: { alias, filters: { ...filters, size, from } },
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    logger.error(`Erro na busca avancada DataJud: ${message}`);
    throw new Error(message);
  }
}

module.exports = {
  getProviderStatus,
  searchProcessByCnj,
  searchProcesses,
  formatCnj,
};

