import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBoatDto } from './dto/create-boat.dto.js';
import { Boat, BoatStatus, VerificationStatus } from './boat.entity.js';
import { Owner } from '../owners/owner.entity.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import {
  BoatDocument,
  BoatDocumentStatus,
  BoatDocumentType,
} from './boat-document.entity.js';
import { BoatFeedback } from '../passengers/boat-feedback.entity.js';

@Injectable()
export class BoatsService {
  constructor(
    @InjectRepository(Boat)
    private readonly boatsRepository: Repository<Boat>,
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
    @InjectRepository(BoatDocument)
    private readonly documentsRepository: Repository<BoatDocument>,
    @InjectRepository(BoatFeedback)
    private readonly feedbackRepository: Repository<BoatFeedback>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(dto: CreateBoatDto): Promise<Boat> {
    const registrationNumber = dto.registrationNumber.trim().toUpperCase();
    const [owner, existingBoat] = await Promise.all([
      this.ownersRepository.findOne({ where: { id: dto.ownerId } }),
      this.boatsRepository.findOne({ where: { registrationNumber } }),
    ]);

    if (!owner) {
      throw new NotFoundException('No existe el lanchero indicado');
    }

    if (existingBoat) {
      throw new ConflictException('La matrícula ya está registrada');
    }

    const boat = this.boatsRepository.create({
      owner,
      ownerId: owner.id,
      registrationNumber,
      name: dto.name.trim(),
      passengerCapacity: dto.passengerCapacity,
      availablePassengerCapacity: dto.passengerCapacity,
      coverageZone: dto.coverageZone.trim(),
    });

    return this.boatsRepository.save(boat);
  }

  listByOwner(ownerId: string): Promise<Boat[]> {
    return this.boatsRepository.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async listAvailable(): Promise<
    Array<Omit<Boat, 'owner'> & { owner: Pick<Owner, 'fullName'> }>
  > {
    const [boats, feedbackSummaries] = await Promise.all([
      this.boatsRepository.find({
        where: {
          status: BoatStatus.ACTIVE,
          verificationStatus: VerificationStatus.APPROVED,
        },
        relations: { owner: true },
        order: { createdAt: 'DESC' },
      }),
      this.feedbackRepository
        .createQueryBuilder('feedback')
        .select('feedback.ownerId', 'ownerId')
        .addSelect('AVG(feedback.rating)', 'averageRating')
        .addSelect('COUNT(feedback.id)', 'feedbackCount')
        .groupBy('feedback.ownerId')
        .getRawMany<{
          ownerId: string;
          averageRating: string;
          feedbackCount: string;
        }>(),
    ]);
    const summariesByBoat = new Map(
      feedbackSummaries.map((summary) => [summary.ownerId, summary]),
    );

    return boats.map(({ owner, ...boat }) => {
      const summary = summariesByBoat.get(owner.id);
      return {
        ...boat,
        owner: { fullName: owner.fullName },
        averageRating: summary ? Number(summary.averageRating) : null,
        feedbackCount: summary ? Number(summary.feedbackCount) : 0,
      };
    });
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

    const existingDocuments = await this.documentsRepository.find({
      where: { boatId },
    });
    const existingByType = new Map(
      existingDocuments.map((document) => [document.type, document]),
    );
    const uploads = await Promise.allSettled(
      requiredTypes.map(async (type) => ({
        type,
        file: files[type]![0],
        cloudinaryFile: await this.cloudinaryService.uploadBoatDocument(
          files[type]![0],
          boatId,
          type,
        ),
      })),
    );
    const successfulUploads = uploads
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    if (successfulUploads.length !== requiredTypes.length) {
      await Promise.allSettled(
        successfulUploads.map(({ cloudinaryFile }) =>
          this.cloudinaryService.deleteImage(
            cloudinaryFile.publicId,
            cloudinaryFile.resourceType,
          ),
        ),
      );
      const failedUpload = uploads.find((result) => result.status === 'rejected');
      throw failedUpload?.reason;
    }

    const savedDocuments: BoatDocument[] = [];
    try {
      const documents = successfulUploads.map(({ type, file, cloudinaryFile }) =>
        this.documentsRepository.create({
          id: existingByType.get(type)?.id,
          boatId,
          type,
          fileUrl: cloudinaryFile.secureUrl,
          filePublicId: cloudinaryFile.publicId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          verificationStatus: BoatDocumentStatus.PENDING,
        }),
      );
      savedDocuments.push(...(await this.documentsRepository.save(documents)));
    } catch (error) {
      await Promise.allSettled(
        successfulUploads.map(({ cloudinaryFile }) =>
          this.cloudinaryService.deleteImage(
            cloudinaryFile.publicId,
            cloudinaryFile.resourceType,
          ),
        ),
      );
      throw error;
    }

    await Promise.allSettled(
      successfulUploads.map(({ type }) => {
        const previous = existingByType.get(type);
        if (!previous?.filePublicId) return Promise.resolve();
        return this.cloudinaryService.deleteImage(
          previous.filePublicId,
          previous.mimeType === 'application/pdf' ? 'raw' : 'image',
        );
      }),
    );

    return savedDocuments;
  }
}
