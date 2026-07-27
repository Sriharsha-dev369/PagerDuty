import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { IncidentsService } from '../incidents/incidents.service';
import { EscalationScheduler } from './escalation.scheduler';

/**
 * Integration spec for the load-bearing escalation timing logic (a README
 * success metric). Uses the real Prisma dev DB with an isolated, self-cleaned
 * fixture, and a fake mailer (no network). Drives `runEscalations(now)` with a
 * controlled clock so there is no 30s wait.
 */
describe('EscalationScheduler (integration)', () => {
  let prisma: PrismaService;
  let scheduler: EscalationScheduler;
  const sent: Array<{ to: string }> = [];
  const ids = { team: '', service: '', user0: '', user1: '', incident: '' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        IncidentsService,
        EscalationScheduler,
        {
          provide: MailerService,
          useValue: {
            send: async (m: { to: string }) => {
              sent.push({ to: m.to });
              return { messageId: 'test', previewUrl: undefined };
            },
          },
        },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    scheduler = moduleRef.get(EscalationScheduler);

    const stamp = Date.now();
    const team = await prisma.team.create({
      data: { name: `esc-test-${stamp}`, escalationTimeoutMinutes: 5 },
    });
    const u0 = await prisma.user.create({
      data: { email: `esc0-${stamp}@test.local`, name: 'Esc0', passwordHash: 'x' },
    });
    const u1 = await prisma.user.create({
      data: { email: `esc1-${stamp}@test.local`, name: 'Esc1', passwordHash: 'x' },
    });
    const service = await prisma.service.create({
      data: { name: `esc-svc-${stamp}`, teamId: team.id, integrationKey: `esc-key-${stamp}` },
    });
    await prisma.rotationMember.createMany({
      data: [
        { teamId: team.id, userId: u0.id, order: 0 },
        { teamId: team.id, userId: u1.id, order: 1 },
      ],
    });
    ids.team = team.id;
    ids.service = service.id;
    ids.user0 = u0.id;
    ids.user1 = u1.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { incidentId: ids.incident } });
    await prisma.incidentEvent.deleteMany({ where: { incidentId: ids.incident } });
    await prisma.incident.deleteMany({ where: { serviceId: ids.service } });
    await prisma.rotationMember.deleteMany({ where: { teamId: ids.team } });
    await prisma.service.deleteMany({ where: { id: ids.service } });
    await prisma.team.deleteMany({ where: { id: ids.team } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.user0, ids.user1] } } });
    await prisma.$disconnect();
  });

  it('escalates an overdue TRIGGERED incident to the next on-call person', async () => {
    const past = new Date(Date.now() - 60_000);
    const incident = await prisma.incident.create({
      data: {
        serviceId: ids.service,
        title: 'boom',
        status: 'TRIGGERED',
        currentOnCallIndex: 0,
        assignedUserId: ids.user0,
        nextEscalationAt: past,
      },
    });
    ids.incident = incident.id;

    await scheduler.runEscalations(new Date());

    const after = await prisma.incident.findUnique({ where: { id: incident.id } });
    expect(after?.currentOnCallIndex).toBe(1);
    expect(after?.assignedUserId).toBe(ids.user1);
    expect(after?.nextEscalationAt).not.toBeNull();

    const escalatedEvents = await prisma.incidentEvent.findMany({
      where: { incidentId: incident.id, type: 'ESCALATED' },
    });
    expect(escalatedEvents.length).toBe(1);

    const notifs = await prisma.notification.findMany({
      where: { incidentId: incident.id },
    });
    expect(notifs.length).toBe(1);
    expect(sent.length).toBeGreaterThan(0);
  });

  it('stops escalating once the chain is exhausted', async () => {
    // Incident is now at order 1 (the last person). Force it due again.
    await prisma.incident.update({
      where: { id: ids.incident },
      data: { nextEscalationAt: new Date(Date.now() - 60_000) },
    });

    await scheduler.runEscalations(new Date());

    const after = await prisma.incident.findUnique({ where: { id: ids.incident } });
    expect(after?.currentOnCallIndex).toBe(1); // unchanged — no one past the last
    expect(after?.nextEscalationAt).toBeNull(); // timer stopped
  });
});
