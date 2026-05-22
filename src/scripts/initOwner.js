#!/usr/bin/env node
/**
 * Creates the first platform owner for local setup and pre-defense demos.
 * Run after migrations: npm run db:seed
 */
const prisma = require('../utils/prisma');
const { hashPassword } = require('../utils/password');

async function main() {
  const email = process.env.OWNER_EMAIL || 'owner@example.invalid';
  const password = process.env.OWNER_PASSWORD || 'OwnerPass123!';
  const fullName = process.env.OWNER_NAME || 'POWER LAW Digital Owner';

  const existingOwner = await prisma.user.findFirst({
    where: {
      role: 'owner',
      is_active: true,
    },
  });

  if (existingOwner) {
    const updatedOwner = await prisma.user.update({
      where: { id: existingOwner.id },
      data: {
        email,
        full_name: fullName,
        hashed_password: await hashPassword(password),
        is_active: true,
        must_change_password: false,
        email_verified_at: existingOwner.email_verified_at || new Date(),
      },
      select: { email: true, role: true },
    });
    console.log('Owner already exists:', updatedOwner.email);
    console.log('Role:', updatedOwner.role);
    console.log('Password reset to OWNER_PASSWORD value');
    await prisma.$disconnect();
    return;
  }

  const owner = await prisma.user.create({
    data: {
      email,
      full_name: fullName,
      hashed_password: await hashPassword(password),
      role: 'owner',
      is_active: true,
      must_change_password: false,
      email_verified_at: new Date(),
    },
    select: {
      email: true,
      role: true,
      email_verified_at: true,
    },
  });

  console.log('Owner created:', owner.email);
  console.log('Role:', owner.role);
  console.log('Password:', password);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
