import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { OwnerNotification } from '../owners/owner-notification.entity.js';
import { BoatFeedback } from './boat-feedback.entity.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { Trip } from '../trips/trip.entity.js';
import { TripsService } from '../trips/trips.service.js';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    @InjectRepository(BoatFeedback)
    private readonly feedbackRepository: Repository<BoatFeedback>,
    private readonly dataSource: DataSource,
  ) {}

  async getByToken(token: string) {
    const trip = await this.findValidTrip(token);
    const feedback = await this.feedbackRepository.findOne({
      where: { tripId: trip.id },
    });

    return {
      trip: {
        id: trip.id,
        origin: trip.origin,
        destination: trip.destination,
        completedAt: trip.completedAt,
        boat: { name: trip.boat.name },
      },
      alreadyReviewed: Boolean(feedback),
    };
  }

  async createByToken(token: string, dto: CreateReviewDto) {
    const tokenHash = this.tokenHash(token);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const trip = await manager
          .getRepository(Trip)
          .createQueryBuilder('trip')
          .innerJoinAndSelect('trip.boat', 'boat')
          .setLock('pessimistic_write')
          .where('trip.reviewTokenHash = :tokenHash', { tokenHash })
          .getOne();
        if (
          !trip ||
          !trip.completedAt ||
          !trip.reviewTokenExpiresAt ||
          trip.reviewTokenExpiresAt <= new Date()
        ) {
          throw new NotFoundException('El enlace de reseña no es válido o venció');
        }

        const existingFeedback = await manager.findOne(BoatFeedback, {
          where: { tripId: trip.id },
        });
        if (existingFeedback) {
          throw new ConflictException('Ya se envió una reseña para este viaje');
        }

        const feedback = await manager.save(
          BoatFeedback,
          manager.create(BoatFeedback, {
            tripId: trip.id,
            boatId: trip.boatId,
            ownerId: trip.boat.ownerId,
            rating: dto.rating,
            comment: dto.comment?.trim() || null,
          }),
        );
        await manager.save(
          OwnerNotification,
          manager.create(OwnerNotification, {
            ownerId: trip.boat.ownerId,
            feedbackId: feedback.id,
            message: `Recibiste una nueva calificación de ${feedback.rating}/5.`,
            readAt: null,
          }),
        );

        return {
          id: feedback.id,
          rating: feedback.rating,
          comment: feedback.comment,
          createdAt: feedback.createdAt,
        };
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Ya se envió una reseña para este viaje');
      }
      throw error;
    }
  }

  private async findValidTrip(token: string): Promise<Trip> {
    const tokenHash = this.tokenHash(token);
    const trip = await this.tripsRepository.findOne({
      where: { reviewTokenHash: tokenHash },
      relations: { boat: true },
    });
    if (
      !trip ||
      !trip.completedAt ||
      !trip.reviewTokenExpiresAt ||
      trip.reviewTokenExpiresAt <= new Date()
    ) {
      throw new NotFoundException('El enlace de reseña no es válido o venció');
    }
    return trip;
  }

  private tokenHash(token: string): string {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new NotFoundException('El enlace de reseña no es válido o venció');
    }
    return TripsService.hashReviewToken(token);
  }
}
