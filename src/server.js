const app = require('./app');
const config = require('./config');
const prisma = require('./utils/prisma');
const redis = require('./utils/redis');
const { runEmailWorker, stopEmailWorker } = require('./workers/emailWorker');

const PORT = config.port;

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Database connected');

    await redis.ping();
    console.log('Redis connected');

    app.listen(PORT, () => {
      console.log(`\n${config.appName} running on http://localhost:${PORT}`);
      console.log(`API Docs: http://localhost:${PORT}/docs`);
    });

    runEmailWorker().catch((err) => {
      console.error('Email worker stopped:', err.message);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  stopEmailWorker();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
