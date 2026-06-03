/**
 * Creates a middleware that validates required fields in req.body.
 * Returns 422 with the standard error envelope if any field is missing.
 *
 * @param {string[]} fields - Array of required field names
 * @returns {Function} Express middleware
 */
const requireFields = (fields) => {
  return (req, res, next) => {
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        return res.status(422).json({
          success: false,
          error: {
            code: 422,
            message: `${field} is required`,
          },
        });
      }
    }
    next();
  };
};

module.exports = { requireFields };
