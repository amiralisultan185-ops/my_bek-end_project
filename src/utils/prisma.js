const { PrismaClient } = require('@prisma/client');
const config = require('../config');

const prisma = new PrismaClient({
  log: config.isProduction ? ['error'] : ['query', 'error', 'warn'],
});

module.exports = prisma;
