const jwt = require('jsonwebtoken');
const config = require('../config');

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

module.exports = { authOptional, authRequired };
