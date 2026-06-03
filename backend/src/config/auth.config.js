/**
 * Authentication configuration.
 * Reads JWT settings from environment variables.
 */
module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  saltRounds: 10,
};
