const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/migrate');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/admin/stats — estatísticas globais do sistema
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE active = true)::int                        AS total_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_users_month,
        (SELECT COUNT(*) FROM organizations WHERE active = true)::int                AS total_orgs,
        (SELECT COUNT(*) FROM contracts)::int                                        AS total_contracts,
        (SELECT COUNT(*) FROM contracts WHERE created_at >= NOW() - INTERVAL '30 days')::int AS contracts_month,
        (SELECT COUNT(*) FROM deadlines WHERE status = 'active')::int                AS active_deadlines,
        (SELECT COUNT(*) FROM knowledge_sources WHERE active = true)::int            AS knowledge_sources,
        (SELECT COUNT(*) FROM generated_contracts)::int                              AS generated_contracts,
        (SELECT COUNT(*) FROM external_query_logs WHERE created_at >= NOW() - INTERVAL '7 days')::int AS api_calls_week,
        (SELECT COUNT(*) FROM prospecting_searches WHERE created_at >= NOW() - INTERVAL '30 days')::int AS prospecting_month
    `);

    const planBreakdown = await pool.query(`
      SELECT plan, COUNT(*)::int AS count
      FROM users
      WHERE active = true
      GROUP BY plan
      ORDER BY count DESC
    `);

    const dailyActivity = await pool.query(`
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*)::int AS contracts
      FROM contracts
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);

    res.json({
      success: true,
      data: {
        stats: result.rows[0],
        planBreakdown: planBreakdown.rows,
        dailyActivity: dailyActivity.rows,
      },
    });
  } catch (err) {
    logger.error('Admin stats error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// GET /api/admin/users — listar todos os usuários
router.get('/users', async (req, res) => {
  try {
    const { search, plan, active, limit = 100, offset = 0 } = req.query;
    const params = [];
    const conditions = [];
    let idx = 1;

    if (search) {
      conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (plan) {
      conditions.push(`u.plan = $${idx++}`);
      params.push(plan);
    }
    if (active !== undefined) {
      conditions.push(`u.active = $${idx++}`);
      params.push(active === 'true');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Math.min(parseInt(limit, 10) || 100, 500));
    params.push(Math.max(parseInt(offset, 10) || 0, 0));

    const result = await pool.query(
      `SELECT
         u.id, u.name, u.email, u.plan, u.whatsapp, u.active, u.is_super_admin,
         u.created_at,
         (SELECT COUNT(*)::int FROM contracts WHERE user_id = u.id) AS contract_count,
         (SELECT COUNT(*)::int FROM deadlines WHERE user_id = u.id AND status = 'active') AS active_deadlines,
         o.name AS org_name, o.id AS org_id, o.plan AS org_plan
       FROM users u
       LEFT JOIN org_memberships om ON om.user_id = u.id AND om.role = 'owner'
       LEFT JOIN organizations o ON o.id = om.org_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM users u ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      success: true,
      data: {
        users: result.rows,
        total: countResult.rows[0].total,
      },
    });
  } catch (err) {
    logger.error('Admin list users error:', err.message);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// PATCH /api/admin/users/:id — atualizar usuário (ativar/desativar, plano, etc.)
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { active, plan, name, isSuperAdmin, resetPassword } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (active !== undefined) { fields.push(`active = $${idx++}`); values.push(active); }
    if (plan !== undefined) { fields.push(`plan = $${idx++}`); values.push(plan); }
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (isSuperAdmin !== undefined) { fields.push(`is_super_admin = $${idx++}`); values.push(isSuperAdmin); }

    if (resetPassword) {
      const hash = await bcrypt.hash(resetPassword, 10);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, plan, active, is_super_admin`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Se mudou o plano, sincronizar com a org pessoal (owner)
    if (plan !== undefined) {
      await pool.query(
        `UPDATE organizations SET plan = $1, updated_at = NOW()
         WHERE owner_id = $2
           AND id = (
             SELECT org_id FROM org_memberships WHERE user_id = $2 AND role = 'owner' LIMIT 1
           )`,
        [plan, id]
      );
    }

    logger.info('Admin: usuário atualizado', { targetId: id, by: req.user.userId });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Admin update user error:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// GET /api/admin/orgs — listar todas as organizações
router.get('/orgs', async (req, res) => {
  try {
    const { search, plan, limit = 100, offset = 0 } = req.query;
    const params = [];
    const conditions = [];
    let idx = 1;

    if (search) {
      conditions.push(`(o.name ILIKE $${idx} OR o.slug ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (plan) {
      conditions.push(`o.plan = $${idx++}`);
      params.push(plan);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Math.min(parseInt(limit, 10) || 100, 500));
    params.push(Math.max(parseInt(offset, 10) || 0, 0));

    const result = await pool.query(
      `SELECT
         o.id, o.name, o.slug, o.plan, o.active, o.created_at,
         u.name AS owner_name, u.email AS owner_email,
         (SELECT COUNT(*)::int FROM org_memberships om2 WHERE om2.org_id = o.id) AS member_count,
         (SELECT COUNT(*)::int FROM contracts WHERE org_id = o.id) AS contract_count
       FROM organizations o
       LEFT JOIN users u ON u.id = o.owner_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Admin list orgs error:', err.message);
    res.status(500).json({ error: 'Erro ao listar organizações' });
  }
});

// PATCH /api/admin/orgs/:id — atualizar org
router.patch('/orgs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { active, plan, name } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (active !== undefined) { fields.push(`active = $${idx++}`); values.push(active); }
    if (plan !== undefined) { fields.push(`plan = $${idx++}`); values.push(plan); }
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Organização não encontrada' });

    logger.info('Admin: org atualizada', { orgId: id, by: req.user.userId });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Admin update org error:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar organização' });
  }
});

// GET /api/admin/plans — listar features por plano
router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT plan_name, feature_key, enabled, config, updated_at
       FROM plan_features
       ORDER BY plan_name, feature_key`
    );

    // Agrupar por plano
    const byPlan = {};
    for (const row of result.rows) {
      if (!byPlan[row.plan_name]) byPlan[row.plan_name] = [];
      byPlan[row.plan_name].push({
        key: row.feature_key,
        enabled: row.enabled,
        config: row.config,
        updatedAt: row.updated_at,
      });
    }

    res.json({ success: true, data: byPlan });
  } catch (err) {
    logger.error('Admin list plans error:', err.message);
    res.status(500).json({ error: 'Erro ao listar planos' });
  }
});

// PUT /api/admin/plans/:plan/features/:feature — atualizar feature de um plano
router.put('/plans/:plan/features/:feature', async (req, res) => {
  try {
    const { plan, feature } = req.params;
    const { enabled, config } = req.body;

    const result = await pool.query(
      `INSERT INTO plan_features (plan_name, feature_key, enabled, config, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (plan_name, feature_key)
       DO UPDATE SET enabled = EXCLUDED.enabled, config = EXCLUDED.config, updated_at = NOW()
       RETURNING *`,
      [plan, feature, enabled !== false, JSON.stringify(config || {})]
    );

    logger.info('Admin: feature atualizada', { plan, feature, enabled, by: req.user.userId });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Admin update feature error:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar feature' });
  }
});

// GET /api/admin/activity — atividade recente do sistema
router.get('/activity', async (req, res) => {
  try {
    const contracts = await pool.query(
      `SELECT 'contract' AS type, c.created_at, u.name AS user_name, u.email,
              c.title AS label, c.risk_level AS meta
       FROM contracts c JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at DESC LIMIT 15`
    );

    const deadlines = await pool.query(
      `SELECT 'deadline' AS type, d.created_at, u.name AS user_name, u.email,
              d.description AS label, d.deadline_date::text AS meta
       FROM deadlines d JOIN users u ON u.id = d.user_id
       ORDER BY d.created_at DESC LIMIT 10`
    );

    const logins = await pool.query(
      `SELECT id, name, email, created_at FROM users
       ORDER BY created_at DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        recentContracts: contracts.rows,
        recentDeadlines: deadlines.rows,
        recentUsers: logins.rows,
      },
    });
  } catch (err) {
    logger.error('Admin activity error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar atividade' });
  }
});

module.exports = router;
