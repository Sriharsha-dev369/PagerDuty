import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import type { IncidentEventType } from '../generated/prisma/enums';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { AckIncidentDto } from './dto/ack-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';

interface IncidentBodyFields {
  title: string;
  severity: string;
  status: string;
  description: string | null;
}

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  // ── Create (state: → TRIGGERED) ─────────────────────────────────────
  async create(serviceId: string, dto: CreateIncidentDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        team: { include: { rotationMembers: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!service) throw new NotFoundException(`Service ${serviceId} not found`);

    const team = service.team;
    const chain = team.rotationMembers;
    const primary = chain[0]; // undefined → no rotation → unassigned
    const now = new Date();
    const nextEscalationAt = primary
      ? new Date(now.getTime() + team.escalationTimeoutMinutes * 60_000)
      : null;

    const incident = await this.prisma.incident.create({
      data: {
        serviceId,
        title: dto.title,
        description: dto.description ?? null,
        severity: dto.severity ?? 'P3',
        status: 'TRIGGERED',
        source: 'MANUAL',
        currentOnCallIndex: 0,
        assignedUserId: primary?.userId ?? null,
        nextEscalationAt,
      },
    });

    await this.addEvent(
      incident.id,
      'TRIGGERED',
      null,
      `Incident created (severity ${incident.severity})`,
    );

    if (primary) {
      await this.sendNotification(
        incident.id,
        primary.userId,
        `[TRIGGERED] ${incident.title}`,
        this.body(incident),
      );
      await this.addEvent(incident.id, 'NOTIFIED', null, 'Paged on-call (order 0)');
    } else {
      // Empty rotation — never drop the alert: notify the team's admins instead.
      const admins = await this.prisma.membership.findMany({
        where: { teamId: team.id, role: 'ADMIN' },
      });
      for (const admin of admins) {
        await this.sendNotification(
          incident.id,
          admin.userId,
          `[TRIGGERED · no on-call] ${incident.title}`,
          this.body(incident),
        );
      }
      await this.addEvent(
        incident.id,
        'NOTIFIED',
        null,
        `No on-call rotation; notified ${admins.length} admin(s)`,
      );
    }

    return this.findOne(incident.id);
  }

  // ── Acknowledge (TRIGGERED → ACKNOWLEDGED) ──────────────────────────
  async ack(id: string, dto: AckIncidentDto) {
    const incident = await this.loadWithService(id);
    if (incident.status === 'RESOLVED')
      throw new ConflictException('Incident is already resolved');
    if (incident.status === 'ACKNOWLEDGED')
      throw new ConflictException('Incident is already acknowledged');
    await this.assertResponder(dto.userId, incident.service.teamId);

    await this.prisma.incident.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        assignedUserId: dto.userId, // ack transfers ownership to the acker
        acknowledgedAt: new Date(),
        acknowledgedById: dto.userId,
        nextEscalationAt: null, // stop the escalation timer
      },
    });
    await this.addEvent(id, 'ACKNOWLEDGED', dto.userId, 'Acknowledged');
    return this.findOne(id);
  }

  // ── Resolve (TRIGGERED | ACKNOWLEDGED → RESOLVED, terminal) ──────────
  async resolve(id: string, dto: ResolveIncidentDto) {
    const incident = await this.loadWithService(id);
    if (incident.status === 'RESOLVED')
      throw new ConflictException('Incident is already resolved');
    await this.assertResponder(dto.userId, incident.service.teamId);

    await this.prisma.incident.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: dto.userId,
        nextEscalationAt: null,
      },
    });
    await this.addEvent(id, 'RESOLVED', dto.userId, 'Resolved');
    return this.findOne(id);
  }

  // ── Escalation (TRIGGERED → TRIGGERED, next in chain) ───────────────
  // Plain method so the scheduler's @Interval calls it and tests drive it
  // with a controlled `now`.
  async escalateDue(now: Date = new Date()) {
    const due = await this.prisma.incident.findMany({
      where: { status: 'TRIGGERED', nextEscalationAt: { not: null, lte: now } },
      include: {
        service: {
          include: {
            team: { include: { rotationMembers: { orderBy: { order: 'asc' } } } },
          },
        },
      },
    });

    const results: Array<{ id: string; escalatedTo: number | null }> = [];
    for (const inc of due) {
      const chain = inc.service.team.rotationMembers;
      const nextIndex = inc.currentOnCallIndex + 1;

      if (nextIndex < chain.length) {
        const nextUser = chain[nextIndex].userId;
        const timeout = inc.service.team.escalationTimeoutMinutes;
        await this.prisma.incident.update({
          where: { id: inc.id },
          data: {
            currentOnCallIndex: nextIndex,
            assignedUserId: nextUser,
            nextEscalationAt: new Date(now.getTime() + timeout * 60_000),
          },
        });
        await this.addEvent(
          inc.id,
          'ESCALATED',
          null,
          `Escalated to on-call order ${nextIndex}`,
        );
        await this.sendNotification(
          inc.id,
          nextUser,
          `[ESCALATED] ${inc.title}`,
          this.body(inc),
        );
        results.push({ id: inc.id, escalatedTo: nextIndex });
      } else {
        // End of chain — stop escalating, leave assigned to the last person.
        await this.prisma.incident.update({
          where: { id: inc.id },
          data: { nextEscalationAt: null },
        });
        results.push({ id: inc.id, escalatedTo: null });
      }
    }
    return results;
  }

  // ── Reads ───────────────────────────────────────────────────────────
  async findAll(query: { serviceId?: string; status?: string }) {
    return this.prisma.incident.findMany({
      where: {
        serviceId: query.serviceId,
        status: query.status as never,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        notifications: true,
      },
    });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  private async loadWithService(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: { service: true },
    });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  private async assertResponder(userId: string, teamId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (!membership)
      throw new ForbiddenException('User is not a member of this team');
    if (membership.role === 'VIEWER')
      throw new ForbiddenException('Viewers cannot act on incidents');
  }

  private async addEvent(
    incidentId: string,
    type: IncidentEventType,
    actorUserId: string | null,
    message: string,
  ) {
    await this.prisma.incidentEvent.create({
      data: { incidentId, type, actorUserId, message },
    });
  }

  /** Creates a Notification row, sends the email inline, marks SENT/FAILED. */
  private async sendNotification(
    incidentId: string,
    userId: string,
    subject: string,
    text: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: { incidentId, userId, channel: 'EMAIL', status: 'PENDING' },
    });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED', lastError: 'recipient not found' },
      });
      return;
    }
    try {
      const result = await this.mailer.send({ to: user.email, subject, text });
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      });
      if (result.previewUrl)
        this.logger.log(`Notification ${notification.id} → ${result.previewUrl}`);
    } catch (err) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          attempts: { increment: 1 },
          lastError: (err as Error).message,
        },
      });
      this.logger.warn(
        `Notification ${notification.id} failed: ${(err as Error).message}`,
      );
    }
  }

  private body(incident: IncidentBodyFields) {
    return [
      `Incident: ${incident.title}`,
      `Severity: ${incident.severity}`,
      `Status: ${incident.status}`,
      '',
      incident.description ?? '',
    ].join('\n');
  }
}
