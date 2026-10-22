import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { CreateBoatDto } from '../boats/dto/create-boat.dto.js';
import { AdminService } from './admin.service.js';
import { VerifyBoatDto } from './dto/verify-boat.dto.js';

interface AuthenticatedRequest extends Request {
  user: { sub: string; role: string };
}

@Controller('api/admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('owners')
  listOwners() {
    return this.adminService.listOwners();
  }

  @Post('boats')
  createBoat(@Body() dto: CreateBoatDto) {
    return this.adminService.createBoat(dto);
  }

  @Get('boats/pending')
  listPendingBoats() {
    return this.adminService.listPendingBoats();
  }

  @Patch('boats/:id/verification')
  verifyBoat(
    @Param('id', ParseUUIDPipe) boatId: string,
    @Body() dto: VerifyBoatDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.verifyBoat(boatId, request.user.sub, dto);
  }
}
