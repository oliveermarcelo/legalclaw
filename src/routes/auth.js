const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/migrate');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, password, whatsapp } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, whatsapp, plan)
       VALUES ($1, $2, $3, $4, 'solo') RETURNING id, name, email, plan, whatsapp, created_at`,
      [name, email, passwordHash, whatsapp || null]
    );
    const user = userResult.rows[0];

    // Criar org pessoal
    const slugBase = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    let slug = slugBase;
    let suffix = 1;
    while ((await client.query('SELECT id FROM organizations WHERE slug = $1', [slug])).rows.length > 0) {
      slug = `${slugBase}-${suffix++}`;
    }

    const orgResult = await client.query(
      `INSERT INTO organizations (name, slug, plan, owner_id) VALUES ($1, $2, 'solo', $3) RETURNING id, name, slug, plan`,
      [name, slug, user.id]
    );
    const org = orgResult.rows[0];

    await client.query(
      `INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [org.id, user.id]
    );

    await client.query('COMMIT');

    const token = jwt.sign(
      { userId: user.id, email: user.email, plan: org.plan, orgId: org.id },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    logger.info('Novo usuário registrado:', { id: user.id, email: user.email, orgId: org.id });

    res.status(201).json({
      success: true,
      data: { user, org, token },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Erro no registro:', err.message);
    res.status(500).json({ error: 'Erro ao criar conta' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const result = await pool.query(
      'SELECT id, name, email, password_hash, plan, whatsapp, active, is_super_admin, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const user = result.rows[0];

    if (!user.active) {
      return res.status(403).json({ error: 'Conta desativada' });
    }

    // Verificar senha
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Buscar org principal do usuário
    const orgResult = await pool.query(
      `SELECT o.id, o.name, o.slug, o.plan
       FROM organizations o
       JOIN org_memberships om ON om.org_id = o.id
       WHERE om.user_id = $1 AND o.active = true
       ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, om.created_at ASC
       LIMIT 1`,
      [user.id]
    );
    const org = orgResult.rows[0] || null;

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        plan: org?.plan || user.plan,
        orgId: org?.id || null,
        isSuperAdmin: user.is_super_admin || false,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Remover hash da resposta
    delete user.password_hash;

    res.json({
      success: true,
      data: { user, org, token },
    });
  } catch (err) {
    logger.error('Erro no login:', err.message);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

/**
 * GET /api/auth/me
 * Requer autenticação
 */
router.get('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const result = await pool.query(
      `SELECT id, name, email, plan, whatsapp, telegram_id, active, created_at
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Buscar orgs do usuário
    const orgsResult = await pool.query(
      `SELECT o.id, o.name, o.slug, o.plan, om.role
       FROM organizations o
       JOIN org_memberships om ON om.org_id = o.id
       WHERE om.user_id = $1 AND o.active = true
       ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, om.created_at ASC`,
      [req.user.userId]
    );

    const orgId = req.user.orgId || null;

    // Buscar estatísticas (escopadas por org quando disponível)
    const statsParams = orgId ? [orgId] : [req.user.userId];
    const statsFilter = orgId ? 'org_id = $1' : 'user_id = $1';
    const stats = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM contracts WHERE ${statsFilter}) as total_contracts,
        (SELECT COUNT(*) FROM contracts WHERE ${statsFilter} AND created_at >= NOW() - INTERVAL '30 days') as contracts_month,
        (SELECT COUNT(*) FROM deadlines WHERE ${statsFilter} AND status = 'active') as active_deadlines,
        (SELECT COUNT(*) FROM deadlines WHERE ${statsFilter} AND status = 'active' AND deadline_date <= NOW() + INTERVAL '3 days') as urgent_deadlines,
        (SELECT COUNT(*) FROM diario_monitors WHERE ${statsFilter} AND active = true) as active_monitors,
        (SELECT COUNT(*) FROM diario_alerts WHERE ${statsFilter} AND notified = false) as unread_alerts`,
      statsParams
    );

    res.json({
      success: true,
      data: {
        user: result.rows[0],
        orgs: orgsResult.rows,
        currentOrgId: orgId,
        stats: stats.rows[0],
      },
    });
  } catch (err) {
    logger.error('Erro ao buscar perfil:', err.message);
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

/**
 * PUT /api/auth/me
 * Atualizar perfil
 */
router.put('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { name, whatsapp, currentPassword, newPassword } = req.body;

    // Se trocar senha, verificar a atual
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Senha atual é obrigatória para trocar senha' });
      }
      const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
      const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Senha atual incorreta' });
      }
      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.userId]);
    }

    // Atualizar outros campos
    if (name || whatsapp !== undefined) {
      const fields = [];
      const values = [];
      let idx = 1;

      if (name) { fields.push(`name = $${idx++}`); values.push(name); }
      if (whatsapp !== undefined) { fields.push(`whatsapp = $${idx++}`); values.push(whatsapp || null); }
      fields.push(`updated_at = NOW()`);
      values.push(req.user.userId);

      await pool.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    res.json({ success: true, message: 'Perfil atualizado' });
  } catch (err) {
    logger.error('Erro ao atualizar perfil:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar' });
  }
});

module.exports = router;
