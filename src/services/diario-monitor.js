const axios = require('axios');
const { pool } = require('../config/migrate');
const logger = require('../utils/logger');

// URLs base dos diários (IMPRENSA NACIONAL API)
const DIARIO_SOURCES = {
  DOU: {
    name: 'Diário Oficial da União',
    searchUrl: 'https://www.in.gov.br/servicos/diario-oficial-da-uniao/pesquisar',
    // A API do DOU aceita buscas via web scraping ou API quando disponível
  },
  // DOE e DOM variam por estado/município - implementar conforme necessidade
};

/**
 * Cria um monitor de diário oficial
 */
async function createMonitor(userId, { keywords, diarioType }, orgId = null) {
  const res = await pool.query(
    `INSERT INTO diario_monitors (user_id, org_id, keywords, diario_type)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, orgId || null, keywords, diarioType]
  );
  logger.info('Monitor de diário criado', { id: res.rows[0].id, userId, diarioType, keywords });
  return res.rows[0];
}

/**
 * Lista monitores ativos escopados por org (ou por usuário como fallback)
 */
async function listMonitors(userId, orgId = null) {
  const filter = orgId ? 'org_id = $1' : 'user_id = $1';
  const param = orgId || userId;
  const res = await pool.query(
    `SELECT * FROM diario_monitors WHERE ${filter} AND active = true ORDER BY created_at DESC`,
    [param]
  );
  return res.rows;
}

/**
 * Busca publicações no DOU por palavra-chave
 * Nota: A API real do DOU pode variar. Esta é uma implementação base
 * que pode precisar de ajuste conforme o endpoint disponível.
 */
async function searchDOU(keyword) {
  try {
    // API pública do Diário Oficial da União (Imprensa Nacional)
    const response = await axios.get('https://www.in.gov.br/consulta/-/buscar/dou', {
      params: {
        q: keyword,
        s: 0,
        sortType: 0,
      },
      headers: {
        'User-Agent': 'DrLex/2.0',
      },
      timeout: 15000,
    });

    // Parsear resultado conforme formato da resposta
    // A estrutura pode variar - adaptar conforme API real
    if (response.data && Array.isArray(response.data.jsonArray)) {
      return response.data.jsonArray.map((item) => ({
        title: item.title || '',
        excerpt: item.content?.substring(0, 500) || '',
        date: item.pubDate || item.date || '',
        url: item.urlTitle
          ? `https://www.in.gov.br/web/dou/-/${item.urlTitle}`
          : '',
        section: item.pubName || '',
      }));
    }

    return [];
  } catch (err) {
    logger.error(`Erro ao buscar DOU para "${keyword}":`, err.message);
    return [];
  }
}

/**
 * Executa varredura de todos os monitores ativos
 * Chamado pelo cron job
 */
async function runScan() {
  logger.info('Iniciando varredura de diários oficiais...');

  const monitors = await pool.query(
    `SELECT m.*, u.name as user_name, u.whatsapp, u.telegram_id
     FROM diario_monitors m
     JOIN users u ON m.user_id = u.id
     WHERE m.active = true`
  );

  const alerts = [];

  for (const monitor of monitors.rows) {
    for (const keyword of monitor.keywords) {
      try {
        let results = [];

        if (monitor.diario_type === 'DOU') {
          results = await searchDOU(keyword);
        }
        // TODO: Implementar DOE e DOM conforme estado/município

        for (const result of results) {
          // Verificar se já foi alertado (evitar duplicatas)
          const existing = await pool.query(
            `SELECT id FROM diario_alerts
             WHERE monitor_id = $1 AND url = $2`,
            [monitor.id, result.url]
          );

          if (existing.rows.length === 0 && result.url) {
            const alert = await pool.query(
              `INSERT INTO diario_alerts (monitor_id, user_id, org_id, diario_type, edition_date, matched_keyword, excerpt, url)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
              [
                monitor.id,
                monitor.user_id,
                monitor.org_id || null,
                monitor.diario_type,
                result.date || new Date(),
                keyword,
                result.excerpt,
                result.url,
              ]
            );
            alerts.push({
              ...alert.rows[0],
              user_name: monitor.user_name,
              whatsapp: monitor.whatsapp,
              telegram_id: monitor.telegram_id,
            });
          }
        }
      } catch (err) {
        logger.error(`Erro no monitor ${monitor.id}, keyword "${keyword}":`, err.message);
      }
    }
  }

  logger.info(`Varredura concluída. ${alerts.length} novos alertas.`);
  return alerts;
}

/**
 * Busca alertas não notificados
 */
async function getUnnotifiedAlerts() {
  const res = await pool.query(
    `SELECT a.*, u.whatsapp, u.telegram_id, u.name as user_name
     FROM diario_alerts a
     JOIN users u ON a.user_id = u.id
     WHERE a.notified = false
     ORDER BY a.created_at DESC`
  );
  return res.rows;
}

/**
 * Marca alerta como notificado
 */
async function markNotified(alertId) {
  await pool.query(`UPDATE diario_alerts SET notified = true WHERE id = $1`, [alertId]);
}

module.exports = {
  createMonitor,
  listMonitors,
  searchDOU,
  runScan,
  getUnnotifiedAlerts,
  markNotified,
};
