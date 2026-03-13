const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/migrate');
const config = require('../config');
const { requireOrgRole } = require('../utils/auth-middleware');
const logger = require('../utils/logger');

const router = express.Router();

// Todos os routes aqui exigem authRequired (aplicado no index.js ao montar /api/orgs)

/**
 * GET /api/orgs
 * Lista todas as orgs do usuário autenticado
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.name, o.slug, o.plan, o.active, o.created_at, om.role
       FROM organizations o
       JOIN org_memberships om ON om.org_id = o.id
       WHERE om.user_id = $1 AND o.active = true
       ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, om.created_at ASC`,
      [req.user.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Erro ao listar orgs:', err.message);
    res.status(500).json({ error: 'Erro ao listar organizações' });
  }
});

/**
 * POST /api/orgs
 * Cria uma nova organização (usuário vira owner)
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, slug: slugInput } = req.body;
    if (!name) return res.status(400).json({ error: 'name é obrigatório' });

    const slugBase = (slugInput || name).toLowerCase().replace(/[^a-z0-9]/g, '-');
    let slug = slugBase;
    let suffix = 1;
    while ((await client.query('SELECT id FROM organizations WHERE slug = $1', [slug])).rows.length > 0) {
      slug = `${slugBase}-${suffix++}`;
    }

    await client.query('BEGIN');
    const orgResult = await client.query(
      `INSERT INTO organizations (name, slug, plan, owner_id) VALUES ($1, $2, 'solo', $3) RETURNING id, name, slug, plan, created_at`,
      [name, slug, req.user.userId]
    );
    const org = orgResult.rows[0];
    await client.query(
      `INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [org.id, req.user.userId]
    );
    await client.query('COMMIT');

    logger.info('Organização criada', { orgId: org.id, userId: req.user.userId });
    res.status(201).json({ success: true, data: org });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Erro ao criar org:', err.message);
    res.status(500).json({ error: 'Erro ao criar organização' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/orgs/:id
 * Detalhes de uma org (usuário deve ser membro)
 */
router.get('/:id', async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10);
    const result = await pool.query(
      `SELECT o.id, o.name, o.slug, o.plan, o.active, o.created_at, om.role
       FROM organizations o
       JOIN org_memberships om ON om.org_id = o.id
       WHERE o.id = $1 AND om.user_id = $2`,
      [orgId, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Organização não encontrada' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar organização' });
  }
});

/**
 * PUT /api/orgs/:id
 * Atualiza nome/plano da org (admin ou owner)
 */
router.put('/:id', requireOrgRole('admin'), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10);
    if (orgId !== req.user.orgId) return res.status(403).json({ error: 'Não é a organização ativa no token' });

    const { name, plan } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    if (name) { fields.push(`name = $${idx++}`); values.push(name); }
    if (plan) { fields.push(`plan = $${idx++}`); values.push(plan); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    fields.push(`updated_at = NOW()`);
    values.push(orgId);

    const result = await pool.query(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, slug, plan`,
      values
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Erro ao atualizar org:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar organização' });
  }
});

/**
 * GET /api/orgs/:id/members
 * Lista membros da org
 */
router.get('/:id/members', async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10);
    // verificar que o usuário é membro
    const membership = await pool.query(
      `SELECT role FROM org_memberships WHERE org_id = $1 AND user_id = $2`,
      [orgId, req.user.userId]
    );
    if (membership.rows.length === 0) return res.status(403).json({ error: 'Sem acesso' });

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, om.role, om.created_at
       FROM org_memberships om
       JOIN users u ON u.id = om.user_id
       WHERE om.org_id = $1
       ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, om.created_at ASC`,
      [orgId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar membros' });
  }
});

/**
 * POST /api/orgs/:id/invite
 * Adiciona membro por email (admin ou owner)
 */
