const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config();

function readEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function required(name, fallback) {
  const value = readEnv(name, fallback);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
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

async function main() {
  const host = required('SMTP_HOST');
  const port = Number(required('SMTP_PORT', '587'));
  const user = required('SMTP_USER');
  const password = readEnv('EMAIL_API_KEY') || readEnv('SMTP_PASSWORD');
  const from = readEnv('EMAIL_FROM_ADDRESS') || readEnv('EMAIL_FROM');
  const to = readEnv('SMTP_CHECK_TO') || from;

  if (!password) {
    throw new Error('Missing EMAIL_API_KEY or SMTP_PASSWORD');
  }

  if (!from) {
    throw new Error('Missing EMAIL_FROM_ADDRESS or EMAIL_FROM');
  }

  if ([host, user, password, from, to].some(isPlaceholder)) {
    throw new Error('SMTP check refused: replace placeholder email settings with real provider values first');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });

  await transporter.verify();

  const result = await transporter.sendMail({
    from,
    to,
    subject: 'POWER LAW Digital SMTP check',
    text: 'POWER LAW Digital SMTP is configured correctly. This is a real provider test email.',
  });

  console.log(`SMTP check passed. Message id: ${result.messageId || 'n/a'}`);
}

main().catch((err) => {
  console.error(`SMTP check failed: ${err.message}`);
  process.exit(1);
});
