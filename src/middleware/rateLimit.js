const redis = require('../utils/redis');
const config = require('../config');

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
}

function createRateLimiter({ keyPrefix, maxRequests, windowSeconds, keyGenerator }) {
  return async (req, res, next) => {
    try {
      const key = keyGenerator ? keyGenerator(req) : `${keyPrefix}:${getClientIp(req)}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      res.setHeader('X-RateLimit-Reset', ttl);

      if (current > maxRequests) {
        const err = new Error('Too many requests. Try again later.');
        err.statusCode = 429;
        err.code = 'rate_limit_exceeded';
        err.detail = { retry_after_seconds: ttl };
        return next(err);
      }

      next();
    } catch (err) {
      console.error(`Rate limiter unavailable for ${keyPrefix}:`, err.message);
      next();
    }
  };
}

const submitRateLimit = createRateLimiter({
  keyPrefix: 'rl:submit',
  maxRequests: config.rateLimitSubmitPerHour,
  windowSeconds: 3600,
});

const loginRateLimit = createRateLimiter({
  keyPrefix: 'rl:login',
  maxRequests: config.rateLimitLoginPerMinute,
  windowSeconds: 60,
});

const apiRateLimit = createRateLimiter({
  keyPrefix: 'rl:api',
  maxRequests: config.rateLimitApiPerMinute,
  windowSeconds: 60,
  keyGenerator: (req) => `rl:api:${req.user?.id || getClientIp(req)}`,
});

module.exports = {
  createRateLimiter,
  submitRateLimit,
  loginRateLimit,
  apiRateLimit,
  getClientIp,
};
