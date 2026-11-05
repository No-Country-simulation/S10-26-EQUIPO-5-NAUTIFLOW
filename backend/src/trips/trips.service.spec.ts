import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Boat, BoatStatus, VerificationStatus } from '../boats/boat.entity.js';
import { Trip } from './trip.entity.js';
import { TripsService } from './trips.service.js';

describe('TripsService', () => {
  const tripRepository = {
    create: vi.fn((trip) => trip),
    createQueryBuilder: vi.fn(),
    find: vi.fn(),
    save: vi.fn(),
  };
  const boatsRepository = { findOne: vi.fn() };
  const availabilityRepository = { findOne: vi.fn() };
  const manager = { getRepository: vi.fn(), save: vi.fn() };
  const dataSource = {
    transaction: vi.fn((work) => work(manager as never)),
  };

  let service: TripsService;

  beforeEach(() => {
    vi.clearAllMocks();
    manager.getRepository.mockReturnValue(tripRepository);
    service = new TripsService(
      tripRepository as never,
      boatsRepository as never,
      availabilityRepository as never,
      dataSource as unknown as DataSource,
    );
  });

  it('creates a future trip for an active, approved boat', async () => {
    const boat = { id: 'boat-id', name: 'La Estrella' } as Boat;
    boatsRepository.findOne.mockResolvedValue(boat);
    availabilityRepository.findOne.mockResolvedValue({
      boatId: boat.id,
    });
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    tripRepository.save.mockImplementation(async (trip) => ({
      ...trip,
      id: 'trip-id',
      createdAt: new Date(),
    }));

    const result = await service.create(
      {
        boatId: boat.id,
        origin: '  Tigre ',
        destination: ' Primera Sección ',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
      'admin-id',
    );

    expect(boatsRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: boat.id,
        status: BoatStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
      },
    });
    const availabilityQuery = availabilityRepository.findOne.mock.calls[0][0];
    expect(availabilityQuery.where).toMatchObject({
      boatId: boat.id,
      startsAt: expect.objectContaining({
        _type: 'lessThanOrEqual',
        _value: startsAt,
      }),
      endsAt: expect.objectContaining({
        _type: 'moreThanOrEqual',
        _value: endsAt,
      }),
    });
    expect(tripRepository.create).toHaveBeenCalledWith({
      boatId: boat.id,
      emptyLegId: null,
      origin: 'Tigre',
      destination: 'Primera Sección',
      startsAt,
      endsAt,
      createdBy: 'admin-id',
      completedAt: null,
      reviewTokenHash: null,
      reviewTokenExpiresAt: null,
    });
    expect(result).toMatchObject({
      id: 'trip-id',
      origin: 'Tigre',
      destination: 'Primera Sección',
      isEmptyReturn: false,
      boat: { id: boat.id, name: boat.name },
    });
  });

  it('rejects trips for boats that are not active and approved', async () => {
    boatsRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(
        {
          boatId: 'boat-id',
          origin: 'Tigre',
          destination: 'Delta',
          startsAt: new Date(Date.now() + 60_000).toISOString(),
          endsAt: new Date(Date.now() + 120_000).toISOString(),
        },
        'admin-id',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(tripRepository.save).not.toHaveBeenCalled();
  });

  it('rejects trips unless saved availability covers the complete trip', async () => {
    boatsRepository.findOne.mockResolvedValue({
      id: 'boat-id',
      name: 'La Estrella',
    } as Boat);
    availabilityRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(
        {
          boatId: 'boat-id',
          origin: 'Tigre',
          destination: 'Delta',
          startsAt: new Date(Date.now() + 60_000).toISOString(),
          endsAt: new Date(Date.now() + 120_000).toISOString(),
        },
        'admin-id',
      ),
    ).rejects.toThrow('disponibilidad guardada');
    expect(tripRepository.save).not.toHaveBeenCalled();
  });

  it('rejects invalid time ranges before reading a boat', async () => {
    const startsAt = new Date(Date.now() + 60_000);

    await expect(
      service.create(
        {
          boatId: 'boat-id',
          origin: 'Tigre',
          destination: 'Delta',
          startsAt: startsAt.toISOString(),
          endsAt: startsAt.toISOString(),
        },
        'admin-id',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(boatsRepository.findOne).not.toHaveBeenCalled();
  });

  it('issues a review token only after the scheduled trip has ended', async () => {
    const trip = {
      id: 'trip-id',
      startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 60 * 60 * 1000),
      completedAt: null,
      reviewTokenHash: null,
      reviewTokenExpiresAt: null,
    };
    const queryBuilder = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(trip),
    };
    tripRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    manager.save.mockImplementation(async (_entity, value) => value);

    const result = await service.complete(trip.id);

    expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(manager.save).toHaveBeenCalledWith(Trip, trip);
    expect(trip.completedAt).toBeInstanceOf(Date);
    expect(trip.reviewTokenHash).toBe(
      TripsService.hashReviewToken(result.reviewToken),
    );
    expect(result.reviewTokenExpiresAt).toEqual(trip.reviewTokenExpiresAt);
  });

  it('does not complete a trip before its start or scheduled end', async () => {
    for (const scheduledTrip of [
      {
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
      },
      {
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
      },
    ]) {
      const queryBuilder = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue({
          id: 'trip-id',
          ...scheduledTrip,
          completedAt: null,
        }),
      };
      tripRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(service.complete('trip-id')).rejects.toThrow(
        BadRequestException,
      );
    }

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects completion when the trip does not exist or is already complete', async () => {
    const queryBuilder = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'trip-id',
        startsAt: new Date(Date.now() - 60_000),
        endsAt: null,
        completedAt: new Date(),
      }),
    };
    tripRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.complete('missing-id')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.complete('trip-id')).rejects.toThrow(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });
});