router.post('/:id/invite', requireOrgRole('admin'), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10);
    if (orgId !== req.user.orgId) return res.status(403).json({ error: 'Não é a organização ativa no token' });

    const { email, role = 'member' } = req.body;
    if (!email) return res.status(400).json({ error: 'email é obrigatório' });
    if (!['member', 'admin'].includes(role)) return res.status(400).json({ error: 'role deve ser member ou admin' });

    const userResult = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    const targetUser = userResult.rows[0];

    // Verificar se já é membro
    const existing = await pool.query(
      'SELECT id FROM org_memberships WHERE org_id = $1 AND user_id = $2',
      [orgId, targetUser.id]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Usuário já é membro desta organização' });

    await pool.query(
      `INSERT INTO org_memberships (org_id, user_id, role, invited_by) VALUES ($1, $2, $3, $4)`,
      [orgId, targetUser.id, role, req.user.userId]
    );

    logger.info('Membro adicionado à org', { orgId, userId: targetUser.id, role });
    res.json({ success: true, data: { user: targetUser, role } });
  } catch (err) {
    logger.error('Erro ao convidar membro:', err.message);
    res.status(500).json({ error: 'Erro ao adicionar membro' });
  }
});

/**
 * DELETE /api/orgs/:id/members/:userId
 * Remove membro da org (admin/owner, ou o próprio membro saindo)
 */
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10);
    const memberId = parseInt(req.params.memberId, 10);

    const membership = await pool.query(
      `SELECT role FROM org_memberships WHERE org_id = $1 AND user_id = $2`,
      [orgId, req.user.userId]
    );
    if (membership.rows.length === 0) return res.status(403).json({ error: 'Sem acesso' });

    const callerRole = membership.rows[0].role;
    const isSelf = memberId === req.user.userId;
    const isAdminOrOwner = callerRole === 'admin' || callerRole === 'owner';

    if (!isSelf && !isAdminOrOwner) return res.status(403).json({ error: 'Permissão insuficiente' });

    // Owner não pode ser removido
    const targetMembership = await pool.query(
      `SELECT role FROM org_memberships WHERE org_id = $1 AND user_id = $2`,
      [orgId, memberId]
    );
    if (targetMembership.rows[0]?.role === 'owner') {
      return res.status(400).json({ error: 'O owner não pode ser removido da organização' });
    }

    await pool.query('DELETE FROM org_memberships WHERE org_id = $1 AND user_id = $2', [orgId, memberId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover membro' });
  }
});

/**
 * PATCH /api/orgs/:id/members/:memberId/role
 * Altera papel do membro (owner apenas)
 */
router.patch('/:id/members/:memberId/role', requireOrgRole('owner'), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10);
    if (orgId !== req.user.orgId) return res.status(403).json({ error: 'Não é a organização ativa no token' });

    const memberId = parseInt(req.params.memberId, 10);
    const { role } = req.body;
    if (!['member', 'admin'].includes(role)) return res.status(400).json({ error: 'role deve ser member ou admin' });

    const result = await pool.query(
      `UPDATE org_memberships SET role = $1 WHERE org_id = $2 AND user_id = $3 RETURNING *`,
      [role, orgId, memberId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Membro não encontrado' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar papel' });
  }
});

/**
 * POST /api/orgs/switch
 * Troca a org ativa — retorna novo JWT com orgId diferente
 */
router.post('/switch', async (req, res) => {
  try {
    const { orgId } = req.body;
    if (!orgId) return res.status(400).json({ error: 'orgId é obrigatório' });

    const result = await pool.query(
      `SELECT om.role, o.plan, o.name, o.slug
       FROM org_memberships om
       JOIN organizations o ON o.id = om.org_id
       WHERE om.org_id = $1 AND om.user_id = $2 AND o.active = true`,
      [orgId, req.user.userId]
    );

    if (result.rows.length === 0) return res.status(403).json({ error: 'Sem acesso a esta organização' });

    const { plan, name, slug } = result.rows[0];

    const token = jwt.sign(
      { userId: req.user.userId, email: req.user.email, plan, orgId: parseInt(orgId, 10) },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      data: { token, org: { id: parseInt(orgId, 10), name, slug, plan } },
    });
  } catch (err) {
    logger.error('Erro ao trocar org:', err.message);
    res.status(500).json({ error: 'Erro ao trocar organização' });
  }
});

module.exports = router;
