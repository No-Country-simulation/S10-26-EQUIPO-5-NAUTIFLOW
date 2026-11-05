import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VerificationStatus } from '../../boats/boat.entity.js';

export class VerifyBoatDto {
  @IsIn([VerificationStatus.APPROVED, VerificationStatus.REJECTED])
  status!: VerificationStatus.APPROVED | VerificationStatus.REJECTED;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  documentedPassengerCapacity?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}
