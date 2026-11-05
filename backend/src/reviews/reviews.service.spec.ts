import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OwnerNotification } from '../owners/owner-notification.entity.js';
import { Trip } from '../trips/trip.entity.js';
import { TripsService } from '../trips/trips.service.js';
import { BoatFeedback } from './boat-feedback.entity.js';
import { ReviewsService } from './reviews.service.js';

describe('ReviewsService', () => {
  const tripsRepository = { findOne: vi.fn() };
  const feedbackRepository = { findOne: vi.fn() };
  const queryBuilder = {
    innerJoinAndSelect: vi.fn(),
    setLock: vi.fn(),
    where: vi.fn(),
    getOne: vi.fn(),
  };
  queryBuilder.innerJoinAndSelect.mockReturnValue(queryBuilder);
  queryBuilder.setLock.mockReturnValue(queryBuilder);
  queryBuilder.where.mockReturnValue(queryBuilder);
  const tripRepository = {
    createQueryBuilder: vi.fn(() => queryBuilder),
  };
  const manager = {
    create: vi.fn((_entity, value) => value),
    findOne: vi.fn(),
    getRepository: vi.fn(() => tripRepository),
    save: vi.fn((entity, value) =>
      Promise.resolve(
        entity === BoatFeedback
          ? { id: 'feedback-id', createdAt: new Date(), ...value }
          : value,
      ),
    ),
  };
  const dataSource = {
    transaction: vi.fn((work) => work(manager as never)),
  };
  const token = 'a'.repeat(43);
  const trip = {
    id: 'trip-id',
    boatId: 'boat-id',
    origin: 'Tigre',
    destination: 'Delta',
    completedAt: new Date(Date.now() - 60_000),
    reviewTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    boat: { id: 'boat-id', name: 'Estrella', ownerId: 'owner-id' },
  } as Trip;

  let service: ReviewsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewsService(
      tripsRepository as never,
      feedbackRepository as never,
      dataSource as unknown as DataSource,
    );
  });

  it('returns trip details and whether a review already exists', async () => {
    tripsRepository.findOne.mockResolvedValue(trip);
    feedbackRepository.findOne.mockResolvedValue(null);

    await expect(service.getByToken(token)).resolves.toMatchObject({
      trip: {
        id: 'trip-id',
        origin: 'Tigre',
        destination: 'Delta',
        boat: { name: 'Estrella' },
      },
      alreadyReviewed: false,
    });
    expect(tripsRepository.findOne).toHaveBeenCalledWith({
      where: { reviewTokenHash: TripsService.hashReviewToken(token) },
      relations: { boat: true },
    });
  });

  it('creates one public review and notifies the boat owner', async () => {
    queryBuilder.getOne.mockResolvedValue(trip);
    manager.findOne.mockResolvedValue(null);

    const result = await service.createByToken(token, {
      rating: 5,
      comment: '  Excelente viaje  ',
    });

    expect(queryBuilder.innerJoinAndSelect).toHaveBeenCalledWith(
      'trip.boat',
      'boat',
    );
    expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(manager.create).toHaveBeenCalledWith(
      BoatFeedback,
      expect.objectContaining({
        tripId: 'trip-id',
        boatId: 'boat-id',
        ownerId: 'owner-id',
        rating: 5,
        comment: 'Excelente viaje',
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      OwnerNotification,
      expect.objectContaining({
        ownerId: 'owner-id',
        feedbackId: 'feedback-id',
      }),
    );
    expect(result).toMatchObject({
      id: 'feedback-id',
      rating: 5,
      comment: 'Excelente viaje',
    });
  });

  it('rejects invalid tokens, expired links, and duplicate reviews', async () => {
    await expect(service.getByToken('invalid')).rejects.toThrow(
      NotFoundException,
    );

    tripsRepository.findOne.mockResolvedValue({
      id: trip.id,
      completedAt: trip.completedAt,
      reviewTokenExpiresAt: new Date(Date.now() - 60_000),
      boat: trip.boat,
    });
    await expect(service.getByToken(token)).rejects.toThrow(NotFoundException);

    queryBuilder.getOne.mockResolvedValue(trip);
    manager.findOne.mockResolvedValue({ id: 'existing-feedback' });
    await expect(
      service.createByToken(token, { rating: 4, comment: null }),
    ).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });
});
