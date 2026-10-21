import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterOwnerDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(30)
  phone!: string;
}
