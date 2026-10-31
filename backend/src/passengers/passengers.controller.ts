import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PassengerAuthGuard } from '../auth/passenger-auth.guard.js';
import { CreateFeedbackDto } from './dto/create-feedback.dto.js';
import { RegisterPassengerDto } from './dto/register-passenger.dto.js';
import { PassengersService } from './passengers.service.js';

interface PassengerRequest extends Request {
  user: { sub: string };
}

@Controller('api/passengers')
export class PassengersController {
  constructor(private readonly passengersService: PassengersService) {}

  @Post('register')
  register(@Body() dto: RegisterPassengerDto) {
    return this.passengersService.register(dto);
  }

  @Post('boats/:boatId/register')
  @UseGuards(PassengerAuthGuard)
  registerForBoat(
    @Req() request: PassengerRequest,
    @Param('boatId', new ParseUUIDPipe()) boatId: string,
  ) {
    return this.passengersService.registerForBoat(request.user.sub, boatId);
  }

  @Get('bookings')
  @UseGuards(PassengerAuthGuard)
  listMyBookings(@Req() request: PassengerRequest) {
    return this.passengersService.listMyBookings(request.user.sub);
  }

  @Post('bookings/:bookingId/feedback')
  @UseGuards(PassengerAuthGuard)
  leaveFeedback(
    @Req() request: PassengerRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.passengersService.leaveFeedback(
      request.user.sub,
      bookingId,
      dto,
    );
  }
}