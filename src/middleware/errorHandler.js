const config = require('../config');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.code || 'internal_error';
  let message = err.message || 'Внутренняя ошибка сервера';
  let detail = err.detail || null;

  if (err.name === 'ZodError') {
    statusCode = 422;
    errorCode = 'validation_error';
    message = 'Ошибка валидации';
    detail = err.errors.reduce((acc, e) => {
      const path = e.path.join('.');
      acc[path] = e.message;
      return acc;
    }, {});
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      statusCode = 409;
      errorCode = 'conflict';
      message = 'Ресурс уже существует';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      errorCode = 'not_found';
      message = 'Ресурс не найден';
    } else if (err.code === 'P2003') {
      statusCode = 409;
      errorCode = 'conflict';
      message = 'Нарушение ограничения внешнего ключа';
    }
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'unauthorized';
    message = 'Недействительный или просроченный токен';
  }

  const response = {
    error: errorCode,
    message,
  };

  if (detail) {
    response.detail = detail;
  }

  if (!config.isProduction && statusCode === 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
