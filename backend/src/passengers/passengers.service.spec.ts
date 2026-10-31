import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { Boat, BoatStatus, VerificationStatus } from '../boats/boat.entity.js';
import { BoatDocument } from '../boats/boat-document.entity.js';
import { Owner } from '../owners/owner.entity.js';
import { BoatBooking } from './boat-booking.entity.js';
import { BoatFeedback } from './boat-feedback.entity.js';
import { PassengersService } from './passengers.service.js';

describe('PassengersService', () => {
  const usersRepository = {
    create: vi.fn((value) => value),
    save: vi.fn(),
  };
  const bookingsRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
  };
  const feedbackRepository = {
    create: vi.fn((value) => value),
    save: vi.fn(),
  };
  const dataSource = { transaction: vi.fn() };

  let service: PassengersService;

  beforeEach(() => {
    vi.clearAllMocks();
    usersRepository.save.mockImplementation((passenger) =>
      Promise.resolve({
        ...passenger,
        id: 'passenger-id',
        createdAt: new Date(),
      }),
    );
    feedbackRepository.save.mockImplementation((feedback) =>
      Promise.resolve({ ...feedback, id: 'feedback-id', createdAt: new Date() }),
    );
    service = new PassengersService(
      usersRepository as unknown as Repository<Owner>,
      bookingsRepository as unknown as Repository<BoatBooking>,
      feedbackRepository as unknown as Repository<BoatFeedback>,
      dataSource as never,
    );
  });

  it('builds PostgreSQL metadata for the nullable phone and booking relations', async () => {
    const dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test',
      password: 'test',
      database: 'test',
      entities: [Owner, Boat, BoatDocument, BoatBooking, BoatFeedback],
    });

    await (
      dataSource as unknown as { buildMetadatas: () => Promise<void> }
    ).buildMetadatas();

    expect(
      dataSource.getMetadata(Owner).findColumnWithPropertyName('phone')?.type,
    ).toBe('varchar');
    expect(
      dataSource
        .getMetadata(BoatBooking)
        .findColumnWithPropertyName('passengerId')?.type,
    ).toBe('uuid');
  }, 20_000);

  it('creates a passenger account without phone and returns no password hash', async () => {
    const result = await service.register({
      fullName: '  River Passenger  ',
      email: '  PERSON@example.com ',
      password: 'a-secure-passenger-password',
    });

    const savedPassenger = usersRepository.save.mock.calls[0][0];
    expect(savedPassenger).toMatchObject({
      fullName: 'River Passenger',
      email: 'person@example.com',
      phone: null,
      role: 'passenger',
    });
    expect(savedPassenger.passwordHash).toMatch(/^[a-f\d]+:[a-f\d]{128}$/i);
    expect(result).toMatchObject({
      id: 'passenger-id',
      fullName: 'River Passenger',
      email: 'person@example.com',
      role: 'passenger',
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects a normalized email already used by another account role', async () => {
    usersRepository.save.mockRejectedValue(
      new QueryFailedError('INSERT INTO users', [], { code: '23505' }),
    );

    await expect(
      service.register({
        fullName: 'Passenger',
        email: 'OWNER@example.com',
        password: 'a-secure-passenger-password',
      }),
    ).rejects.toThrow(ConflictException);

    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'owner@example.com', role: 'passenger' }),
    );
  });

  it('reserves one seat under a boat lock and decrements available capacity', async () => {
    const boat = {
      id: 'boat-id',
      ownerId: 'owner-id',
      name: 'La Estrella',
      imageUrl: null,
      passengerCapacity: 4,
      availablePassengerCapacity: 1,
      coverageZone: 'Delta',
      status: BoatStatus.ACTIVE,
      verificationStatus: VerificationStatus.APPROVED,
    };
    const manager = {
      findOne: vi.fn((entity) => {
        if (entity === Boat) return Promise.resolve(boat);
        if (entity === Owner) return Promise.resolve({ fullName: 'Lanchero' });
        return Promise.resolve(null);
      }),
      save: vi.fn((_entity, value) => Promise.resolve(value)),
      create: vi.fn((_entity, value) => value),
    };
    dataSource.transaction.mockImplementation((work) => work(manager as never));

    const result = await service.registerForBoat('passenger-id', 'boat-id');

    expect(manager.findOne).toHaveBeenNthCalledWith(1, Boat, {
      where: { id: 'boat-id' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(boat.availablePassengerCapacity).toBe(0);
    expect(manager.save).toHaveBeenCalledWith(Boat, boat);
    expect(manager.save).toHaveBeenCalledWith(
      BoatBooking,
      expect.objectContaining({ boatId: 'boat-id', passengerId: 'passenger-id' }),
    );
    expect(result.boat.availablePassengerCapacity).toBe(0);
  });

  it('rejects a reservation when no seats remain', async () => {
    const manager = {
      findOne: vi.fn().mockResolvedValue({
        id: 'boat-id',
        status: BoatStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
        availablePassengerCapacity: 0,
      }),
      save: vi.fn(),
      create: vi.fn(),
    };
    dataSource.transaction.mockImplementation((work) => work(manager as never));

    await expect(
      service.registerForBoat('passenger-id', 'boat-id'),
    ).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('allows feedback only for the passenger reservation and stores a rating', async () => {
    bookingsRepository.findOne.mockResolvedValue({
      id: 'booking-id',
      boatId: 'boat-id',
      boat: { ownerId: 'owner-id' },
    });

    const result = await service.leaveFeedback('passenger-id', 'booking-id', {
      rating: 5,
      comment: '  Excelente paseo  ',
    });

    expect(feedbackRepository.create).toHaveBeenCalledWith({
      bookingId: 'booking-id',
      boatId: 'boat-id',
      passengerId: 'passenger-id',
      ownerId: 'owner-id',
      rating: 5,
      comment: 'Excelente paseo',
    });
    expect(result).toMatchObject({
      id: 'feedback-id',
      rating: 5,
      comment: 'Excelente paseo',
    });
  });
});