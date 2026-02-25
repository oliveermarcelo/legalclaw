const { pool } = require('../config/migrate');
const logger = require('../utils/logger');

// Feriados nacionais fixos (mês-dia)
const FERIADOS_FIXOS = [
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
];

// Feriados móveis 2025 e 2026 (calcular ou atualizar anualmente)
const FERIADOS_MOVEIS = {
  2025: ['03-03', '03-04', '04-18', '06-19'], // Carnaval, Sexta-feira Santa, Corpus Christi
  2026: ['02-16', '02-17', '04-03', '06-04'],
};

/**
 * Verifica se uma data é dia útil (conforme CPC art. 219)
 */
function isDiaUtil(date) {
  const dayOfWeek = date.getDay();
  // Sábado (6) e Domingo (0) não são dias úteis
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const mesdia = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const ano = date.getFullYear();

  // Feriado fixo
  if (FERIADOS_FIXOS.includes(mesdia)) return false;

  // Feriado móvel
  if (FERIADOS_MOVEIS[ano]?.includes(mesdia)) return false;

  return true;
}

/**
 * Calcula prazo em dias úteis a partir de uma data (CPC art. 219)
 */
function calcularPrazo(dataInicial, diasUteis) {
  const data = new Date(dataInicial);

  // Art. 224 CPC: prazo começa no primeiro dia útil seguinte
  data.setDate(data.getDate() + 1);
  while (!isDiaUtil(data)) {
    data.setDate(data.getDate() + 1);
  }

  let contados = 0;
  while (contados < diasUteis) {
    data.setDate(data.getDate() + 1);
    if (isDiaUtil(data)) contados++;
  }

  return data;
}

/**
 * Calcula prazo em dias corridos
 */
function calcularPrazoCorridos(dataInicial, dias) {
  const data = new Date(dataInicial);
  data.setDate(data.getDate() + dias);

  // Se cair em dia não útil, prorroga para o próximo dia útil (CPC art. 224, §1º)
  while (!isDiaUtil(data)) {
    data.setDate(data.getDate() + 1);
  }

  return data;
}

/**
 * Cria um novo prazo
 */
async function create(userId, { processNumber, description, deadlineDate, deadlineType, diasUteis = true }) {
  const res = await pool.query(
    `INSERT INTO deadlines (user_id, process_number, description, deadline_date, deadline_type, dias_uteis)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, processNumber, description, deadlineDate, deadlineType, diasUteis]
  );
  logger.info('Prazo criado', { id: res.rows[0].id, userId, date: deadlineDate });
  return res.rows[0];
}

/**
 * Lista prazos ativos de um usuário
 */
async function listActive(userId) {
  const res = await pool.query(
    `SELECT * FROM deadlines
     WHERE user_id = $1 AND status = 'active'
     ORDER BY deadline_date ASC`,
    [userId]
  );
  return res.rows;
}

/**
 * Busca prazos que vencem nos próximos N dias (para alertas)
 */
async function getUpcoming(days = 3) {
  const res = await pool.query(
    `SELECT d.*, u.name as user_name, u.whatsapp, u.telegram_id
     FROM deadlines d
     JOIN users u ON d.user_id = u.id
     WHERE d.status = 'active'
       AND d.notified = false
       AND d.deadline_date <= NOW() + INTERVAL '${days} days'
       AND d.deadline_date >= NOW()
     ORDER BY d.deadline_date ASC`
  );
  return res.rows;
}

/**
 * Marca prazo como notificado
 */
async function markNotified(deadlineId) {
  await pool.query(
    `UPDATE deadlines SET notified = true WHERE id = $1`,
    [deadlineId]
  );
}

/**
 * Marca prazo como cumprido
 */
async function markCompleted(deadlineId, userId) {
  await pool.query(
    `UPDATE deadlines SET status = 'completed' WHERE id = $1 AND user_id = $2`,
    [deadlineId, userId]
  );
}

// Prazos comuns do CPC
const PRAZOS_CPC = {
  contestacao: { dias: 15, uteis: true, lei: 'Art. 335 CPC' },
  recurso_apelacao: { dias: 15, uteis: true, lei: 'Art. 1.003 CPC' },
  agravo_instrumento: { dias: 15, uteis: true, lei: 'Art. 1.015 CPC' },
  embargos_declaracao: { dias: 5, uteis: true, lei: 'Art. 1.023 CPC' },
  recurso_especial: { dias: 15, uteis: true, lei: 'Art. 1.029 CPC' },
  recurso_extraordinario: { dias: 15, uteis: true, lei: 'Art. 1.029 CPC' },
  impugnacao_cumprimento: { dias: 15, uteis: true, lei: 'Art. 525 CPC' },
  embargos_execucao: { dias: 15, uteis: true, lei: 'Art. 915 CPC' },
  replica: { dias: 15, uteis: true, lei: 'Art. 351 CPC' },
  manifestacao: { dias: 5, uteis: true, lei: 'Art. 218 CPC' },
};

module.exports = {
  isDiaUtil,
  calcularPrazo,
  calcularPrazoCorridos,
  create,
  listActive,
  getUpcoming,
  markNotified,
  markCompleted,
  PRAZOS_CPC,
};
