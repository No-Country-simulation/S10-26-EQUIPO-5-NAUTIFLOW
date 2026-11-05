import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum BoatAvailability {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
}

export class SearchBoatsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  minCapacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zone?: string;

  @IsOptional()
  @IsEnum(BoatAvailability)
  availability?: BoatAvailability;
}
