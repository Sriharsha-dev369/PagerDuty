import { IsUUID } from 'class-validator';

/**
 * No auth yet in the walking skeleton — the acting user is passed explicitly.
 * JWT replaces this in the auth slice.
 */
export class ResolveIncidentDto {
  @IsUUID()
  userId!: string;
}
