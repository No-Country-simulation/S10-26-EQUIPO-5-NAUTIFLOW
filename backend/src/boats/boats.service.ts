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
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';

@Injectable()
export class BoatsService {
  constructor(
    @InjectRepository(Boat)
    private readonly boatsRepository: Repository<Boat>,
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
    private readonly cloudinaryService: CloudinaryService,
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

  async uploadImage(
    boatId: string,
    file: Express.Multer.File,
  ): Promise<Boat> {
    const boat = await this.boatsRepository.findOne({
      where: { id: boatId },
    });

    if (!boat) {
      throw new NotFoundException('No existe la embarcación indicada');
    }

    const previousPublicId = boat.imagePublicId;
    const previousResourceType = boat.imageResourceType ?? 'image';

    const uploadedImage = await this.cloudinaryService.uploadBoatImage(
      file,
      boat.id,
    );

    boat.imageUrl = uploadedImage.secureUrl;
    boat.imagePublicId = uploadedImage.publicId;
    boat.imageResourceType = uploadedImage.resourceType;

    try {
      const savedBoat = await this.boatsRepository.save(boat);

      if (
        previousPublicId &&
        (previousPublicId !== uploadedImage.publicId ||
          previousResourceType !== uploadedImage.resourceType)
      ) {
        await this.cloudinaryService.deleteImage(
          previousPublicId,
          previousResourceType,
        );
      }

      return savedBoat;
    } catch (error) {
      await this.cloudinaryService.deleteImage(
        uploadedImage.publicId,
        uploadedImage.resourceType,
      );
      throw error;
    }
  }
}
