const dotenv = require('dotenv');
dotenv.config();

function requireEnv(key, defaultValue = undefined) {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requireNumber(key, defaultValue) {
  const raw = requireEnv(key, defaultValue);
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric environment variable: ${key}`);
  }
  return value;
}

const config = {
  nodeEnv: requireEnv('NODE_ENV', 'development'),
  port: requireNumber('PORT', '3001'),
  appSecretKey: requireEnv('APP_SECRET_KEY'),
  appName: requireEnv('APP_NAME', 'LexLink API'),
  publicAppUrl: requireEnv('PUBLIC_APP_URL', 'http://localhost:3001'),
  allowedOrigins: requireEnv('ALLOWED_ORIGINS', 'http://localhost:3001').split(',').map(item => item.trim()).filter(Boolean),

  databaseUrl: requireEnv('DATABASE_URL'),
  redisUrl: requireEnv('REDIS_URL', 'redis://localhost:6379/0'),

  jwtAlgorithm: requireEnv('JWT_ALGORITHM', 'HS256'),
  accessTokenExpireMinutes: requireNumber('ACCESS_TOKEN_EXPIRE_MINUTES', '60'),
  refreshTokenExpireDays: requireNumber('REFRESH_TOKEN_EXPIRE_DAYS', '30'),

  otpLength: requireNumber('OTP_LENGTH', '6'),
  otpTtlMinutes: requireNumber('OTP_TTL_MINUTES', '15'),
  otpMaxAttempts: requireNumber('OTP_MAX_ATTEMPTS', '3'),
  otpResendCooldownSeconds: requireNumber('OTP_RESEND_COOLDOWN_SECONDS', '60'),

  emailVerificationTtlMinutes: requireNumber('EMAIL_VERIFICATION_TTL_MINUTES', '30'),
  passwordResetTtlMinutes: requireNumber('PASSWORD_RESET_TTL_MINUTES', '30'),

  rateLimitSubmitPerHour: requireNumber('RATE_LIMIT_SUBMIT_PER_HOUR', '5'),
  rateLimitLoginPerMinute: requireNumber('RATE_LIMIT_LOGIN_PER_MINUTE', '10'),
  rateLimitApiPerMinute: requireNumber('RATE_LIMIT_API_PER_MINUTE', '100'),

  smtpHost: requireEnv('SMTP_HOST', 'localhost'),
  smtpPort: requireNumber('SMTP_PORT', '587'),
  smtpUser: requireEnv('SMTP_USER', ''),
  smtpPassword: requireEnv('SMTP_PASSWORD', ''),
  emailFrom: requireEnv('EMAIL_FROM', 'LexLink <noreply@lexlink.io>'),
  emailQueueEnabled: requireEnv('EMAIL_QUEUE_ENABLED', 'true') === 'true',
  emailWorkerEnabled: requireEnv('EMAIL_WORKER_ENABLED', 'true') === 'true',
  emailJobMaxAttempts: requireNumber('EMAIL_JOB_MAX_ATTEMPTS', '3'),

  s3EndpointUrl: requireEnv('S3_ENDPOINT_URL', ''),
  s3BucketName: requireEnv('S3_BUCKET_NAME', 'lexlink-documents'),
  s3AccessKeyId: requireEnv('S3_ACCESS_KEY_ID', ''),
  s3SecretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY', ''),
  s3Region: requireEnv('S3_REGION', 'us-east-1'),

  get isProduction() {
    return this.nodeEnv === 'production';
  },
};

function validateConfig() {
  if (config.appSecretKey.length < 32) {
    throw new Error('APP_SECRET_KEY must be at least 32 characters long');
  }

  if (config.isProduction) {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is required in production');
    if (!config.redisUrl) throw new Error('REDIS_URL is required in production');
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
      throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required in production');
    }
    if (config.allowedOrigins.includes('*')) {
      throw new Error('ALLOWED_ORIGINS cannot contain wildcard in production');
    }
  }
}

validateConfig();

module.exports = config;
