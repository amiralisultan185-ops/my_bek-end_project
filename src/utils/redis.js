const Redis = require('ioredis');
const config = require('../config');

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.key = function key(name) {
  return config.redisKeyPrefix ? `${config.redisKeyPrefix}:${name}` : name;
};

module.exports = redis;
