const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode,
      message: err.message || 'Internal server error',
    },
  });
};

module.exports = errorHandler;
