import {
  IsDateString,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTripDto {
  @IsUUID()
  boatId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  origin!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destination!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
