import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Boat } from '../boats/boat.entity.js';
import { Owner } from '../owners/owner.entity.js';
import { BoatBooking } from './boat-booking.entity.js';
import { BoatFeedback } from './boat-feedback.entity.js';
import { PassengersController } from './passengers.controller.js';
import { PassengersService } from './passengers.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Owner, Boat, BoatBooking, BoatFeedback]),
    AuthModule,
  ],
  controllers: [PassengersController],
  providers: [PassengersService],
})
export class PassengersModule {}