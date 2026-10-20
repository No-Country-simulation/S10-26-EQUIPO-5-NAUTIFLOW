import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBoatDto } from './dto/create-boat.dto.js';
import { Boat } from './boat.entity.js';
import { Owner } from '../owners/owner.entity.js';

@Injectable()
export class BoatsService {
  constructor(
    @InjectRepository(Boat)
    private readonly boatsRepository: Repository<Boat>,
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
  ) {}

  async create(dto: CreateBoatDto): Promise<Boat> {
    const owner = await this.ownersRepository.findOne({
      where: { id: dto.ownerId },
    });

    if (!owner) {
      throw new NotFoundException('No existe el lanchero indicado');
    }

    const registrationNumber = dto.registrationNumber.trim().toUpperCase();
    const existingBoat = await this.boatsRepository.findOne({
      where: { registrationNumber },
    });

    if (existingBoat) {
      throw new ConflictException('La matrícula ya está registrada');
    }

    const boat = this.boatsRepository.create({
      owner,
      ownerId: owner.id,
      registrationNumber,
      name: dto.name.trim(),
      passengerCapacity: dto.passengerCapacity,
      coverageZone: dto.coverageZone.trim(),
    });

    return this.boatsRepository.save(boat);
  }
}
