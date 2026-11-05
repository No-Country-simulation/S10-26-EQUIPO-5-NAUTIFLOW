import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBoatDto {
  @IsUUID()
  ownerId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  registrationNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(200)
  passengerCapacity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  coverageZone!: string;
}
