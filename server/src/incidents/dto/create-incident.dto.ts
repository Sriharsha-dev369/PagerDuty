import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Severity } from '../../generated/prisma/enums';

export class CreateIncidentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;
}
