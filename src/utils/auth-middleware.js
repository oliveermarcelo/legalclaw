const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../config/migrate');

/**
 * Middleware de autenticação JWT
 * Adiciona req.user se token válido
 * Não bloqueia se token ausente (rotas opcionais)
 */
function authOptional(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch {
    req.user = null;
    next();
  }
}

/**
 * Middleware que EXIGE autenticação
 * Retorna 401 se não autenticado
 */
function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/**
 * Factory que retorna middleware exigindo que o usuário seja membro da org
 * do JWT com papel mínimo 'member', 'admin' ou 'owner'.
 * Adiciona req.orgMembership para uso downstream.
 */
function requireOrgRole(minRole = 'member') {
  const ROLES = ['member', 'admin', 'owner'];
  return async function (req, res, next) {
    const { userId, orgId } = req.user || {};
    if (!orgId) return res.status(400).json({ error: 'orgId ausente no token' });

    try {
      const result = await pool.query(
        `SELECT role FROM org_memberships WHERE org_id = $1 AND user_id = $2`,
        [orgId, userId]
      );
      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Sem acesso a esta organização' });
      }
      const userRoleIdx = ROLES.indexOf(result.rows[0].role);
      const minRoleIdx = ROLES.indexOf(minRole);
      if (userRoleIdx < minRoleIdx) {
        return res.status(403).json({ error: 'Permissão insuficiente' });
      }
      req.orgMembership = result.rows[0];
      next();
    } catch (err) {
      res.status(500).json({ error: 'Erro ao verificar permissão' });
    }
  };
}

/**
 * Middleware que exige que o usuário seja super admin
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }
  next();
}

module.exports = { authOptional, authRequired, requireOrgRole, requireSuperAdmin };
