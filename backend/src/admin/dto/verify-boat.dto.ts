import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VerificationStatus } from '../../boats/boat.entity.js';

export class VerifyBoatDto {
  @IsIn([VerificationStatus.APPROVED, VerificationStatus.REJECTED])
  status!: VerificationStatus.APPROVED | VerificationStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}
