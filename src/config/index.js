const dotenv = require('dotenv');
dotenv.config();

function envValue(keys, defaultValue = undefined) {
  const candidates = Array.isArray(keys) ? keys : [keys];
  for (const key of candidates) {
    if (process.env[key] !== undefined && process.env[key] !== '') {
      return process.env[key];
    }
  }
  return defaultValue;
}

function envLabel(keys) {
  return Array.isArray(keys) ? keys.join(' or ') : keys;
}

function requireEnv(keys, defaultValue = undefined) {
  const value = envValue(keys, defaultValue);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${envLabel(keys)}`);
  }
  return value;
}

function requireNumber(keys, defaultValue) {
  const raw = requireEnv(keys, defaultValue);
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric environment variable: ${envLabel(keys)}`);
  }
  return value;
}

function isPlaceholder(value) {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('change-me') ||
    normalized.includes('your-') ||
    normalized.includes('example.invalid') ||
    normalized.includes('example.com') ||
    normalized.includes('smtp.example') ||
    normalized.includes('.invalid');
}

const config = {
  nodeEnv: requireEnv(['ENVIRONMENT', 'NODE_ENV'], 'development'),
  port: requireNumber(['BACKEND_PORT', 'PORT'], '3001'),
  frontendPort: requireNumber('FRONTEND_PORT', '5173'),
  appSecretKey: requireEnv(['JWT_SECRET_KEY', 'APP_SECRET_KEY']),
  refreshSecretKey: requireEnv(['JWT_REFRESH_SECRET_KEY', 'JWT_SECRET_KEY', 'APP_SECRET_KEY']),
  appName: requireEnv('APP_NAME', 'POWER LAW Digital API'),
  publicAppUrl: requireEnv('PUBLIC_APP_URL', 'http://localhost:3001'),
  allowedOrigins: requireEnv(['CORS_ORIGINS', 'ALLOWED_ORIGINS'], 'http://localhost:3001').split(',').map(item => item.trim()).filter(Boolean),

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
  smtpPassword: requireEnv(['EMAIL_API_KEY', 'SMTP_PASSWORD'], ''),
  emailFrom: requireEnv(['EMAIL_FROM_ADDRESS', 'EMAIL_FROM'], 'POWER LAW Digital <noreply@example.invalid>'),
  emailQueueEnabled: requireEnv('EMAIL_QUEUE_ENABLED', 'true') === 'true',
  emailWorkerEnabled: requireEnv('EMAIL_WORKER_ENABLED', 'true') === 'true',
  emailJobMaxAttempts: requireNumber('EMAIL_JOB_MAX_ATTEMPTS', '3'),

  documentEncryptionKey: requireEnv('DOCUMENT_ENCRYPTION_KEY', ''),
  documentMaxUploadBytes: requireNumber('DOCUMENT_MAX_UPLOAD_BYTES', '20971520'),

  get isProduction() {
    return this.nodeEnv === 'production';
  },
};

function validateConfig() {
  if (config.appSecretKey.length < 32) {
    throw new Error('JWT_SECRET_KEY or APP_SECRET_KEY must be at least 32 characters long');
  }

  if (config.refreshSecretKey.length < 32) {
    throw new Error('JWT_REFRESH_SECRET_KEY must be at least 32 characters long');
  }

  if (config.isProduction) {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is required in production');
    if (!config.redisUrl) throw new Error('REDIS_URL is required in production');
    if (isPlaceholder(config.appSecretKey) || isPlaceholder(config.refreshSecretKey)) {
      throw new Error('Production JWT secrets must not use placeholder values');
    }
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
      throw new Error('SMTP_HOST, SMTP_USER and EMAIL_API_KEY/SMTP_PASSWORD are required in production');
    }
    if (isPlaceholder(config.smtpPassword)) {
      throw new Error('Production email credentials must not use placeholder values');
    }
    if (!config.documentEncryptionKey) {
      throw new Error('DOCUMENT_ENCRYPTION_KEY is required in production');
    }
    if (isPlaceholder(config.documentEncryptionKey)) {
      throw new Error('Production document encryption key must not use a placeholder value');
    }
    if (config.allowedOrigins.includes('*')) {
      throw new Error('ALLOWED_ORIGINS cannot contain wildcard in production');
    }
  }
}

validateConfig();

module.exports = config;
