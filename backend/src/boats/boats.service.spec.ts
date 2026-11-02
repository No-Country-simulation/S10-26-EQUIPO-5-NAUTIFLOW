import { Repository } from 'typeorm';
import { Owner } from '../owners/owner.entity.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { BoatFeedback } from '../passengers/boat-feedback.entity.js';
import { BoatDocument } from './boat-document.entity.js';
import { Boat, BoatStatus, VerificationStatus } from './boat.entity.js';
import { BoatAvailability } from './dto/search-boats.dto.js';
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

  it('returns verified boat details and a WhatsApp contact link without exposing the phone', async () => {
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
          phone: '+54 9 11 1234 5678',
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
      owner: {
        fullName: 'Lanchero Ejemplo',
        whatsappUrl:
          'https://wa.me/5491112345678?text=Hola%2C%20quiero%20consultar%20la%20disponibilidad%20de%20la%20lancha%20La%20Estrella%20en%20Delta%20del%20Tigre.',
      },
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

  it('filters active approved boats by capacity, zone, and availability', async () => {
    boatsRepository.find.mockResolvedValue([]);
    getRawMany.mockResolvedValue([]);

    await service.listAvailable({
      minCapacity: 6,
      zone: 'Delta',
      availability: BoatAvailability.AVAILABLE,
    });

    expect(boatsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          passengerCapacity: expect.objectContaining({
            _type: 'moreThanOrEqual',
          }),
          coverageZone: expect.objectContaining({ _type: 'ilike' }),
          availablePassengerCapacity: expect.objectContaining({
            _type: 'moreThan',
          }),
          status: BoatStatus.ACTIVE,
          verificationStatus: VerificationStatus.APPROVED,
        }),
        relations: { owner: true },
      }),
    );
  });

  it('can filter boats without available passenger places', async () => {
    boatsRepository.find.mockResolvedValue([]);
    getRawMany.mockResolvedValue([]);

    await service.listAvailable({
      availability: BoatAvailability.UNAVAILABLE,
    });

    expect(boatsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          availablePassengerCapacity: expect.objectContaining({
            _type: 'equal',
            _value: 0,
          }),
        }),
      }),
    );
  });
});