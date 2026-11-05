import {
  IsEmail,
  IsNotEmpty,
  Matches,
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
  @Matches(/^[A-Z0-9._%+-]+@(gmail\.com|hotmail\.com|outlook\.com)$/i, {
    message: 'El correo debe pertenecer a Gmail, Hotmail u Outlook (.com)',
  })
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
