import { Module } from '@nestjs/common';
import { IncidentsModule } from '../incidents/incidents.module';
import { EscalationScheduler } from './escalation.scheduler';

@Module({
  imports: [IncidentsModule],
  providers: [EscalationScheduler],
})
export class EscalationModule {}
