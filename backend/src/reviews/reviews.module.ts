import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnerNotification } from '../owners/owner-notification.entity.js';
import { Trip } from '../trips/trip.entity.js';
import { BoatFeedback } from './boat-feedback.entity.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, BoatFeedback, OwnerNotification])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
