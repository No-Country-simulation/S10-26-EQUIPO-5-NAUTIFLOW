import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Boat, VerificationStatus } from '../boats/boat.entity.js';
import { BoatsService } from '../boats/boats.service.js';
import { Owner } from '../owners/owner.entity.js';
import { AdminService } from './admin.service.js';

describe('AdminService boat verification', () => {
  const findOne = vi.fn();
  const save = vi.fn((boat) => Promise.resolve(boat));
  const boatsRepository = { findOne, save };
  const availabilityRepository = {
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
  };
  const queryBuilder = {
    andWhere: vi.fn(),
    distinct: vi.fn(),
    getMany: vi.fn(),
    innerJoinAndSelect: vi.fn(),
    where: vi.fn(),
  };
  for (const method of [
    queryBuilder.andWhere,
    queryBuilder.distinct,
    queryBuilder.innerJoinAndSelect,
    queryBuilder.where,
  ]) {
    method.mockReturnValue(queryBuilder);
  }
  const createQueryBuilder = vi.fn(() => queryBuilder);
  Object.assign(boatsRepository, {
    createQueryBuilder,
    find: vi.fn(),
  });
  const emptyLegsRepository = {
    create: vi.fn((value) => value),
    find: vi.fn(),
    save: vi.fn((value) => Promise.resolve(value)),
  };
  const ownersRepository = {};
  const boatsService = { create: vi.fn() };

  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService(
      ownersRepository as unknown as Repository<Owner>,
      boatsRepository as unknown as Repository<Boat>,
      availabilityRepository as never,
      emptyLegsRepository as never,
      boatsService as unknown as BoatsService,
    );
  });

  it('records the decision, reason, administrator, and timestamp', async () => {
    const boat = {
      id: 'boat-id',
      passengerCapacity: 8,
      availablePassengerCapacity: 8,
      documents: [{ type: 'license' }],
      verificationStatus: VerificationStatus.PENDING,
      verificationReason: null,
      verifiedBy: null,
      verifiedAt: null,
    } as unknown as Boat;
    findOne.mockResolvedValue(boat);

    const result = await service.verifyBoat('boat-id', 'admin-id', {
      status: VerificationStatus.REJECTED,
      reason: ' Documentación vencida ',
    });

    expect(result.verificationStatus).toBe(VerificationStatus.REJECTED);
    expect(result.verificationReason).toBe('Documentación vencida');
    expect(result.verifiedBy).toBe('admin-id');
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledWith(boat);
  });

  it('requires a reason when rejecting a boat', async () => {
    findOne.mockResolvedValue({
      id: 'boat-id',
      verificationStatus: VerificationStatus.PENDING,
    } as Boat);

    await expect(
      service.verifyBoat('boat-id', 'admin-id', {
        status: VerificationStatus.REJECTED,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown boat', async () => {
    findOne.mockResolvedValue(null);

    await expect(
      service.verifyBoat('missing-id', 'admin-id', {
        status: VerificationStatus.APPROVED,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('uses the license capacity when approving a boat', async () => {
    const boat = {
      id: 'boat-id',
      passengerCapacity: 8,
      availablePassengerCapacity: 8,
      documents: [{ type: 'license' }],
      verificationStatus: VerificationStatus.PENDING,
    } as unknown as Boat;
    findOne.mockResolvedValue(boat);

    const result = await service.verifyBoat('boat-id', 'admin-id', {
      status: VerificationStatus.APPROVED,
      documentedPassengerCapacity: 7,
    });

    expect(result.passengerCapacity).toBe(7);
    expect(result.availablePassengerCapacity).toBe(7);
    expect(result.documentedPassengerCapacity).toBe(7);
    expect(result.verificationStatus).toBe(VerificationStatus.APPROVED);
    expect(save).toHaveBeenCalledWith(boat);
  });

  it('requires a reviewed license before approving a boat', async () => {
    findOne.mockResolvedValue({
      id: 'boat-id',
      passengerCapacity: 8,
      documents: [],
      verificationStatus: VerificationStatus.PENDING,
    } as unknown as Boat);

    await expect(
      service.verifyBoat('boat-id', 'admin-id', {
        status: VerificationStatus.APPROVED,
        documentedPassengerCapacity: 8,
      }),
    ).rejects.toThrow('licencia');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not allow changing a boat after its verification decision', async () => {
    findOne.mockResolvedValue({
      id: 'boat-id',
      verificationStatus: VerificationStatus.APPROVED,
    } as Boat);

    await expect(
      service.verifyBoat('boat-id', 'admin-id', {
        status: VerificationStatus.APPROVED,
        documentedPassengerCapacity: 8,
      }),
    ).rejects.toThrow('ya fue revisada');
    expect(save).not.toHaveBeenCalled();
  });

  it('creates future availability windows only for active approved boats', async () => {
    const boat = { id: 'boat-id' } as Boat;
    findOne.mockResolvedValue(boat);
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    await service.createAvailabilityWindow({
      boatId: 'boat-id',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    expect(findOne).toHaveBeenCalledWith({
      where: {
        id: 'boat-id',
        status: 'active',
        verificationStatus: 'approved',
      },
      relations: { owner: true },
    });
    expect(availabilityRepository.create).toHaveBeenCalledWith({
      boatId: 'boat-id',
      startsAt,
      endsAt,
    });
    expect(availabilityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ boatId: 'boat-id' }),
    );
  });

  it('rejects invalid availability ranges before saving', async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() - 1);
    await expect(
      service.createAvailabilityWindow({
        boatId: 'boat-id',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      }),
    ).rejects.toThrow('posterior');
    expect(availabilityRepository.save).not.toHaveBeenCalled();
  });

  it('searches active boats with free seats and availability covering the requested time', async () => {
    const availableAt = new Date(Date.now() + 60 * 60 * 1000);
    const startsAt = new Date(availableAt.getTime() - 30 * 60 * 1000);
    const endsAt = new Date(availableAt.getTime() + 30 * 60 * 1000);
    const boat = {
      id: 'boat-id',
      name: 'Estrella',
      registrationNumber: 'ABC-123',
      passengerCapacity: 8,
      availablePassengerCapacity: 5,
      coverageZone: 'Primera Sección',
      owner: { fullName: 'Lanchero', phone: '+54 9 11 1234 5678' },
      availabilityWindows: [{ startsAt, endsAt }],
    } as unknown as Boat;
    queryBuilder.getMany.mockResolvedValue([boat]);

    const result = await service.searchFleet({
      minPassengers: 5,
      availableAt: availableAt.toISOString(),
      zone: 'Primera',
    });

    expect(createQueryBuilder).toHaveBeenCalledWith('boat');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'boat.availablePassengerCapacity >= :minPassengers',
      { minPassengers: 5 },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'availability.startsAt <= :availableAt',
      { availableAt },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'availability.endsAt > :availableAt',
      { availableAt },
    );
    expect(result[0]).toMatchObject({
      id: 'boat-id',
      owner: { fullName: 'Lanchero', phone: '+54 9 11 1234 5678' },
    });
  });

  it('publishes a return leg for an active approved boat and records its administrator', async () => {
    const boat = {
      id: 'boat-id',
      name: 'Estrella',
      owner: { fullName: 'Lanchero', phone: '123456789' },
    } as unknown as Boat;
    findOne.mockResolvedValue(boat);
    const returnsAt = new Date(Date.now() + 60 * 60 * 1000);
    emptyLegsRepository.save.mockImplementation((leg) =>
      Promise.resolve({ id: 'leg-id', ...leg }),
    );

    const result = await service.createEmptyLeg(
      {
        boatId: 'boat-id',
        origin: 'Primera Sección',
        destination: 'Tigre',
        returnsAt: returnsAt.toISOString(),
      },
      'admin-id',
    );

    expect(emptyLegsRepository.create).toHaveBeenCalledWith({
      boatId: 'boat-id',
      origin: 'Primera Sección',
      destination: 'Tigre',
      returnsAt,
      createdBy: 'admin-id',
    });
    expect(result).toMatchObject({
      id: 'leg-id',
      boat: {
        id: 'boat-id',
        name: 'Estrella',
        owner: { fullName: 'Lanchero', phone: '123456789' },
      },
    });
  });
});
