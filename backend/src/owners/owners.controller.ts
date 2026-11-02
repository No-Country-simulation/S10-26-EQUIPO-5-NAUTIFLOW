import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OwnerAuthGuard } from '../auth/owner-auth.guard.js';
import { RegisterOwnerDto } from './dto/register-owner.dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { OwnerNotificationsService } from './owner-notifications.service.js';
import { OwnersService } from './owners.service.js';

interface OwnerRequest extends Request {
  user: { sub: string };
}

@Controller('api/owners')
export class OwnersController {
  constructor(
    private readonly ownersService: OwnersService,
    private readonly notificationsService: OwnerNotificationsService,
  ) {}

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

  @Get('notifications')
  @UseGuards(OwnerAuthGuard)
  listNotifications(@Req() request: OwnerRequest) {
    return this.notificationsService.listForOwner(request.user.sub);
  }
}
