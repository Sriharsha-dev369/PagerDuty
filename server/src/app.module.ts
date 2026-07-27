import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { IncidentsModule } from './incidents/incidents.module';
import { EscalationModule } from './escalation/escalation.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    IncidentsModule,
    EscalationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
