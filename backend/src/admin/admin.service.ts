import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Boat, VerificationStatus } from '../boats/boat.entity.js';
import { BoatsService } from '../boats/boats.service.js';
import { CreateBoatDto } from '../boats/dto/create-boat.dto.js';
import { Owner } from '../owners/owner.entity.js';
import { VerifyBoatDto } from './dto/verify-boat.dto.js';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
    @InjectRepository(Boat)
    private readonly boatsRepository: Repository<Boat>,
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
      relations: { owner: true },
      order: { createdAt: 'ASC' },
    });
  }

  createBoat(dto: CreateBoatDto) {
    return this.boatsService.create(dto);
  }

  async verifyBoat(
    boatId: string,
    adminId: string,
    dto: VerifyBoatDto,
  ): Promise<Boat> {
    const boat = await this.boatsRepository.findOneBy({ id: boatId });
    if (!boat) {
      throw new NotFoundException('No existe la embarcación indicada');
    }
    if (dto.status === VerificationStatus.REJECTED && !dto.reason?.trim()) {
      throw new BadRequestException('Indica el motivo del rechazo');
    }

    boat.verificationStatus = dto.status;
    boat.verificationReason = dto.reason?.trim() || null;
    boat.verifiedBy = adminId;
    boat.verifiedAt = new Date();

    return this.boatsRepository.save(boat);
  }
}
