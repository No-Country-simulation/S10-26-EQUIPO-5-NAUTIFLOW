import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { TripsService } from './trips.service.js';

interface AdminRequest extends Request {
  user: { sub: string };
}

@Controller('api/admin/trips')
@UseGuards(AdminAuthGuard)
export class AdminTripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  listForAdmin() {
    return this.tripsService.listForAdmin();
  }

  @Post()
  create(@Body() dto: CreateTripDto, @Req() request: AdminRequest) {
    return this.tripsService.create(dto, request.user.sub);
  }

  @Post(':id/complete')
  complete(@Param('id', ParseUUIDPipe) tripId: string) {
    return this.tripsService.complete(tripId);
  }
}
