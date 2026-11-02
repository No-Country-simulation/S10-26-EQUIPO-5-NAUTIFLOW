import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SearchFleetDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  minPassengers!: number;

  @IsDateString()
  availableAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zone?: string;
}
