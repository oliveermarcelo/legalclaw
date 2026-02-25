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
  try {
    const { name, email, password, whatsapp } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    // Verificar se email já existe
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Criar usuário
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, whatsapp, plan)
       VALUES ($1, $2, $3, $4, 'solo') RETURNING id, name, email, plan, whatsapp, created_at`,
      [name, email, passwordHash, whatsapp || null]
    );

    const user = result.rows[0];

    // Gerar JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, plan: user.plan },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    logger.info('Novo usuário registrado:', { id: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: { user, token },
    });
  } catch (err) {
    logger.error('Erro no registro:', err.message);
    res.status(500).json({ error: 'Erro ao criar conta' });
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
      'SELECT id, name, email, password_hash, plan, whatsapp, active, created_at FROM users WHERE email = $1',
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

    // Gerar JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, plan: user.plan },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Remover hash da resposta
    delete user.password_hash;

    res.json({
      success: true,
      data: { user, token },
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

    // Buscar estatísticas
    const stats = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM contracts WHERE user_id = $1) as total_contracts,
        (SELECT COUNT(*) FROM contracts WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days') as contracts_month,
        (SELECT COUNT(*) FROM deadlines WHERE user_id = $1 AND status = 'active') as active_deadlines,
        (SELECT COUNT(*) FROM deadlines WHERE user_id = $1 AND status = 'active' AND deadline_date <= NOW() + INTERVAL '3 days') as urgent_deadlines,
        (SELECT COUNT(*) FROM diario_monitors WHERE user_id = $1 AND active = true) as active_monitors,
        (SELECT COUNT(*) FROM diario_alerts WHERE user_id = $1 AND notified = false) as unread_alerts`,
      [req.user.userId]
    );

    res.json({
      success: true,
      data: {
        user: result.rows[0],
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
