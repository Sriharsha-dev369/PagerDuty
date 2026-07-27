import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { IncidentsService } from '../incidents/incidents.service';

/**
 * Queue-free escalation: an interval polls for TRIGGERED incidents whose
 * `nextEscalationAt` is due and advances them down the on-call chain.
 * `runEscalations(now)` is a plain method (the interval calls it with the
 * current time; tests call it with a controlled clock) — no 30s wait needed.
 */
@Injectable()
export class EscalationScheduler {
  private readonly logger = new Logger(EscalationScheduler.name);

  constructor(private readonly incidents: IncidentsService) {}

  @Interval(30_000)
  async runEscalations(now: Date = new Date()): Promise<void> {
    const results = await this.incidents.escalateDue(now);
    if (results.length > 0) {
      const escalated = results.filter((r) => r.escalatedTo !== null).length;
      const stopped = results.length - escalated;
      this.logger.log(
        `Escalation tick: ${escalated} escalated, ${stopped} reached end of chain`,
      );
    }
  }
}
