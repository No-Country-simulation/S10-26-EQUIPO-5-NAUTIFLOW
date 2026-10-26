import { Body, Controller, Post } from '@nestjs/common';
import { RegisterOwnerDto } from './dto/register-owner.dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { OwnersService } from './owners.service.js';

@Controller('api/owners')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post('register')
  register(@Body() dto: RegisterOwnerDto) {
    return this.ownersService.register(dto);
  }

  @Post('password/forgot')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.ownersService.requestPasswordReset(dto.email);
  }

  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.ownersService.resetPassword(dto.token, dto.password);
  }
}
