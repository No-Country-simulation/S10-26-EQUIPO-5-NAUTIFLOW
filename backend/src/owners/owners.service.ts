import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterOwnerDto } from './dto/register-owner.dto.js';
import { Owner } from './owner.entity.js';

@Injectable()
export class OwnersService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
  ) {}

  async register(dto: RegisterOwnerDto): Promise<Owner> {
    const email = dto.email.trim().toLowerCase();
    const existingOwner = await this.ownersRepository.findOne({ where: { email } });

    if (existingOwner) {
      throw new ConflictException('Ya existe un lanchero registrado con ese email');
    }

    const owner = this.ownersRepository.create({
      fullName: dto.fullName.trim(),
      email,
      phone: dto.phone.trim(),
    });

    return this.ownersRepository.save(owner);
  }
}
