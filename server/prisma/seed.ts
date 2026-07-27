import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Dev seed: clean slate, deleted in FK-dependency order so re-running is deterministic.
  await prisma.notification.deleteMany();
  await prisma.incidentEvent.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.rotationMember.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.service.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();

  // Short 1-minute timeout so escalation is quick to demo.
  const team = await prisma.team.create({
    data: { name: 'Platform', escalationTimeoutMinutes: 1 },
  });

  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'seed-placeholder-no-auth-yet',
    },
  });
  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob',
      passwordHash: 'seed-placeholder-no-auth-yet',
    },
  });

  await prisma.membership.createMany({
    data: [
      { userId: alice.id, teamId: team.id, role: 'RESPONDER' },
      { userId: bob.id, teamId: team.id, role: 'RESPONDER' },
    ],
  });

  const service = await prisma.service.create({
    data: {
      name: 'API Gateway',
      description: 'Public API edge',
      teamId: team.id,
      integrationKey: randomBytes(16).toString('hex'),
    },
  });

  // Escalation chain: Alice is primary (order 0), Bob is next (order 1).
  await prisma.rotationMember.createMany({
    data: [
      { teamId: team.id, userId: alice.id, order: 0 },
      { teamId: team.id, userId: bob.id, order: 1 },
    ],
  });

  console.log('Seeded:');
  console.log(`  team:    ${team.id}  ${team.name}  (timeout ${team.escalationTimeoutMinutes}m)`);
  console.log(`  service: ${service.id}  ${service.name}`);
  console.log(`  integrationKey: ${service.integrationKey}`);
  console.log(`  rotation: [0] Alice ${alice.id}  →  [1] Bob ${bob.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
