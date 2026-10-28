import {
  BadRequestException,
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
import {
  BoatDocument,
  BoatDocumentStatus,
  BoatDocumentType,
} from './boat-document.entity.js';

@Injectable()
export class BoatsService {
  constructor(
    @InjectRepository(Boat)
    private readonly boatsRepository: Repository<Boat>,
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
    @InjectRepository(BoatDocument)
    private readonly documentsRepository: Repository<BoatDocument>,
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

  async uploadImage(boatId: string, file: Express.Multer.File): Promise<Boat> {
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

  async uploadDocuments(
    boatId: string,
    files: Partial<Record<BoatDocumentType, Express.Multer.File[]>>,
  ): Promise<BoatDocument[]> {
    const boat = await this.boatsRepository.findOne({ where: { id: boatId } });
    if (!boat) {
      throw new NotFoundException('No existe la embarcación indicada');
    }

    const requiredTypes = Object.values(BoatDocumentType);
    const missingType = requiredTypes.find((type) => !files[type]?.[0]);
    if (missingType) {
      throw new BadRequestException(
        `Debe enviarse el documento requerido: ${missingType}`,
      );
    }

    const uploaded: BoatDocument[] = [];
    try {
      for (const type of requiredTypes) {
        const file = files[type]![0];
        const cloudinaryFile = await this.cloudinaryService.uploadBoatDocument(
          file,
          boatId,
          type,
        );
        const existing = await this.documentsRepository.findOne({
          where: { boatId, type },
        });
        if (existing?.filePublicId) {
          await this.cloudinaryService.deleteImage(
            existing.filePublicId,
            existing.mimeType === 'application/pdf' ? 'raw' : 'image',
          );
        }

        const document = this.documentsRepository.create({
          id: existing?.id,
          boatId,
          type,
          fileUrl: cloudinaryFile.secureUrl,
          filePublicId: cloudinaryFile.publicId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          verificationStatus: BoatDocumentStatus.PENDING,
        });
        uploaded.push(await this.documentsRepository.save(document));
      }
      return uploaded;
    } catch (error) {
      for (const document of uploaded) {
        await this.cloudinaryService.deleteImage(
          document.filePublicId,
          document.mimeType === 'application/pdf' ? 'raw' : 'image',
        );
      }
      throw error;
    }
  }
}
