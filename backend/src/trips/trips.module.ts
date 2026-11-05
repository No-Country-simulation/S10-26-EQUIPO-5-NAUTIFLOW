import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Boat } from '../boats/boat.entity.js';
import { BoatAvailabilityWindow } from '../admin/boat-availability.entity.js';
import { Trip } from './trip.entity.js';
import { AdminTripsController } from './admin-trips.controller.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Boat, BoatAvailabilityWindow, Trip]),
  ],
  controllers: [TripsController, AdminTripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
