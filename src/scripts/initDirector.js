#!/usr/bin/env node
/**
 * Init Director Script
 * Run once on first deploy: node src/scripts/initDirector.js
 * Creates the single director account if none exists.
 */
const prisma = require('../utils/prisma');
const { hashPassword } = require('../utils/password');

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: 'director' } });
  if (existing) {
    console.log('Director already exists:', existing.email);
    await prisma.$disconnect();
    return;
  }

  const email = process.env.DIRECTOR_EMAIL || 'director@lexlink.io';
  const password = process.env.DIRECTOR_PASSWORD || 'DirectorPass123!';
  const fullName = process.env.DIRECTOR_NAME || 'Главный Директор';

  const hashed = await hashPassword(password);
  const director = await prisma.user.create({
    data: {
      email,
      full_name: fullName,
      hashed_password: hashed,
      role: 'director',
      is_active: true,
      must_change_password: false,
    },
  });

  console.log('Director created:', director.email);
  console.log('Temporary password (save it!):', password);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
