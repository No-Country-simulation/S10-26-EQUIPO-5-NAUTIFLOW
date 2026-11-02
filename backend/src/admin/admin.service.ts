import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Boat, BoatStatus, VerificationStatus } from '../boats/boat.entity.js';
import { BoatDocumentType } from '../boats/boat-document.entity.js';
import { BoatsService } from '../boats/boats.service.js';
import { CreateBoatDto } from '../boats/dto/create-boat.dto.js';
import { Owner } from '../owners/owner.entity.js';
import { BoatAvailabilityWindow } from './boat-availability.entity.js';
import { EmptyLeg } from './empty-leg.entity.js';
import { CreateAvailabilityWindowDto } from './dto/create-availability-window.dto.js';
import { CreateEmptyLegDto } from './dto/create-empty-leg.dto.js';
import { SearchFleetDto } from './dto/search-fleet.dto.js';
import { VerifyBoatDto } from './dto/verify-boat.dto.js';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
    @InjectRepository(Boat)
    private readonly boatsRepository: Repository<Boat>,
    @InjectRepository(BoatAvailabilityWindow)
    private readonly availabilityRepository: Repository<BoatAvailabilityWindow>,
    @InjectRepository(EmptyLeg)
    private readonly emptyLegsRepository: Repository<EmptyLeg>,
    private readonly boatsService: BoatsService,
  ) {}

  listOwners() {
    return this.ownersRepository.find({
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  listPendingBoats() {
    return this.boatsRepository.find({
      where: { verificationStatus: VerificationStatus.PENDING },
      relations: { owner: true, documents: true },
      order: { createdAt: 'ASC' },
    });
  }

  async listActiveBoats() {
    const boats = await this.boatsRepository.find({
      where: {
        status: BoatStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
      },
      relations: { owner: true },
      order: { name: 'ASC' },
    });
    return boats.map((boat) => ({
      id: boat.id,
      name: boat.name,
      registrationNumber: boat.registrationNumber,
      passengerCapacity: boat.passengerCapacity,
      availablePassengerCapacity: boat.availablePassengerCapacity,
      coverageZone: boat.coverageZone,
      owner: {
        fullName: boat.owner.fullName,
        phone: boat.owner.phone,
      },
    }));
  }

  async createAvailabilityWindow(dto: CreateAvailabilityWindowDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt <= new Date()) {
      throw new BadRequestException('La disponibilidad debe comenzar a futuro');
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'El fin de disponibilidad debe ser posterior al inicio',
      );
    }

    const boat = await this.boatsRepository.findOne({
      where: {
        id: dto.boatId,
        status: BoatStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
      },
      relations: { owner: true },
    });
    if (!boat) {
      throw new NotFoundException(
        'No existe una embarcación activa y aprobada con ese identificador',
      );
    }

    const window = this.availabilityRepository.create({
      boatId: boat.id,
      startsAt,
      endsAt,
    });
    return this.availabilityRepository.save(window);
  }

  async searchFleet(dto: SearchFleetDto) {
    const availableAt = new Date(dto.availableAt);
    if (availableAt <= new Date()) {
      throw new BadRequestException('Indica un horario futuro');
    }

    const query = this.boatsRepository
      .createQueryBuilder('boat')
      .innerJoinAndSelect('boat.owner', 'owner')
      .innerJoinAndSelect('boat.availabilityWindows', 'availability')
      .where('boat.status = :status', { status: BoatStatus.ACTIVE })
      .andWhere('boat.verificationStatus = :verificationStatus', {
        verificationStatus: VerificationStatus.APPROVED,
      })
      .andWhere('boat.availablePassengerCapacity >= :minPassengers', {
        minPassengers: dto.minPassengers,
      })
      .andWhere('availability.startsAt <= :availableAt', { availableAt })
      .andWhere('availability.endsAt > :availableAt', { availableAt })
      .distinct(true);

    if (dto.zone?.trim()) {
      query.andWhere('boat.coverageZone ILIKE :zone', {
        zone: `%${dto.zone.trim()}%`,
      });
    }

    const boats = await query.getMany();
    return boats.map((boat) => ({
      id: boat.id,
      name: boat.name,
      registrationNumber: boat.registrationNumber,
      passengerCapacity: boat.passengerCapacity,
      availablePassengerCapacity: boat.availablePassengerCapacity,
      coverageZone: boat.coverageZone,
      availabilityWindows: boat.availabilityWindows
        .filter(
          (window) =>
            window.startsAt <= availableAt && window.endsAt > availableAt,
        )
        .map((window) => ({
          startsAt: window.startsAt,
          endsAt: window.endsAt,
        })),
      owner: {
        fullName: boat.owner.fullName,
        phone: boat.owner.phone,
      },
    }));
  }

  async listEmptyLegs() {
    const legs = await this.emptyLegsRepository.find({
      relations: { boat: { owner: true } },
      order: { returnsAt: 'ASC' },
    });
    return legs.map((leg) => ({
      id: leg.id,
      origin: leg.origin,
      destination: leg.destination,
      returnsAt: leg.returnsAt,
      createdAt: leg.createdAt,
      boat: {
        id: leg.boat.id,
        name: leg.boat.name,
        owner: {
          fullName: leg.boat.owner.fullName,
          phone: leg.boat.owner.phone,
        },
      },
    }));
  }

  async createEmptyLeg(dto: CreateEmptyLegDto, adminId: string) {
    const returnsAt = new Date(dto.returnsAt);
    if (!dto.origin.trim() || !dto.destination.trim()) {
      throw new BadRequestException('Completa el origen y el destino del retorno');
    }
    if (returnsAt <= new Date()) {
      throw new BadRequestException('El horario de regreso debe ser futuro');
    }

    const boat = await this.boatsRepository.findOne({
      where: {
        id: dto.boatId,
        status: BoatStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
      },
      relations: { owner: true },
    });
    if (!boat) {
      throw new NotFoundException(
        'No existe una embarcación activa y aprobada con ese identificador',
      );
    }

    const leg = this.emptyLegsRepository.create({
      boatId: boat.id,
      origin: dto.origin.trim(),
      destination: dto.destination.trim(),
      returnsAt,
      createdBy: adminId,
    });
    const savedLeg = await this.emptyLegsRepository.save(leg);
    return {
      id: savedLeg.id,
      origin: savedLeg.origin,
      destination: savedLeg.destination,
      returnsAt: savedLeg.returnsAt,
      createdAt: savedLeg.createdAt,
      boat: {
        id: boat.id,
        name: boat.name,
        owner: {
          fullName: boat.owner.fullName,
          phone: boat.owner.phone,
        },
      },
    };
  }

  createBoat(dto: CreateBoatDto) {
    return this.boatsService.create(dto);
  }

  async verifyBoat(
    boatId: string,
    adminId: string,
    dto: VerifyBoatDto,
  ): Promise<Boat> {
    const boat = await this.boatsRepository.findOne({
      where: { id: boatId },
      relations: { documents: true },
    });
    if (!boat) {
      throw new NotFoundException('No existe la embarcación indicada');
    }
    if (boat.verificationStatus !== VerificationStatus.PENDING) {
      throw new BadRequestException('La embarcación ya fue revisada');
    }
    if (dto.status === VerificationStatus.REJECTED && !dto.reason?.trim()) {
      throw new BadRequestException('Indica el motivo del rechazo');
    }
    if (dto.status === VerificationStatus.APPROVED) {
      const hasLicense = boat.documents?.some(
        (document) => document.type === BoatDocumentType.LICENSE,
      );
      if (!hasLicense) {
        throw new BadRequestException(
          'No se puede aprobar sin revisar la licencia náutica',
        );
      }
      if (dto.documentedPassengerCapacity === undefined) {
        throw new BadRequestException(
          'Indica la capacidad de pasajeros que figura en la licencia',
        );
      }
      boat.documentedPassengerCapacity = dto.documentedPassengerCapacity;
      boat.passengerCapacity = dto.documentedPassengerCapacity;
      boat.availablePassengerCapacity = dto.documentedPassengerCapacity;
    }

    boat.verificationStatus = dto.status;
    boat.verificationReason = dto.reason?.trim() || null;
    boat.verifiedBy = adminId;
    boat.verifiedAt = new Date();

    return this.boatsRepository.save(boat);
  }
}
