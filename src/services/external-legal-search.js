const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { pool } = require('../config/migrate');

const CNJ_DIGITS = 20;

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCnj(value) {
  const digits = onlyDigits(value);
  if (digits.length !== CNJ_DIGITS) return null;
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

function isEscavadorConfigured() {
  return Boolean(
    config.externalLegal.escavadorEnabled &&
    config.externalLegal.escavadorApiKey &&
    config.externalLegal.escavadorBaseUrl
  );
}

function getProviderStatus() {
  const provider = config.externalLegal.provider;
  const escavadorConfigured = isEscavadorConfigured();

  return {
    provider,
    providers: [
      {
        id: 'escavador',
        configured: escavadorConfigured,
        enabled: Boolean(config.externalLegal.escavadorEnabled),
      },
    ],
  };
}

function buildEscavadorClient() {
  if (!isEscavadorConfigured()) {
    throw new Error('Integracao Escavador nao configurada. Verifique ESCAVADOR_ENABLED e ESCAVADOR_API_KEY.');
  }

  return axios.create({
    baseURL: config.externalLegal.escavadorBaseUrl,
    timeout: config.externalLegal.escavadorTimeoutMs,
    headers: {
      Authorization: `Bearer ${config.externalLegal.escavadorApiKey}`,
      'Content-Type': 'application/json',
    },
  });
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
    // Nao bloquear fluxo por falha de log.
  }
}

function mapEscavadorError(err) {
  const status = err?.response?.status;
  const body = err?.response?.data;
  const detail = body?.message || body?.detail || body?.error || err?.message || 'erro desconhecido';

  if (status === 401 || status === 403) {
    return `Falha de autenticacao na consulta externa (Escavador ${status}).`;
  }
  if (status === 404) {
    return 'Processo nao encontrado na base externa.';
  }
  if (status === 429) {
    return 'Limite de requisicoes da base externa atingido.';
  }
  if (status >= 500) {
    return `Base externa indisponivel no momento (${status}).`;
  }

  return `Falha na consulta externa: ${detail}`;
}

async function fetchEscavadorProcessByCnj(numeroCnj, options = {}) {
  const formatted = formatCnj(numeroCnj);
  if (!formatted) {
    throw new Error('Numero CNJ invalido. Informe no formato 0000000-00.0000.0.00.0000');
  }

  const client = buildEscavadorClient();
  const processPath = `/api/v2/processos/numero_cnj/${encodeURIComponent(formatted)}`;

  const [processRes, involvedRes, docsRes] = await Promise.all([
    client.get(processPath),
    options.includeInvolved
      ? client.get(`${processPath}/envolvidos`)
      : Promise.resolve({ data: null }),
    options.includePublicDocuments
      ? client.get(`${processPath}/documentos-publicos`)
      : Promise.resolve({ data: null }),
  ]);

  return {
    provider: 'escavador',
    numeroCnj: formatted,
    process: processRes.data || null,
    involved: involvedRes.data || null,
    publicDocuments: docsRes.data || null,
  };
}

async function requestEscavadorRefresh(numeroCnj, options = {}) {
  const formatted = formatCnj(numeroCnj);
  if (!formatted) {
    throw new Error('Numero CNJ invalido. Informe no formato 0000000-00.0000.0.00.0000');
  }

  const client = buildEscavadorClient();
  const processPath = `/api/v2/processos/numero_cnj/${encodeURIComponent(formatted)}`;
  const payload = {};

  if (options?.autos === true) payload.autos = 1;
  if (options?.useCertificate === true) payload.utilizar_certificado = 1;

  const response = await client.post(`${processPath}/solicitar-atualizacao`, payload);
  return {
    provider: 'escavador',
    numeroCnj: formatted,
    refresh: response.data || {},
  };
}

async function getEscavadorRefreshStatus(numeroCnj) {
  const formatted = formatCnj(numeroCnj);
  if (!formatted) {
    throw new Error('Numero CNJ invalido. Informe no formato 0000000-00.0000.0.00.0000');
  }

  const client = buildEscavadorClient();
  const processPath = `/api/v2/processos/numero_cnj/${encodeURIComponent(formatted)}`;
  const response = await client.get(`${processPath}/status-atualizacao`);

  return {
    provider: 'escavador',
    numeroCnj: formatted,
    status: response.data || {},
  };
}

async function searchProcessByCnj(numeroCnj, options = {}, userId = null) {
  const startedAt = Date.now();
  try {
    if (config.externalLegal.provider !== 'escavador') {
      throw new Error(`Provider externo nao suportado: ${config.externalLegal.provider}`);
    }

    const result = await fetchEscavadorProcessByCnj(numeroCnj, options);

    await logExternalCall({
      userId,
      provider: 'escavador',
      operation: 'process_by_cnj',
      queryPayload: { numeroCnj: result.numeroCnj, options },
      status: 'success',
      latencyMs: Date.now() - startedAt,
    });

    return result;
  } catch (err) {
    const message = mapEscavadorError(err);
    await logExternalCall({
      userId,
      provider: 'escavador',
      operation: 'process_by_cnj',
      queryPayload: { numeroCnj, options },
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    logger.error(`Erro na consulta externa CNJ: ${message}`);
    throw new Error(message);
  }
}

async function requestProcessRefresh(numeroCnj, options = {}, userId = null) {
  const startedAt = Date.now();
  try {
    if (config.externalLegal.provider !== 'escavador') {
      throw new Error(`Provider externo nao suportado: ${config.externalLegal.provider}`);
    }

    const result = await requestEscavadorRefresh(numeroCnj, options);
    await logExternalCall({
      userId,
      provider: 'escavador',
      operation: 'request_refresh',
      queryPayload: { numeroCnj: result.numeroCnj, options },
      status: 'success',
      latencyMs: Date.now() - startedAt,
    });
    return result;
  } catch (err) {
    const message = mapEscavadorError(err);
    await logExternalCall({
      userId,
      provider: 'escavador',
      operation: 'request_refresh',
      queryPayload: { numeroCnj, options },
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    logger.error(`Erro ao solicitar atualizacao externa: ${message}`);
    throw new Error(message);
  }
}

async function getProcessRefreshStatus(numeroCnj, userId = null) {
  const startedAt = Date.now();
  try {
    if (config.externalLegal.provider !== 'escavador') {
      throw new Error(`Provider externo nao suportado: ${config.externalLegal.provider}`);
    }

    const result = await getEscavadorRefreshStatus(numeroCnj);
    await logExternalCall({
      userId,
      provider: 'escavador',
      operation: 'refresh_status',
      queryPayload: { numeroCnj: result.numeroCnj },
      status: 'success',
      latencyMs: Date.now() - startedAt,
    });
    return result;
  } catch (err) {
    const message = mapEscavadorError(err);
    await logExternalCall({
      userId,
      provider: 'escavador',
      operation: 'refresh_status',
      queryPayload: { numeroCnj },
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    logger.error(`Erro ao consultar status de atualizacao externa: ${message}`);
    throw new Error(message);
  }
}

module.exports = {
  getProviderStatus,
  searchProcessByCnj,
  requestProcessRefresh,
  getProcessRefreshStatus,
  formatCnj,
};

