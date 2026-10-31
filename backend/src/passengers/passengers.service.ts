import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import {
  DataSource,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Boat, BoatStatus, VerificationStatus } from '../boats/boat.entity.js';
import { Owner } from '../owners/owner.entity.js';
import { BoatBooking } from './boat-booking.entity.js';
import { BoatFeedback } from './boat-feedback.entity.js';
import { CreateFeedbackDto } from './dto/create-feedback.dto.js';
import { RegisterPassengerDto } from './dto/register-passenger.dto.js';

const scryptAsync = promisify(scrypt);

@Injectable()
export class PassengersService {
  constructor(
    @InjectRepository(Owner)
    private readonly usersRepository: Repository<Owner>,
    @InjectRepository(BoatBooking)
    private readonly bookingsRepository: Repository<BoatBooking>,
    @InjectRepository(BoatFeedback)
    private readonly feedbackRepository: Repository<BoatFeedback>,
    private readonly dataSource: DataSource,
  ) {}

  async register(
    dto: RegisterPassengerDto,
  ): Promise<Pick<Owner, 'id' | 'fullName' | 'email' | 'role' | 'createdAt'>> {
    const passenger = this.usersRepository.create({
      fullName: dto.fullName.trim(),
      email: dto.email.trim().toLowerCase(),
      passwordHash: await this.hashPassword(dto.password),
      phone: null,
      role: 'passenger',
    });

    try {
      const savedPassenger = await this.usersRepository.save(passenger);
      return {
        id: savedPassenger.id,
        fullName: savedPassenger.fullName,
        email: savedPassenger.email,
        role: savedPassenger.role,
        createdAt: savedPassenger.createdAt,
      };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Ya existe una cuenta con ese correo');
      }
      throw error;
    }
  }

  async registerForBoat(passengerId: string, boatId: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const boat = await manager.findOne(Boat, {
          where: { id: boatId },
          lock: { mode: 'pessimistic_write' },
        });

        if (
          !boat ||
          boat.status !== BoatStatus.ACTIVE ||
          boat.verificationStatus !== VerificationStatus.APPROVED
        ) {
          throw new NotFoundException(
            'La embarcación no está disponible para reservas',
          );
        }

        const existingBooking = await manager.findOne(BoatBooking, {
          where: { boatId, passengerId },
        });
        if (existingBooking) {
          throw new ConflictException(
            'Ya tienes una plaza registrada en esta embarcación',
          );
        }

        if (boat.availablePassengerCapacity < 1) {
          throw new ConflictException(
            'La embarcación ya no tiene plazas disponibles',
          );
        }

        boat.availablePassengerCapacity -= 1;
        await manager.save(Boat, boat);

        const owner = await manager.findOne(Owner, {
          where: { id: boat.ownerId },
        });
        const booking = manager.create(BoatBooking, {
          boatId,
          passengerId,
        });
        const savedBooking = await manager.save(BoatBooking, booking);

        return {
          id: savedBooking.id,
          createdAt: savedBooking.createdAt,
          feedback: null,
          boat: {
            id: boat.id,
            name: boat.name,
            imageUrl: boat.imageUrl,
            passengerCapacity: boat.passengerCapacity,
            availablePassengerCapacity: boat.availablePassengerCapacity,
            coverageZone: boat.coverageZone,
            owner: { fullName: owner?.fullName ?? 'Lanchero' },
          },
        };
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'Ya tienes una plaza registrada en esta embarcación',
        );
      }
      throw error;
    }
  }

  async listMyBookings(passengerId: string) {
    const bookings = await this.bookingsRepository.find({
      where: { passengerId },
      relations: { boat: { owner: true }, feedback: true },
      order: { createdAt: 'DESC' },
    });

    return bookings.map((booking) => ({
      id: booking.id,
      createdAt: booking.createdAt,
      feedback: booking.feedback
        ? {
            id: booking.feedback.id,
            rating: booking.feedback.rating,
            comment: booking.feedback.comment,
            createdAt: booking.feedback.createdAt,
          }
        : null,
      boat: {
        id: booking.boat.id,
        name: booking.boat.name,
        imageUrl: booking.boat.imageUrl,
        passengerCapacity: booking.boat.passengerCapacity,
        availablePassengerCapacity:
          booking.boat.availablePassengerCapacity,
        coverageZone: booking.boat.coverageZone,
        owner: { fullName: booking.boat.owner.fullName },
      },
    }));
  }

  async leaveFeedback(
    passengerId: string,
    bookingId: string,
    dto: CreateFeedbackDto,
  ) {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId, passengerId },
      relations: { boat: true },
    });
    if (!booking) {
      throw new NotFoundException('No existe una reserva de ese pasajero');
    }

    try {
      const feedback = this.feedbackRepository.create({
        bookingId,
        boatId: booking.boatId,
        passengerId,
        ownerId: booking.boat.ownerId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      });
      const savedFeedback = await this.feedbackRepository.save(feedback);
      return {
        id: savedFeedback.id,
        rating: savedFeedback.rating,
        comment: savedFeedback.comment,
        createdAt: savedFeedback.createdAt,
      };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'Ya enviaste feedback para esta reserva',
        );
      }
      throw error;
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }
}