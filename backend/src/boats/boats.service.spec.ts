import { Repository } from 'typeorm';
import { Owner } from '../owners/owner.entity.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { BoatFeedback } from '../passengers/boat-feedback.entity.js';
import { BoatDocument } from './boat-document.entity.js';
import { Boat, BoatStatus, VerificationStatus } from './boat.entity.js';
import { BoatsService } from './boats.service.js';

describe('BoatsService', () => {
  const boatsRepository = { find: vi.fn() };
  const queryBuilder = {
    addSelect: vi.fn(),
    getRawMany: vi.fn(),
    groupBy: vi.fn(),
    select: vi.fn(),
  };
  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.addSelect.mockReturnValue(queryBuilder);
  queryBuilder.groupBy.mockReturnValue(queryBuilder);
  const getRawMany = queryBuilder.getRawMany;
  const createQueryBuilder = vi.fn(() => queryBuilder);
  const feedbackRepository = { createQueryBuilder };
  let service: BoatsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BoatsService(
      boatsRepository as unknown as Repository<Boat>,
      {} as Repository<Owner>,
      {} as Repository<BoatDocument>,
      feedbackRepository as unknown as Repository<BoatFeedback>,
      {} as CloudinaryService,
    );
  });

  it('returns verified boat details and only the owner name', async () => {
    boatsRepository.find.mockResolvedValue([
      {
        id: 'boat-id',
        name: 'La Estrella',
        registrationNumber: 'ABC-123',
        passengerCapacity: 8,
        coverageZone: 'Delta del Tigre',
        imageUrl: 'https://example.com/boat.jpg',
        status: BoatStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
        ownerId: 'owner-id',
        owner: {
          id: 'owner-id',
          fullName: 'Lanchero Ejemplo',
          email: 'owner@example.com',
          phone: '123456789',
        },
      },
    ]);
    getRawMany.mockResolvedValue([
      { ownerId: 'owner-id', averageRating: '4.5', feedbackCount: '2' },
    ]);

    const result = await service.listAvailable();

    expect(boatsRepository.find).toHaveBeenCalledWith({
      where: {
        status: BoatStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
      },
      relations: { owner: true },
      order: { createdAt: 'DESC' },
    });
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'feedback.ownerId',
      'ownerId',
    );
    expect(result[0]).toMatchObject({
      name: 'La Estrella',
      passengerCapacity: 8,
      imageUrl: 'https://example.com/boat.jpg',
      owner: { fullName: 'Lanchero Ejemplo' },
      averageRating: 4.5,
      feedbackCount: 2,
    });
    expect(result[0].owner).not.toHaveProperty('email');
    expect(result[0].owner).not.toHaveProperty('phone');
  });

  it('includes the owner boat documents in the authenticated boat list', async () => {
    boatsRepository.find.mockResolvedValue([]);

    await service.listByOwner('owner-id');

    expect(boatsRepository.find).toHaveBeenCalledWith({
      where: { ownerId: 'owner-id' },
      relations: { documents: true },
      order: { createdAt: 'DESC' },
    });
  });
});