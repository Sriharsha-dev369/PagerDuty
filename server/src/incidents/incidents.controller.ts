import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { AckIncidentDto } from './dto/ack-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';

@Controller()
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post('services/:serviceId/incidents')
  create(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.incidents.create(serviceId, dto);
  }

  @Get('incidents')
  findAll(
    @Query('serviceId') serviceId?: string,
    @Query('status') status?: string,
  ) {
    return this.incidents.findAll({ serviceId, status });
  }

  @Get('incidents/:id')
  findOne(@Param('id') id: string) {
    return this.incidents.findOne(id);
  }

  @Post('incidents/:id/ack')
  ack(@Param('id') id: string, @Body() dto: AckIncidentDto) {
    return this.incidents.ack(id, dto);
  }

  @Post('incidents/:id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveIncidentDto) {
    return this.incidents.resolve(id, dto);
  }
}
