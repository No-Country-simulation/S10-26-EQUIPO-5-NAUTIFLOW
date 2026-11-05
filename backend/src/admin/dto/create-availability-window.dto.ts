import { IsDateString, IsUUID } from 'class-validator';

export class CreateAvailabilityWindowDto {
  @IsUUID()
  boatId!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
