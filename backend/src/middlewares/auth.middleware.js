const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth.config');

/**
 * Express middleware that verifies a JWT from the Authorization header.
 *
 * Expects: `Authorization: Bearer <token>`
 *
 * On success → attaches `req.admin` with { id, email, name } and calls next().
 * On failure → responds with 401.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 401,
        message: 'Authentication required. Provide a Bearer token.',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.admin = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Token has expired'
        : 'Invalid or malformed token';

    return res.status(401).json({
      success: false,
      error: {
        code: 401,
        message,
      },
    });
  }
};

module.exports = { authenticate };
