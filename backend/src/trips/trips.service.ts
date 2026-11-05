import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import {
  DataSource,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { BoatAvailabilityWindow } from '../admin/boat-availability.entity.js';
import { Boat, BoatStatus, VerificationStatus } from '../boats/boat.entity.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { Trip } from './trip.entity.js';

const REVIEW_LINK_VALIDITY_DAYS = 30;

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    @InjectRepository(Boat)
    private readonly boatsRepository: Repository<Boat>,
    @InjectRepository(BoatAvailabilityWindow)
    private readonly availabilityRepository: Repository<BoatAvailabilityWindow>,
    private readonly dataSource: DataSource,
  ) {}

  async listPublic() {
    const trips = await this.tripsRepository
      .createQueryBuilder('trip')
      .innerJoinAndSelect('trip.boat', 'boat')
      .innerJoinAndSelect('boat.owner', 'owner')
      .where('trip.startsAt >= :now', { now: new Date() })
      .andWhere('trip.completedAt IS NULL')
      .andWhere('boat.status = :boatStatus', {
        boatStatus: BoatStatus.ACTIVE,
      })
      .andWhere('boat.verificationStatus = :verificationStatus', {
        verificationStatus: VerificationStatus.APPROVED,
      })
      .orderBy('trip.startsAt', 'ASC')
      .getMany();

    return trips.map((trip) => ({
      id: trip.id,
      origin: trip.origin,
      destination: trip.destination,
      startsAt: trip.startsAt,
      endsAt: trip.endsAt,
      isEmptyReturn: Boolean(trip.emptyLegId),
      boat: {
        id: trip.boat.id,
        name: trip.boat.name,
        passengerCapacity: trip.boat.passengerCapacity,
        imageUrl: trip.boat.imageUrl,
        owner: {
          fullName: trip.boat.owner.fullName,
          whatsappUrl: this.whatsappUrl(
            trip.boat.owner.phone,
            trip.boat.name,
            trip.origin,
            trip.destination,
          ),
        },
      },
    }));
  }

  async listForAdmin() {
    const trips = await this.tripsRepository.find({
      relations: { boat: true },
      order: { startsAt: 'DESC' },
      take: 100,
    });

    return trips.map((trip) => ({
      id: trip.id,
      origin: trip.origin,
      destination: trip.destination,
      startsAt: trip.startsAt,
      endsAt: trip.endsAt,
      createdAt: trip.createdAt,
      completedAt: trip.completedAt,
      isEmptyReturn: Boolean(trip.emptyLegId),
      boat: { id: trip.boat.id, name: trip.boat.name },
    }));
  }

  async create(dto: CreateTripDto, adminId: string) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (!dto.origin.trim() || !dto.destination.trim()) {
      throw new BadRequestException(
        'Completa el origen y el destino del viaje',
      );
    }
    if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
      throw new BadRequestException('El viaje debe comenzar en el futuro');
    }
    if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException(
        'Indica un horario de fin posterior al inicio del viaje',
      );
    }

    const boat = await this.boatsRepository.findOne({
      where: {
        id: dto.boatId,
        status: BoatStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
      },
    });
    if (!boat) {
      throw new NotFoundException(
        'Solo se pueden programar viajes para embarcaciones activas y aprobadas',
      );
    }

    const availability = await this.availabilityRepository.findOne({
      where: {
        boatId: boat.id,
        startsAt: LessThanOrEqual(startsAt),
        endsAt: MoreThanOrEqual(endsAt),
      },
    });
    if (!availability) {
      throw new BadRequestException(
        'La lancha no tiene disponibilidad guardada para cubrir todo el horario del viaje',
      );
    }

    const trip = this.tripsRepository.create({
      boatId: boat.id,
      emptyLegId: null,
      origin: dto.origin.trim(),
      destination: dto.destination.trim(),
      startsAt,
      endsAt,
      createdBy: adminId,
      completedAt: null,
      reviewTokenHash: null,
      reviewTokenExpiresAt: null,
    });
    const savedTrip = await this.tripsRepository.save(trip);

    return {
      id: savedTrip.id,
      origin: savedTrip.origin,
      destination: savedTrip.destination,
      startsAt: savedTrip.startsAt,
      endsAt: savedTrip.endsAt,
      isEmptyReturn: false,
      boat: { id: boat.id, name: boat.name },
    };
  }

  async complete(tripId: string) {
    const reviewToken = randomBytes(32).toString('base64url');
    const now = new Date();
    const reviewTokenExpiresAt = new Date(now);
    reviewTokenExpiresAt.setDate(
      reviewTokenExpiresAt.getDate() + REVIEW_LINK_VALIDITY_DAYS,
    );

    const trip = await this.dataSource.transaction(async (manager) => {
      const trip = await manager
        .getRepository(Trip)
        .createQueryBuilder('trip')
        .setLock('pessimistic_write')
        .where('trip.id = :tripId', { tripId })
        .getOne();
      if (!trip) {
        throw new NotFoundException('No existe el viaje indicado');
      }
      if (trip.completedAt) {
        throw new ConflictException('El viaje ya fue completado');
      }
      if (trip.startsAt > now || (trip.endsAt && trip.endsAt > now)) {
        throw new BadRequestException(
          'El viaje todavía no ha finalizado',
        );
      }

      trip.completedAt = now;
      trip.reviewTokenHash = this.hashToken(reviewToken);
      trip.reviewTokenExpiresAt = reviewTokenExpiresAt;
      return manager.save(Trip, trip);
    });

    return {
      id: trip.id,
      completedAt: trip.completedAt,
      reviewToken,
      reviewTokenExpiresAt: trip.reviewTokenExpiresAt,
    };
  }

  static hashReviewToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashToken(token: string): string {
    return TripsService.hashReviewToken(token);
  }

  private whatsappUrl(
    phone: string | null,
    boatName: string,
    origin: string,
    destination: string,
  ): string | null {
    const number = phone?.replace(/\D/g, '');
    if (!number || number.length < 8 || number.length > 15) return null;

    const message = `Hola, quiero consultar por el viaje ${origin} → ${destination} en la lancha ${boatName}.`;
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }
}
